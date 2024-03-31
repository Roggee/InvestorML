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
}

module.exports = Jugador;