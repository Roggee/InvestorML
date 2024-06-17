const Casillas = require('./casillas');
const Ruta = require('./ruta');
const THREE = require('three');
const {PE,CA_POS_INTERNAS} = require("./valores");

class Jugador{
  static FICHA_ESTADO_ESPERAR = 1;
  static FICHA_ESTADO_CAMINAR = 0;
  static FICHA_ESTADO_SALUDO  = 2;

  constructor(id,nombre) {
    this.id=id;
    this.token="";
    this.nombre=nombre;
    this.wsclient = null;
    this.partida = null;
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