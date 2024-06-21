const Casillas = require('./casillas');
const Ruta = require('./ruta');
const THREE = require('three');
const {PE,CA,CA_POS_INTERNAS} = require("./valores");

class Jugador{
  static FICHA_ESTADO_ESPERAR = 1;
  static FICHA_ESTADO_CAMINAR = 0;
  static FICHA_ESTADO_SALUDO  = 2;

  constructor(id,nombre) {
    this.id=id;
    this.token="";
    this.nombre=nombre;
    this.wsclient = undefined;
    this.partida = undefined;
    this.colorId = 0;
    this.ficha = "Clásico";
    this.fichaEstado = Jugador.FICHA_ESTADO_ESPERAR;
    this.listo = false;
    this.isHost = false;
    this.posicion = 60;
    this.numTarjSueldo = 1;
    this.efectivo = 20.0;
    this.utilidadAnual = 0.0;
    this.pagares = [true,true,true,true,true];
    this.bancaRota = false;
    this.turnosDescanso = 0;
    this.deuda = 0.0;
    this.orden = 0;
    this.posRelativa = -1; // la posición dentro de casilla.
    this.fichaTransform = undefined;
    this.f1 = false; //para indicar si ha terminado la animación local de lanzamiento Dados
    this.titulos = [];
  }

  minify(){
    let strp = JSON.stringify(this,(key,value)=>{
      if (key=="wsclient") return undefined;
      if (key=="partida") return (value?value.id:undefined);
      return value;
    });
    let copia = JSON.parse(strp);
    return copia;
  }

  reset(){
    this.posicion = 60;
    this.fichaEstado = Jugador.FICHA_ESTADO_ESPERAR;
    this.numTarjSueldo = 1;
    this.efectivo = 20.0;
    this.utilidadAnual = 0.0;
    this.pagares = [true,true,true,true,true];
    this.bancaRota = false;               
    this.turnosDescanso = 0;                
    this.deuda = 0.0;
    this.orden = 0;
    this.titulos = [];
  }
  tiene(idTitulo){
    return this.titulos.find( t => {return t.id == idTitulo});
  }
  /**
   * Calcular posición y postura según si es jugador actual o no
   */
  setPosicionInicial(){
    if(this.id == this.partida.jugadorActual.id){
      this.activarFicha();
    }else{
      this.reposarFicha();
    }
  }

  evaluarCambioCamino(idcasilla) {
    const casDef = this.partida.tablero.casillerosDef.items;
    const rutaEsp = casDef[this.posicion].rutaEspecial;
    let ruta;
    //si la casilla seleccionada está 2 espacios
    if(rutaEsp && rutaEsp.ruta[rutaEsp.ruta.length-1]==idcasilla){
        ruta = new Ruta(rutaEsp.ruta,0);
    }else{
        ruta = new Ruta([this.posicion,idcasilla],0);
    }
    console.log(JSON.stringify(ruta));

    //se almacena estado inicial antes de cambiar carril para cuando este seael finalizar el turno.
    this.partida.estadoInicial = this.partida.estado;
    this.fichaEstado = Jugador.FICHA_ESTADO_ESPERAR;
    this.partida.tablero.limpiar();
    this.partida.estado = PE.CAMINANDO;

    return ruta;
  }
  avanzarCaminata(ruta){
    const numSegmentos = 10; //20
    const casDef = this.partida.tablero.casillerosDef.items;
    const Vangle = new THREE.Vector3();
    const P = new THREE.Vector3();
    const temp = new THREE.Matrix4();
    const transformacion = new THREE.Matrix4();
    let [ini,fin,iSegmento,iCasillaActual] = [0,0,0,0];
    //console.log(`avanzarCaminata: ${JSON.stringify(ruta)}`);
    this.fichaEstado = Jugador.FICHA_ESTADO_CAMINAR;
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
            this.posicion = idCasillaActual;
            this.fichaTransform = transformacion.toArray();
            this.transmitir();
            //console.log("caminando...");
        }else{
            clearInterval(intervalID);
            this.terminarCaminata(ruta,false);
        }
    },150);
  }
  /**
   * Actualiza el estado de la ficha y limpia el tablero
   */
  iniciarCaminata(){
    this.fichaEstado = Jugador.FICHA_ESTADO_CAMINAR;
    this.partida.tablero.limpiar();
  }
  /**
   * @param ruta la ruta que caminó
   * @param forzado flag para indicar si la animación de caminanta fue terminada anticipadamente
   */
  terminarCaminata(ruta,forzado){
    //setEnable(false);
    //ServicioPartida.SP().terminarCaminata(forzado);
    this.fichaEstado = Jugador.FICHA_ESTADO_ESPERAR;
    this.partida.estado = PE.EVALUANDO_DESTINO;
    this.partida.transmitir();
    //se espera antes de proceder con la evaluación de la casilla para apreciar donde cayó
    setTimeout(() => {
        this.evaluarDestino(ruta);
        this.partida.transmitir();
    }, 500);
  }
  evaluarDestino(ruta) {    
    if(ruta.getLongitud()!=7){ //NO es feriado
        this.evaluarFinCaminoLaboral(ruta);
    }else{ //es un feriado
        // $dialogo = new Dialogo();
        // $dialogo->abrir($idpartida, Dialogo::AVISO_FERIADO, "Es feriado. Puedes descansar...zzZ", $cnn);
        console.log("pendiente implementar Feriado");
        this.evaluarFinCaminoLaboral(ruta);
    }
  }
  evaluarFinCaminoLaboral(ruta) {
    //$this->cobrarSueldo($idpartida,$jugador,$ruta->numMeses,$cnn); //cobrar sueldo por los meses pasados
    //if($partida->evaluarGanador($idpartida, $cnn)) return;
    this.partida.tablero.procesarCasilla(this,ruta); //procesa CASILLA ACTUAL
  }
  evaluarSeleccionCamino(idcasilla) {
    //this.partida.tablero.limpiar();
    this.iniciarCaminata();
    this.partida.estado = PE.CAMINANDO;
    const rutas = this.partida.rutas;
    //eliminar variable
    this.partida.rutas = undefined;
    //console.log(`las rutas a elegir son ${JSON.stringify(rutas)}`);
    const ruta = (rutas.principal.getFin()==idcasilla?rutas.principal:rutas.secundario);    
    //console.log(`la rutas elegida es ${JSON.stringify(ruta)}`);
    return ruta;
  }
  /**
   * Devuelve FALSE si el siguiente jugador debe descansar en los demas casos de vuelve TRUE.
   */
  terminarTurno() {    
    //Limpiar acción de FUSIÓN no finalizada
    //$variable->tomar($idpartida, "fusionT0", $cnn);
    this.partida.tablero.limpiar();

    //calcular siguiente jugador y asignar animación de ficha correspondiente
    let jActual = this.partida.getJugadorSiguiente(this.orden);
    this.partida.jugadorActual = jActual;
    this.reposarFicha();
    jActual.activarFicha();
    
    //validar jugadores con turnos de descanso
    if(jActual.turnosDescanso>=1){
      console.log("pendiente implementar cuando hay turnos descansando");
        // $jActual->reducirDescanso($jActualId,$cnn);            
        // $msj = "@j$jActual->id descansará 1 turno mas...";
        // $dialogo = new Dialogo();
        // $dialogo->abrir($idpartida, Dialogo::AVISO_DESCANSO, $msj, $cnn);
        return false;
    }else{
      this.partida.tablero.limpiar();
      this.partida.tablero.permitirCambiarCarril(jActual.posicion);
      this.partida.d1Ix=undefined;
      this.partida.d2Ix=undefined;
      this.partida.dVal=undefined;
      //this.partida.btnAccion=Partida.BOTON_ACCION_LANZAR;
      return true;
    }
  }
  activarFicha(){
    let transformacion = new THREE.Matrix4();
    transformacion.makeRotationY(-Math.PI/2);
    const csl = this.partida.tablero.casillerosDef.items[this.posicion];
    let p = new THREE.Matrix4();
    p.makeTranslation(csl.coords);
    transformacion.premultiply(p);
    this.fichaTransform = transformacion.toArray();
    this.fichaEstado = Jugador.FICHA_ESTADO_SALUDO;
    this.posRelativa = -1;
    this.partida.tablero.updatePosInternasCasilla();
  }
  reposarFicha(){
    const csl = this.partida.tablero.casillerosDef.items[this.posicion];
    const iLibre = this.partida.tablero.getPosicionLibre(this.posicion);
    let transformacion = new THREE.Matrix4();
    transformacion.makeRotationY(csl.giro*Math.PI/180.0);
    let vpi = CA_POS_INTERNAS[iLibre];
    let p = new THREE.Matrix4();
    p.makeTranslation(vpi[0],vpi[1],vpi[2]);
    transformacion.premultiply(p);
    p.makeTranslation(csl.coords);
    transformacion.premultiply(p);
    this.fichaTransform = transformacion.toArray();
    this.fichaEstado = Jugador.FICHA_ESTADO_ESPERAR;
    this.posRelativa = iLibre;
    this.partida.tablero.updatePosInternasCasilla();
  }
  comprarTitulo(idtitulo,mitadPrecio){
    const titulo = this.partida.tablero.casillerosDef.items.find( c => {return c.id == idtitulo});
    const precio = titulo.precio/(mitadPrecio?2:1);
    if(precio <= this.efectivo){
        this.efectivo -= precio;
        this.adquirirTitulo(idtitulo);
        this.partida.tablero.entregarTitulo(this,idtitulo);
        //$partida->escribirNota($idpartida, "@j$this->id ha comprado $titulo->nombre por @d$precio", $cnn);
        return true;
    }
    return false;    
  }
  adquirirTitulo(idtitulo){
    const jt = this.titulos.find( t => {return t.id == idtitulo});
    if(jt){
      jt.num++;
    }else{
      this.titulos.push({id:idtitulo,num:1});
    }
    this.calcularUtilidadAnual();
  }
  calcularUtilidadAnual(){
    console.log("Pendiente: Implementar cálculo de Utilidad Anual");
    this.utilidadAnual += 0.1;
    // $res = $cnn->consultar("SELECT T.totalUtiInv + T.totalUtiInv*T.esCientifico + T.numTituInv*5*T.esEconomista + T.esAbogado*50 + T.esMedico*50 AS utilidades ".
    //                        "FROM (" .
    //                        "         SELECT SUM(CASE WHEN C.tipo = 2 THEN CONVERT(TRIM(REPLACE(SUBSTR(SUBSTRING_INDEX(C.utilidades, ',', TJ.num),LENGTH(SUBSTRING_INDEX(C.utilidades, ',', TJ.num - 1))+2),']','')),FLOAT) ELSE 0 END ) AS totalUtiInv, ".
    //                        "                SUM(CASE WHEN C.tipo = 2 THEN TJ.num ELSE 0 END) AS numTituInv,".
    //                        "                SUM(CASE WHEN C.id = 34 THEN 1 ELSE 0 END) AS esCientifico,".
    //                        "                SUM(CASE WHEN C.id = 26 THEN 1 ELSE 0 END) AS esEconomista,".
    //                        "                SUM(CASE WHEN C.id = 22 THEN 1 ELSE 0 END) AS esAbogado,".
    //                        "                SUM(CASE WHEN C.id = 8  THEN 1 ELSE 0 END) AS esMedico ".
    //                        "        FROM mls_jugador_titulos TJ INNER JOIN mls_casillas C ON TJ.idtitulo = C.id ".
    //                        "        WHERE TJ.idjugador=$idjugador ".
    //                        "        GROUP BY TJ.idjugador ".
    //                        ") AS T");
    // $utilidades = 0;
    // if(mysqli_num_rows($res)>0){
    //     $row = mysqli_fetch_row($res);
    //     $utilidades = (float)$row[0];
    // }
    
    // $cnn->consultar("UPDATE mls_jugador SET utilidadAnual=$utilidades WHERE id = $idjugador");        
  }
  pagarUtilidades(idAcreedor,titInfo){
    const acreedor = this.partida.jugadores.find( j=> {return j.id == idAcreedor});
    const jt = acreedor.tiene(titInfo.id);
    let utilidades = 0;
    //sumar utilidades de propieddad
    utilidades += titInfo.utilidades[jt.num-1];
    //duplicar cientifico
    utilidades += utilidades*(acreedor.tiene(CA.CIENTIFICO)?1:0);
    //sumar economista
    utilidades += jt.num*(acreedor.tiene(CA.ECONOMISTA)?5:0);
    //pagar obligaciones
    return this.pagar([acreedor],utilidades);
  }
  pagar(acreedores,pago){
    if(acreedores.length==0){ //pagar al banco
        if(pago<=this.efectivo){
          this.efectivo-=pago;
          return `@j${this.id} ha pagado @d${pago} al BANCO`;
        }
    }else{ //pagar a jugadores
        const pagoReal = pago*acreedores.length;
        let nombres="";
        if(pagoReal<=this.efectivo){
            acreedores.forEach(acreedor => {
                nombres+=`@j${acreedor.id}, `;
                acreedor.efectivo+=pago;
                this.efectivo-=pago;
            });
            nombres = this.decorarNombres(nombres);
            return `@j${this.id} ha pagado @d${pagoReal} a ${nombres}`;
        }
    }
    return false;
  }
  /**
   * Se espera una lista de nombres con el formato: nombre1, nombre2, nombre3, ...
   */
  decorarNombres(nombresRaw){
    //borrar el último concatenador ", "
    let nombres = nombresRaw.substring(0,nombresRaw.length-2);
    //ubicar el último indices de ","
    const i = nombres.lastIndexOf(",");
    //reemplazar la última "," con " y"
    if(i>=0) nombres = nombres.substring(0,i)+" y".nombres.substring(i+1);
    
    return nombres;
  }  
  /**
   * Envia estado PARCIAL del juego con los datos de un jugador a todos los jugadores de la partida actual.
   */
  transmitir(){
    this.partida.jugadores.forEach( j => {
        let rsp = {type:"game",content:{jugador:this.minify(),msj:""}};
        j.wsclient.send(JSON.stringify(rsp));
    });
  }
}

module.exports = Jugador;