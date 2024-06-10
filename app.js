const express = require('express');
const path = require('path');
const WebSocket = require('ws');
const http = require('http');
const Partida = require('./models/partida');
const url = require("url");
const jwt = require('jsonwebtoken');
const JugadorFactory = require("./models/jugadorFactory.js");
const PartidaFactory = require("./models/partidaFactory.js");
const Ruta = require('./models/ruta.js');
const Jugador = require('./models/jugador.js');
const THREE = require('three');

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
        let ja = null;
        let partida = null;
        switch(msg.type){
            case "login":
                let username = msg.content;
                conectarUsuario(username,ws);
                break;
            case "createGame":
                let nombrePartida = msg.content;
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

                let idp = msg.content;
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
                    let rsp = {type:"message",content:`${ja.nombre}: ${msg.content}`};
                    j.wsclient.send(JSON.stringify(rsp));
                });
                console.log(`${ja.nombre} ha enviado el mensaje "${msg.content}"`);
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
                const colorId = msg.content.colorId;
                if(partida.jugadores.find( j => j.colorId === colorId && j.id !== ja.id)){
                    enviarError(ws,`El color ${Partida.colores[colorId].nombre} no está disponible`);
                    return;
                }
                if(ja.colorId === colorId && ja.ficha === msg.content.fichaNom){
                    console.log("No ha cambiado ni la ficha ni el color");
                    return;
                }
                ja.colorId = colorId;
                ja.ficha = msg.content.fichaNom;                
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
                if(JSON.stringify(partida.reglas)==JSON.stringify(msg.content)){
                    console.log("las reglas NO han cambiado");
                    return;
                }
                partida.reglas = msg.content;
                partida.jugadores.forEach( j => {
                    let rsp = {type:"game",content:{partida:partida.minify(),msj:"Las reglas han sido actualizadas"}};
                    j.wsclient.send(JSON.stringify(rsp));
                });

                break;
            case "setReady":
                ja = validarJugador(msg,ws);
                if(!ja) return;
                ja.listo = msg.content;
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
                }else if(listos.length==partida.maxJugadores-1 && !msg.content){
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
                let mj = msg.content;
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
            case "seleccionarCasilla":
                ja = validarJugador(msg,ws);
                if(!ja) return;
                if(ja.id != ja.partida.jugadorActual.id) {
                    enviarError(ws,"No es tu turno!");
                    return;
                }
                partida = ja.partida;
                //calcular ruta y estado ficha
                const ruta = evaluarSeleccionCasilla(ja,partida,msg.content);
                partida.transmitir();
                //calcular pasos
                avanzarCaminata(ja,ruta);
                break;
            case "rollDice":
                ja = validarJugador(msg,ws);
                if(!ja) return;
                if(ja.id != ja.partida.jugadorActual.id) {
                    enviarError(ws,"No es tu turno!");
                    return;
                }
                partida = ja.partida;
                const valor = msg.content;
                console.log(`el valor de los dados es ${valor}`);
                partida.lanzarDados(valor);
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
                    partida.estado = "C";
                    const val1 = Partida.TABLA_DADOS[0][partida.d1Ix];
                    const val2 = Partida.TABLA_DADOS[1][partida.d2Ix];
                    console.log(`caminará ${val1+val2} espacios`);
                    partida.transmitir();
                }else{
                    console.log("hay pendientes en notificar");
                }
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
    switch(partida.estado){
        case Partida.INICIO_TURNO:
        case Partida.FINALIZANDO_TURNO:
            return evaluarCambioCamino(jugador, idcasilla);
        case Partida.DECIDIENDO_CAMINO:
            //$this->evaluarJugadorDecideCamino($idjugador, $idpartida, $idcasilla, $cnn);
            break;
        case Partida.COMPRANDO_OF_OP:
            //$this->evaluarCompraOFOP($idjugador,$idpartida,$idcasilla,$cnn);
            break;
        case Partida.FUSIONANDO:
            //$this->evaluarFusionaTitulo($idpartida,$idjugador,$idcasilla,$cnn);
            break;
        case Partida.FRACASANDO:
            //$this->evaluarDevuelveTitulo($idpartida,$idjugador,$idcasilla,$cnn);
            break;
        case Partida.DECIDIENDO_SUERTE:
            //$this->evaluarDecidirSuerte($idpartida,$idjugador,$idcasilla,$cnn);
            break;
    }    
}
function evaluarCambioCamino(jugador, idcasilla) {
    const casDef = jugador.partida.tablero.casillerosDef.items;
    const partida = jugador.partida;
    const rutaEsp = casDef[jugador.posicion].rutaEspecial;
    let ruta;
    if(rutaEsp && rutaEsp.ruta[rutaEsp.ruta.length-1]==idcasilla){
        ruta = new Ruta(rutaEsp.ruta,0);
    }else{
        ruta = new Ruta([jugador.posicion,idcasilla],0);
    }
    console.log(JSON.stringify(ruta));
    // TODO: revisar necesidad de clase Variables
    // $vars = new Variables();
    // $vars->guardar($idpartida,"ruta",json_encode($ruta), $cnn);
    partida.estadoInicial = partida.estado;
    jugador.fichaEstado = Jugador.FICHA_ESTADO_ESPERAR;
    partida.tablero.limpiar();
    partida.estado = Partida.CAMINANDO;
    //const trp = partida.tablero.casilleros[idcasilla].transparencia;
    //partida.tablero.casilleros[idcasilla].transparencia = trp<1? 1: 0.5;
    return ruta;
}

function avanzarCaminata(jugador,ruta){
    const numSegmentos = 25;
    const casDef = jugador.partida.tablero.casillerosDef.items;
    const Vangle = new THREE.Vector3();
    const P = new THREE.Vector3();
    const temp = new THREE.Matrix4();
    const transformacion = new THREE.Matrix4();
    let [ini,fin,iSegmento,iCasillaActual] = [0,0,0,0];
    //console.log(`avanzarCaminata: ${JSON.stringify(ruta)}`);
    jugador.fichaEstado = Jugador.FICHA_ESTADO_CAMINAR;
    const intervalID = setInterval(()=> {
        if(iCasillaActual<ruta.getLongitud()){
            transformacion.identity();
            iSegmento++;
            if(iSegmento<numSegmentos){
                if(iSegmento==1){
                    ini = ruta.get(iCasillaActual);
                    fin = ruta.get(iCasillaActual+1);
                    Vangle.subVectors(casDef[fin].coords,casDef[ini].coords);
                }
                P.lerpVectors(casDef[ini].coords,casDef[fin].coords,iSegmento/numSegmentos);
            }else{
                iSegmento = 0;                            
                iCasillaActual++;
                const v = casDef[ruta.get(iCasillaActual)].coords;
                P.copy(v);
            }
            const giro = Math.atan2(-Vangle.z,Vangle.x);
            temp.makeRotationY(giro);
            transformacion.multiply(temp);
            temp.makeTranslation(P);
            transformacion.premultiply(temp);
            const idCasillaActual = ruta.get(iCasillaActual);
            jugador.posicion = idCasillaActual;
            jugador.fichaTransform = transformacion.toArray();
            jugador.transmitir();
            //console.log("caminando...");
        }else{
            clearInterval(intervalID);
            terminarCaminata(jugador,ruta,false);
        }
    },100);
}

function terminarCaminata(jugador,ruta,forzado){
    //iSegmento=0;
    //iCasillaActual = 0;
    //setEnable(false);
    //ServicioPartida.SP().terminarCaminata(forzado);
    jugador.fichaEstado = Jugador.FICHA_ESTADO_ESPERAR;
    jugador.transmitir();
    //se espera antes de proceder con la evaluación de la casilla para apreciar donde cayó
    setTimeout(() => {
        evaluarDestino(jugador, ruta);
        jugador.partida.transmitir();
    }, 500);
}

function evaluarDestino(jugador, ruta) {
    jugador.partida.estado = Partida.EVALUANDO_DESTINO;
    
    if(ruta.getLongitud()!=7){ //NO es feriado
        evaluarFinCaminoLaboral(jugador,ruta);
    }else{ //es un feriado
        // $dialogo = new Dialogo();
        // $dialogo->abrir($idpartida, Dialogo::AVISO_FERIADO, "Es feriado. Puedes descansar...zzZ", $cnn);
        console.log("pendiente implementar Feriado");
    }
}
function evaluarFinCaminoLaboral(jugador,ruta) {
    //$this->cobrarSueldo($idpartida,$jugador,$ruta->numMeses,$cnn); //cobrar sueldo por los meses pasados
    //if($partida->evaluarGanador($idpartida, $cnn)) return;
    jugador.partida.tablero.procesarCasilla(jugador,ruta); //procesa CASILLA ACTUAL
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
