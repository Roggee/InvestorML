class Jugador{
  constructor(id,nombre) {
    this.id=id;
    this.token="";
    this.nombre=nombre;
    this.wsclient = null;
    this.partida = null;
    this.ficha = "Clásico";
    this.colorId = 0;
    this.listo = false;
    this.isHost = false;
    this.posicion = 60;
    this.fichaEstado = 0;
    this.numTarjSueldo = 1;
    this.efectivo = 20.0;
    this.utilidadAnual = 0.0;
    this.pagares = [true,true,true,true,true];
    this.bancaRota = false;
    this.turnosDescanso = 0;
    this.deuda = 0.0;
    this.orden = 0; // tambión indica posición interna dentro de la casilla
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
    this.fichaEstado = 0;
    this.numTarjSueldo = 1;
    this.efectivo = 20.0;
    this.utilidadAnual = 0.0;
    this.pagares = [true,true,true,true,true];
    this.bancaRota = false;               
    this.turnosDescanso = 0;                
    this.deuda = 0.0;
    this.orden = 0;
  }
}

module.exports = Jugador;