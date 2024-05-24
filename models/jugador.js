const Casillas = require('./casillas');
const THREE = require('three');

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
    this.fichaTransform = null;
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
  calcularTransformacionInicial(){
    let p = new THREE.Matrix4();
    let transformacion = new THREE.Matrix4();
    if(this.id == this.partida.jugadorActual.id){
      p.makeRotationY(-Math.PI/2);
    }else{
      let vpi = Casillas.POS_INTERNAS[this.posRelativa];
      transformacion.makeTranslation(vpi[0],vpi[1],vpi[2]);
      //console.log(`jugador `+this.nombre+` posInterna [`+vpi+'] por '+this.posRelativa);
    }
    transformacion.multiply(p);
    let csl = this.partida.tablero.casillerosDef.items[this.posicion];
    //console.log(`jugador `+this.nombre+` Coords [`+csl.coords+'] por '+this.posicion);
    p.makeTranslation(csl.coords);
    transformacion.premultiply(p);
    this.fichaTransform = transformacion.toArray();
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