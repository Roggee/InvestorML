class Partida {
    static PQT_COMPLETO             =   1;
    static PQT_CAMINANDO            =   2;
    static PQT_VTNTITULOS           =   3;
    
    static PREPARACION              = "I";
    static INICIANDO                = "N";
    static INICIO_TURNO             = "J";
    static FORZANDO                 = "F";
    static LANZANDO                 = "R";
    static CAMINANDO                = "C";
    static DECIDIENDO_CAMINO        = "D";
    static COMPRANDO_OF_OP          = "S";
    static FINALIZANDO_TURNO        = "Z";
    static EVALUANDO_DESTINO        = "V";
    static ESPERAR_TURNO            = "E";
    static GANADOR                  = "G";
    static FUSIONANDO               = "U";
    static FRACASANDO               = "A";
    static DECIDIENDO_SUERTE        = "T";
    static FIN_CAMINATA_FORZADA     = "M";
    
    static BOTON_ACCION_LANZAR      =   0;
    static BOTON_ACCION_CONTINUAR   =   1;
    static BOTON_ACCION_TERMINAR    =   2;

    static colores = [
      { id: 0, nombre: "Rojo", valor: "#9C1E2E" },
      { id: 1, nombre: "Celeste", valor: "#30A4E3" },
      { id: 2, nombre: "Verde", valor: "#8EB926" },
      { id: 3, nombre: "Azul", valor: "#3651AD" },
      { id: 4, nombre: "Amarillo", valor: "#EFD200" },
      { id: 5, nombre: "Lila", valor: "#8046DB" },
      { id: 6, nombre: "Naranja", valor: "#FF8000" },
    ];
    //const tablaDados = array(array(0,2,3,1,2,0),array(0,2,4,1,3,0));

    constructor(id,nombre) {
      this.id=id;
      this.nombre=nombre;
      this.estado="I";
      this.maxJugadores=6;
      this.reglas=null;
      this.host=null;
      this.dado1Indice=-1;
      this.dado2Indice=-1;
      this.dadosValor=-1;
      this.jugadorActual=null;
      this.btnAccion = Partida.BOTON_ACCION_LANZAR;
      this.ganador = 0; //si es diferente de cero entonces hay un ganador
      this.numJugadores = 0;
      this.jugadores = [];
    }
    minify(){
      let strp = JSON.stringify(this,(key,value)=>{if (key=="wsclient" || key=="token") return undefined;return value;});
      let copia = JSON.parse(strp);
      return copia;
    }
    agregarJugador(jugador){
      jugador.idpartida = this.id;
      jugador.colorId = this.getNextColor();
      this.jugadores.push(jugador);
      this.numJugadores=this.jugadores.length;
    }
    eliminarJugador(jugador){
      jugador.idpartida = 0;
      this.jugadores = this.jugadores.filter( j => j !== jugador);
      this.numJugadores=this.jugadores.length;
    }
    getNextColor(){
      const cs = Partida.colores.find( c => {
                  return !this.jugadores.find( j => j.colorId == c.id);
                });
      console.log(`se asignó el color ${cs.nombre}`);
      return cs.id;
    }
}

module.exports = Partida;