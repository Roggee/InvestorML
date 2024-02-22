class Jugador{
  constructor(id,nombre) {
    this.id=id;
    this.token="";
    this.nombre=nombre;
    this.wsclient = null;
    this.idpartida = 0;
    this.ficha = "Clásico";
    this.listo = false;
  }

  minify(){
    let strp = JSON.stringify(this,(key,value)=>{if (key=="wsclient") return undefined;return value;});
    let copia = JSON.parse(strp);
    return copia;
  }
}

module.exports = Jugador;