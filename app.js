const express = require('express');
const path = require('path');
const WebSocket = require('ws');
const http = require('http');
const Partida = require('./models/partida');
const url = require("url");
const jwt = require('jsonwebtoken');
const JugadorFactory = require("./models/jugadorFactory.js");
const PartidaFactory = require("./models/partidaFactory.js");
const {PE,DIAG_TIPO,DIAG_RSP,CA} = require("./models/valores");
const Ruta = require('./models/ruta.js');
const { setTimeout } = require('timers');

//token secret
let secret = '1nv3$t0r';
const prtFact = new PartidaFactory();
const jugFact = new JugadorFactory();
const app = express();
app.use(express.static(path.join(__dirname,'public')));

const server = http.Server(app);
const port = process.env.PORT ?? 3000;

const wss = new WebSocket.WebSocketServer({ server: server });
wss.on('connection', function connection(ws, request) {
    const qry  = url.parse(request.url, true).query;    
    let token = qry.token;
    console.log(`parametros = ${JSON.stringify(qry)}`);
    if(token){//verificación de token
        reconectarUsuario(token,ws);
    }else{
        let rsp = {type:"handshake",content:jugFact.jugadores.length};
        ws.send(JSON.stringify(rsp));
    }

    ws.on('error', console.error);
  
    ws.on('message', function message(data) {        
        console.log(`Mensaje recibido: ${data}`);
        const msg = JSON.parse(data);
        const contenido = msg.content;
        let ja = null;
        let partida = null;
        switch(msg.type){
            case "login":
                let username = contenido;
                conectarUsuario(username,ws);
                break;
            case "createGame":
                let nombrePartida = contenido;
                //Validar nombre de partida
                if(prtFact.getByNombre(nombrePartida)){ 
                    enviarError(ws,"ya existe una partida con ese nombre");
                    return;
                }
                //verificar que jugador existe
                ja = jugFact.getByToken(msg.token);  
                if(!ja){
                    enviarError(ws,`El token indicado(${msg.token}) no es válido`);
                    return;
                }
                //verificar si está en una partida
                if(ja.partida){
                    enviarError(ws,`${ja.nombre} ya está en una partida`);
                    return;
                }
                //crear partida
                partida = prtFact.crearPartida(nombrePartida);
                partida.agregarJugador(ja);
                console.log(`se ha creado la partida "${nombrePartida}"`);
                //notificar a jugadores
                jugFact.jugadores.forEach((j)=>{
                    //cualquier jugador que no está en una partida
                    if(!j.partida){
                        let rsp = {type:"games",content:prtFact.listMini()};
                        j.wsclient.send(JSON.stringify(rsp));
                        console.log("enviando a "+j.nombre+": "+JSON.stringify(rsp));
                    }
                });
                //notiticar al usuario creador
                let rsp = {type:"game",content:{partida:partida.minify(),msj:"¡Felicitaciones! Has creado una partida."}};
                ws.send(JSON.stringify(rsp));
                break;
            case "join":
                ja = jugFact.getByToken(msg.token);
                // El usuario no existe
                if(!ja){
                    enviarError(ws,`El token ${msg.token} no es válido`);
                    return;                    
                }
                // El usuario ya está en una partida
                if(ja.partida){
                    enviarError(ws,`El jugador ${ja.nombre} ya está en una partida`);
                    return;
                }

                let idp = contenido;
                partida = prtFact.getById(idp);
                if(!partida){
                    enviarError(ws,`No puedes unirte a la partida "${idp}" porque no existe`);
                    break;
                }
                if(partida.agregarJugador(ja)){
                    //notificar a los jugadores de la partida
                    partida.jugadores.forEach( j => {
                        let rsp = {type:"game",content:{
                            partida:partida.minify(),
                            msj:(j.id === ja.id?`Hola ${j.nombre}, te has unido a ${partida.nombre}`:
                                                `${ja.nombre} se ha unido a la partida`)}};
                        j.wsclient.send(JSON.stringify(rsp));
                        console.log(`${j.nombre} se ha unido a "${partida.nombre}"`);
                    });
                    //notificar a los jugadores sin partida
                    jugFact.jugadores.forEach(j => {
                        if(!j.partida){                  
                            j.wsclient.send(JSON.stringify({type:"games",content:prtFact.listMini()}));
                            console.log(`El usuario ${ja.nombre} ha recibido las partidas`);
                        }
                    });
                }else{
                    enviarError(ws,`La partida ya está llena`);
                }                
                break;
            case "quit":
                ja = validarJugador(msg,ws);
                if(!ja) return;
                partida = ja.partida;
                partida.eliminarJugador(ja);
                partida.jugadores.forEach( j => {
                    let rsp = {type:"game",content:{partida:partida.minify(),msj:`${ja.nombre} ha salido de la partida`}};
                    j.wsclient.send(JSON.stringify(rsp));
                });
                prtFact.cleanEmpty();

                jugFact.jugadores.forEach(j => {
                    if(!j.partida){                  
                        j.wsclient.send(JSON.stringify({type:"games",content:prtFact.listMini()}));
                        console.log(`El usuario ${ja.nombre} ha recibido las partidas`);
                    }
                });
                break;
            case "message":
                ja = validarJugador(msg,ws);
                if(!ja) return;
                partida = ja.partida;
                partida.jugadores.forEach( j => {
                    let rsp = {type:"message",content:`${ja.nombre}: ${contenido}`};
                    j.wsclient.send(JSON.stringify(rsp));
                });
                console.log(`${ja.nombre} ha enviado el mensaje "${contenido}"`);
                break;
            case "logout":
                ja = jugFact.getByToken(msg.token);
                // el usuario no existe
                if(!ja){
                    console.log(`El token ${msg.token} no es válido`);
                    ws.close();
                    return;
                }
                //el usuario no está en una partida
                if(!ja.partida){
                    jugFact.eliminarJugador(ja);
                    ws.close();
                    console.log(`El usuario ha sido eliminado`);
                    return;
                }
                
                partida =  ja.partida;
                partida.eliminarJugador(ja);
                jugFact.eliminarJugador(ja);
                prtFact.cleanEmpty();
                partida.jugadores.forEach( j => {
                    let rsp = {type:"game",content:{
                        partida:partida.minify(),
                        msj:`${ja.nombre} ha dejado la partida`}};
                    j.wsclient.send(JSON.stringify(rsp));
                });
                ws.close();
                console.log(`${ja.nombre} ha dejado la partida ${partida.nombre}`);
                break;
            case "changeChar":
                ja = validarJugador(msg,ws);
                if(!ja) return;                
                partida =  ja.partida;
                const colorId = contenido.colorId;
                if(partida.jugadores.find( j => j.colorId === colorId && j.id !== ja.id)){
                    enviarError(ws,`El color ${Partida.colores[colorId].nombre} no está disponible`);
                    return;
                }
                if(ja.colorId === colorId && ja.ficha === contenido.fichaNom){
                    console.log("No ha cambiado ni la ficha ni el color");
                    return;
                }
                ja.colorId = colorId;
                ja.ficha = contenido.fichaNom;                
                partida.jugadores.forEach( j => {
                    let rsp = {type:"game",content:{partida:partida.minify(),msj:""}};
                    j.wsclient.send(JSON.stringify(rsp));
                });
                break;
            case "setRules":
                ja = validarJugador(msg,ws);
                if(!ja) return;
                if(!ja.isHost) {
                    enviarError(ws,"Sólo el anfitrión puede definir la reglas");
                    return;
                }
                partida = ja.partida;
                if(JSON.stringify(partida.reglas)==JSON.stringify(contenido)){
                    console.log("las reglas NO han cambiado");
                    return;
                }
                partida.reglas = contenido;
                partida.jugadores.forEach( j => {
                    let rsp = {type:"game",content:{partida:partida.minify(),msj:"Las reglas han sido actualizadas"}};
                    j.wsclient.send(JSON.stringify(rsp));
                });

                break;
            case "setReady":
                ja = validarJugador(msg,ws);
                if(!ja) return;
                ja.listo = contenido;
                partida = ja.partida;
                partida.jugadores.forEach( j => {
                    let rsp = {type:"game",content:{partida:partida.minify(),msj:""}};
                    j.wsclient.send(JSON.stringify(rsp));
                });
                //validar inicio de partida.
                const listos = partida.jugadores.filter( j => j.listo);
                if(listos.length==partida.maxJugadores){
                    console.log(`Iniciando "${partida.nombre}"...`);
                    partida.setCondicionesIniciales();
                    partida.jugadores.forEach( j => {
                        let rsp = {type:"game",content:{partida:partida.minify(),msj:"Iniciando..."}};
                        j.wsclient.send(JSON.stringify(rsp));
                    });
                    setTimeout(() => {
                        partida.iniciar();
                        partida.transmitir();
                    },2*1000);
                }else if(listos.length==partida.maxJugadores-1 && !contenido){
                    console.log("Cancelando inicio de partida...");
                }
                break;
            case "setMaxPlayers":
                ja = validarJugador(msg,ws);
                if(!ja) return;
                if(!ja.isHost) {
                    enviarError(ws,"Sólo el anfitrión puede definir la cantidad de jugadores");
                    return;
                }
                partida = ja.partida;
                let mj = contenido;
                //validar que la cantidad máxima ingresada no sea menor que la cantidad actual de jugadores
                if(partida.jugadores.length > mj){
                    enviarError(ws,"La cantidad maxima de jugadores no puede disminuir");
                    let rsp = {type:"game",content:{partida:partida.minify(),msj:""}};
                    ja.wsclient.send(JSON.stringify(rsp));
                    return;
                }
                //asignar máximo de jugadores
                partida.maxJugadores = mj;
                partida.jugadores.forEach( j => {
                    let rsp = {type:"game",content:{partida:partida.minify(),msj:""}};
                    j.wsclient.send(JSON.stringify(rsp));
                });
                //enviar a jugadores que no estan en partida para que vean el nuevo límite
                jugFact.jugadores.forEach(j => {
                    if(!j.partida){                  
                        j.wsclient.send(JSON.stringify({type:"games",content:prtFact.listMini()}));
                        console.log(`El usuario ${ja.nombre} ha recibido las partidas`);
                    }
                });
                break;
            case "selectSite":
                ja = validarJugador(msg,ws);
                if(!ja) return;
                if(ja.id != ja.partida.jugadorActual.id) {
                    enviarError(ws,"No es tu turno!");
                    return;
                }
                partida = ja.partida;
                //calcular ruta y estado ficha
                evaluarSeleccionCasilla(ja,partida,contenido);
                break;
            case "rollDice":
                ja = validarJugador(msg,ws);
                if(!ja) return;
                if(ja.id != ja.partida.jugadorActual.id) {
                    enviarError(ws,"No es tu turno!");
                    return;
                }
                partida = ja.partida;
                console.log(`el valor de los dados es ${contenido}`);
                partida.lanzarDados(contenido);
                partida.transmitir();
                break;
            case "evaluateDice":
                ja = validarJugador(msg,ws);
                if(!ja) return;
                partida = ja.partida;
                ja.f1 = true;
                console.log(`${ja.nombre} ha notificado`);
                if(partida.jugadores.filter( j => j.f1).length == partida.jugadores.length){
                    partida.jugadores.forEach(j => j.f1 = false);
                    partida.validarResultadoDados();
                }else{
                    console.log("hay pendientes en notificar");
                }
                break;
            case "takeCredit":
                ja = validarJugador(msg,ws);
                if(!ja) return;
                if(ja.id != ja.partida.jugadorActual.id) {
                    enviarError(ws,"No es tu turno!");
                    return;
                }
                partida = ja.partida;
                const creditId = contenido;
                const res = ja.cobrarPagare(creditId);
                if(!res) {
                    enviarError(ws,`El id ${creditId} indicado no puede cobrarse`);
                    return;
                }
                partida.escribirNota(`@j${ja.id} ha cobrado un pagaré por @d${(creditId+1)*10}`);
                partida.transmitir();
                break;
            case "finishTurn":
                ja = validarJugador(msg,ws);
                if(!ja) return;
                if(ja.id != ja.partida.jugadorActual.id) {
                    enviarError(ws,"No es tu turno!");
                    return;
                }
                partida = ja.partida;
                partida.avanzarTurno();
                partida.transmitir();
                break;
            case "closeDialog":
                ja = validarJugador(msg,ws);
                if(!ja) return;
                if(ja.id != ja.partida.jugadorActual.id) {
                    enviarError(ws,"No es tu turno!");
                    return;
                }
                partida = ja.partida;
                const idg = contenido.idg;
                const rc = contenido.rc;
                const idObj = contenido.idObj;
                evaluarCerrarDialogo(ja,idg,rc,idObj);
                partida.transmitir();
                break;                
        }
    });
    ws.on('close', () => {
        console.log("El cliente se desconectó");
    });
});

server.listen(port,() => {
    console.log(`WS escuchando en puerto ${port}`);    
});

function evaluarSeleccionCasilla(jugador,partida,idcasilla){
    let ruta;
    switch(partida.estado){
        case PE.INICIO_TURNO:
        case PE.FINALIZANDO_TURNO:
            ruta = jugador.evaluarCambioCamino(idcasilla);
            partida.transmitir();
            jugador.avanzarCaminata(ruta);
            break;
        case PE.DECIDIENDO_CAMINO:
            ruta = jugador.evaluarSeleccionCamino(idcasilla);
            partida.transmitir();
            jugador.avanzarCaminata(ruta);
            break;
        case PE.COMPRANDO_OF_OP:
            partida.evaluarCompraOFOP(jugador,idcasilla);
            partida.transmitir();
            break;
        case PE.FUSIONANDO:
            //$this->evaluarFusionaTitulo($idpartida,$idjugador,$idcasilla,$cnn);
            partida.transmitir();
            break;
        case PE.FRACASANDO:
            //$this->evaluarDevuelveTitulo($idpartida,$idjugador,$idcasilla,$cnn);
            partida.transmitir();
            break;
        case PE.DECIDIENDO_SUERTE:
            //$this->evaluarDecidirSuerte($idpartida,$idjugador,$idcasilla,$cnn);
            partida.transmitir();
            break;
    }    
}

function evaluarCerrarDialogo(jugador, idg, rc,idObj) {
    const partida = jugador.partida;
    let hayGanador;
    dialogo = partida.dialogos.find( d=> {return d.id==idg});
    if(!dialogo) {
        enviarError(jugador.wsclient,`el dialogo ${idg} no existe`);
        return;
    }
    dialogo.cerrar();
    switch (dialogo.tipo){
        case DIAG_TIPO.COMODIN:
            evaluarCierreComodin(dialogo.contenido,jugador);
            break;
        // case Dialogo::AVISO_PAGARES_PAGO:
        //     $partida->evaluarGanador($idpartida, $cnn);
        //     break;
        case DIAG_TIPO.DECLARAR_BANCAROTA:
            const idacreedores = dialogo.contenido.idacreedores;
            const deuda = dialogo.contenido.deuda;
            const deudor = partida.jugadores.find(j=>{return j.id == dialogo.contenido.iddeudor});
            deudor.declararBancaRota(idacreedores,deuda);
            partida.escribirNota( `@j${jugador.id} se ha declarado en banca rota`);
            hayGanador = partida.evaluarGanador();
            if(!hayGanador){
                //Avanzar turno hasta que el siguiente No esté descansando
                let jSiguienteActivo;
                while(!jSiguienteActivo){
                    jSiguienteActivo = partida.avanzarTurno();
                }
            }
            break;
        // case Dialogo::PAGAR_DEUDA:
        //     switch($rc){
        //         case Dialogo::RET_OK:
        //             $res = $jugador->pagarDeuda($idjugador,$cnn);
        //             if($res){
        //                 $dialogo->abrir($idpartida, Dialogo::AVISO_PAGARES_PAGO, $res, $cnn);
        //                 partida.escribirNota($res);
        //             }else{
        //                 //TODO: enviar mensaje de error que no pudo pagarse la deuda.
        //                 $partida->finalizarTurno($idpartida, $cnn);
        //             }                        
        //             break;
        //         case Dialogo::RET_CANCEL:
        //             $variable = new Variables();
        //             $jugadorBackup = $variable->tomar($idpartida, "jugadorBackup", $cnn);
        //             $partida->setNoGanador($idpartida, $cnn);
        //             $partida->setJugadorActual($idpartida,$jugadorBackup,$cnn);
        //             $jActual = $partida->getJugadorActual($idpartida, $cnn);
        //             partida.escribirNota(`@j${jActual.id} ha decidido no pagar su deuda`);
        //             $partida->finalizarTurno($idpartida, $cnn);
        //             break;
        //         default:
        //             $codError= 130;
        //             throw new Exception("dialogo return code $rc no permitida");
        //     }
        //     break;
        case DIAG_TIPO.PAGO_JUGADOR:
            hayGanador = partida.evaluarGanador();
            if(!hayGanador) partida.finalizarTurno();
            break;
        case DIAG_TIPO.FERIADO:
            partida.escribirNota(`@j${jugador.id} está tomandose un feriado`);
            partida.avanzarTurno();
            break;
        // case Dialogo::AVISO_INICIO:
        //     $partida->iniciar($idpartida,$cnn);
        //     break;
        case DIAG_TIPO.COMPRAR_TITULO:
            switch(rc){
                case DIAG_RSP.OK:
                    if(!jugador.comprarTitulo(dialogo.contenido.id,jugador.posicion == CA.OFERTA)){
                        enviarError(jugador.wsclient,`No tienes efectivo suficiente`);
                    }
                    partida.finalizarTurno();
                    break;
                case DIAG_RSP.CANCEL:
                    if(partida.caso){
                        const casilla = partida.tablero.casillerosDef.items[partida.caso];
                        evaluarCierreComodin(casilla, jugador);
                    }else{
                        partida.finalizarTurno();
                    }
                    break;
                default:
                    enviarError(jugador.wsclient,`dialogo return code ${rc} no permitida`);
            }
            break;
        case DIAG_TIPO.COBRAR_UTILIDAD:
            jugador.cobrarUtilidadAnual();
            partida.escribirNota(`@j${jugador.id} ha cobrado sus utilidades por @d${jugador.utilidadAnual}`);
            hayGanador = partida.evaluarGanador();
            if(!hayGanador){
                partida.tablero.permitirCambiarCarril(jugador.posicion);
                partida.finalizarTurno();
            }
            break;
        case DIAG_TIPO.DESCANSO:
            partida.escribirNota(`@j${jugador.id} descansará 1 turno mas`);
            partida.avanzarTurno();
            break;
        // case Dialogo::DEVOLVER_TITULOS:
        //     $variable = new Variables();
        //     $frmTitulosStr = $variable->tomar($idpartida, "frmTitulos", $cnn);
        //     $frmTitulos = json_decode($frmTitulosStr);
        //     foreach($frmTitulos->grpDestino as $titulo){
        //         $jugador->devolverTitulo($idjugador, $titulo->idt, $titulo->q, $cnn);
        //     }
        //     $titulosStr = $this->decorarTitulos($frmTitulos->grpDestino,$cnn);
        //     $mensaje = "@j$idjugador ha pedido $titulosStr";
        //     partida.escribirNota($mensaje);
        //     $partida->finalizarTurno($idpartida, $cnn);
        //     break;
        // case Dialogo::VENDER_TITULOS:
        //     switch($rc){
        //         case Dialogo::RET_OK:
        //             $variable = new Variables();
        //             $frmTitulosStr = $variable->tomar($idpartida, "frmTitulos", $cnn);
        //             $frmTitulos = json_decode($frmTitulosStr);
        //             foreach($frmTitulos->grpDestino as $titulo){
        //                 $jugador->devolverTitulo($idjugador, $titulo->idt, $titulo->q, $cnn);
        //             }
        //             $jugador->cobrarDinero($idjugador, $frmTitulos->recaudado, $cnn);
        //             $titulosStr = $this->decorarTitulos($frmTitulos->grpDestino,$cnn);
        //             $mensaje = "@j$idjugador ha recibido @d$frmTitulos->recaudado por sus $titulosStr";
        //             partida.escribirNota($mensaje);
        //             break;
        //         case Dialogo::RET_CANCEL:
        //             //ninguna accion
        //             break;
        //         default:
        //             $codError= 120;
        //             throw new Exception(("dialogo return code $rc no permitida"));
        //     }
        //     break;
        // case Dialogo::AVISO_SALDO_INSUFICIENTE:
        // case Dialogo::AVISO_PRIMERO_TITULO_PROPIO:
        // case Dialogo::AVISO_VENDER_SIN_TITULOS:
        //     //no hacer nada.
        //     break;
        default:
            partida.finalizarTurno();
            break;
    }
}

function evaluarCierreComodin(casilla, jugador) {
    const partida = jugador.partida;
    switch (casilla.id) {
        case CA.VOLVER_TIRAR_DADOS_INI: 
        case CA.VOLVER_TIRAR_DADOS_FIN:
            partida.lanzarDados();
            break;
        case CA.HOSPITAL:
        case CA.JUSTICIA:
            partida.evaluarHospitalYJusticia(jugador,casilla);
            break;
        case CA.AUMENTO_SUELDO:
            jugador.aumentarSueldo();
            partida.finalizarTurno();
            partida.escribirNota(`@j${jugador.id} ha recibido una nueva Tarjeta de sueldo`);
            break;
        case CA.OPORTUNIDAD: //Comprar inversiones Celestes
            partida.evaluarOportunidadOferta(jugador,"c",casilla);
            break;                        
        case CA.OFERTA: //Comprar inversiones Rosadas Mitad de Precio
            partida.evaluarOportunidadOferta(jugador,"r",casilla);
            break;
        case CA.INFLACION : //Pierde la mitad de su dinero efectivo
            const devuelto = jugador.aplicarInflacion();
            partida.escribirNota(`@j${jugador.id} ha perdido @d$devuelto de su dinero efectivo`);
            partida.finalizarTurno();
            break;
        case CA.MORATORIA:
            const cantidad = jugador.recuperarPagares();
            if(cantidad>0){
                partida.escribirNota(`@j${jugador.id} ha recuperado $cantidad de sus pagares`);
            }else{
                partida.escribirNota(`@j${jugador.id} no ha usado ninguno de sus pagares`);
            }
            partida.finalizarTurno();
            break;
        case CA.DEPRESION:
            // $this->evaluarDepresion($idpartida,$idjugador,$cnn);
            console.log("pendiente: evaluarDepresion");
            partida.finalizarTurno();
            break;                 
        case CA.FUSION:
            // $this->evaluarFusion($idpartida,$idjugador,$cnn);
            console.log("pendiente: evaluarFusion");
            partida.finalizarTurno();
            break;                        
        case CA.PAGUE_IMPUESTO:
            // $this->evaluarPagoImpuestos($idpartida,$idjugador,$cnn);
            console.log("pendiente: evaluarPagoImpuestos");
            partida.finalizarTurno();
            break;
        case CA.GANA_JUICIO:
            // $this->evaluarGanaJuicio($idpartida,$idjugador,$cnn);
            console.log("pendiente: evaluarGanaJuicio");
            partida.finalizarTurno();
            break;
        case CA.PAGUE_DIVIDENDOS: // PAGAR 20 A CADA JUGADOR
            // $this->evaluarPagarDividendos($idpartida,$idjugador,$cnn);
            console.log("pendiente: evaluarPagarDividendos");
            partida.finalizarTurno();
            break;                        
        case CA.PERDIO_TRABAJO:
            // $jugador->perderTrabajo($idjugador,$cnn);
            partida.finalizarTurno();
            partida.escribirNota(`@j${jugador.id} ha perdido todas sus tarjetas de sueldo`);
            break;                        
        case CA.BONANZAS:
        case CA.DIO_EN_LA_VETA:
            evaluarRegalosDelBanco(jugador,40);
            partida.finalizarTurno();
            break;                                                
        case CA.EXCELENTE_COSECHA:
            evaluarRegalosDelBanco(jugador,20);
            partida.finalizarTurno();
            break;
        case CA.FRACASO:
            // $this->evaluarFracaso($idpartida,$idjugador,$cnn);
            console.log("pendiente: evaluarFracaso");
            partida.finalizarTurno();
            break;
        case CA.ESTA_PERDIDO: //ESTA PERDIDO
            // $this->evaluarEstaPerdido($idpartida,$idjugador,$cnn);
            console.log("pendiente: evaluarEstaPerdido");
            partida.finalizarTurno(); 
            break;
        default: //avanzar o retroceder
            const ruta = casilla.rutaEspecial;
            if(ruta){
                const rutaE = casilla.rutaEspecial;
                partida.iniciarCaminata(new Ruta(rutaE.ruta,rutaE.nm));
            }else{
                enviarError(jugador.wsclient,`casilla ${casilla.id} no tiene un ruta especial`);
            }
            break;
    }
}
function evaluarRegalosDelBanco(jugador, monto) {
    const partida = jugador.partida;       
    jugador.cobrarDinero(monto);
    partida.escribirNota(`@j${jugador.id} ha cobrado @d${monto} al Banco`);
    if(!partida.evaluarGanador()){
        partida.finalizarTurno();
    }
}
function validarJugador(msg,ws){
    let ja = jugFact.getByToken(msg.token);
    // el usuario no existe
    if(!ja){
        enviarError(ws,`El token ${msg.token} no es válido`);
        return;
    }
    //el usuario no está en una partida
    if(!ja.partida){
        enviarError(ws,`El jugador ${ja.nombre} no está en una partida`);
        return;
    }
    return ja;
}

function enviarError(ws,mensaje){
    let rsp = {type:"error",content:mensaje};
    ws.send(JSON.stringify(rsp));
    console.log(`err: ${mensaje}`);
}

function reconectarUsuario(token,ws){
    jwt.verify(token, secret, (err, decoded) => {
        if (err) {//existe un error en la verificación.
            console.log(`ocurrió un problema con la autenticación: ${err}`);
            ws.close();
            return;
        }
        let j = jugFact.getByToken(token);
        if(!j){
            enviarError(ws,"El token no es válido. Recargue la página");
            return;
        }
        if(j.wsclient) j.wsclient.close();
        j.wsclient = ws;
        let rsp = {type:"loggedin",content:j.minify()};
        ws.send(JSON.stringify(rsp));
        console.log("Sesión verificada. Token reenviado.");
        if(!j.partida){
            //El jugador NO ESTÁ en una partida
            let rsp1 = {type:"games",content:prtFact.listMini()};
            ws.send(JSON.stringify(rsp1));
            console.log(`El usuario ${j.nombre} ha recibido la lista de partidas disponibles`);
        }else{
            //El jugador YA ESTÁ en una partida
            let p = j.partida;
            let rsp1 = {type:"game",content:{partida:p.minify(),msj:"Te has reconectado a la partida."}};
            ws.send(JSON.stringify(rsp1));
            console.log(`El usuario ${j.nombre} ha recibido el estado actual de la partida.`);
        }
          
    }); 
}

function conectarUsuario(username,ws){
    let ja = jugFact.getByNombre(username);
    let token = jwt.sign({ data: username }, secret, { expiresIn: '1h' });
    if(ja){        
        ja.token = token;
        if(ja.wsclient) ja.wsclient.close();
        ja.wsclient = ws;
        //enviar nuevo token
        let rsp = {type:"loggedin",content:ja.minify() };
        ws.send(JSON.stringify(rsp));
        console.log(`El usuario ${username}(${ja.id}) ha reiniciado sesión`);
        if(!ja.partida){
            // El usuario no está en una partida
            let rsp1 = {type:"games",content:prtFact.listMini()};
            ws.send(JSON.stringify(rsp1));
            console.log(`El usuario ${username} ha recibido las partidas`);
        }else{
            // El usuario ya está en una partida
            let p = ja.partida;
            let rsp = {type:"game",content:{partida:p.minify(),msj:``}};
            ja.wsclient.send(JSON.stringify(rsp));
            console.log(`El usuario ${username} recibe el estado actual de la partida`);
        }
    } else {
        let j = jugFact.crearJugador(username,token,ws);
        let rsp = {type:"loggedin",content:j.minify() };
        ws.send(JSON.stringify(rsp));
        console.log(`El usuario ${username}(${j.id}) ha iniciado sesión`);

        let rsp1 = {type:"games",content:prtFact.listMini()};
        ws.send(JSON.stringify(rsp1));
        console.log(`El usuario ${username} ha recibido las partidas`);
    }
}
