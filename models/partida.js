const Jugador = require("./jugador");
const Tablero = require("./tablero");

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
      this.maxJugadores=2;
      this.reglas={
        modoVictoria: "lf",
        limiteFortuna: 1000,
        pararAnioNuevo: true,
        repetirAnioNuevo: false,
        turnosDescansando: 2,
        pagoAsistenciaProf: 5,
        salario: 0.5,
        tributos: 5,
      }
      this.host=null;
      this.dado1Indice=-1;
      this.dado2Indice=-1;
      this.dadosValor=-1;
      this.jugadorActual=null;
      this.btnAccion = Partida.BOTON_ACCION_LANZAR;
      this.ganador = 0; //si es diferente de cero entonces hay un ganador
      this.numJugadores = 0;
      this.jugadores = [];
      this.tablero = null;
    }
    minify(){
      let strp = JSON.stringify(this,(key,value)=>{
        if (key=="wsclient" || key=="token" || key=="casillerosDef") return undefined;
        if (key=="host") return value.id;
        if (key=="partida") return (value?value.id:undefined);
        if (key=="jugadorActual") return (value?value.id:undefined);
        return value;
      });
      let copia = JSON.parse(strp);
      return copia;
    }
    /**
     * 
     * @param {Jugador} jugador 
     * @returns true si el jugador pudo entrar. De lo contrario devuelve false si la partida ya esta llena
     */
    agregarJugador(jugador){
      if(this.maxJugadores == this.jugadores.length) return false;
      jugador.partida = this;
      jugador.colorId = this.getNextColor();
      jugador.isHost = (this.jugadores.length==0);
      this.jugadores.push(jugador);
      this.numJugadores=this.jugadores.length;
      if(this.jugadores.length==1)this.host=jugador;
      return true;
    }
    eliminarJugador(jugador){
      jugador.partida = null;
      jugador.isHost=false;
      jugador.listo=false;
      //jugador.ficha ="Clásico";
      this.jugadores = this.jugadores.filter( j => j !== jugador);
      this.numJugadores=this.jugadores.length;
      //si no hay jugadores termina función
      if(this.numJugadores == 0) return;
      //si no hay un host entonces asigna al primero de la lista
      if(!this.jugadores.find( j => j.isHost)){
        this.jugadores[0].isHost = true;
        this.host = this.jugadores[0];
      }
    }
    getNextColor(){
      const cs = Partida.colores.find( c => {
                  return !this.jugadores.find( j => j.colorId == c.id);
                });
      console.log(`se asignó el color ${cs.nombre}`);
      return cs.id;
    }
    setCondicionesIniciales(){
      this.jugadores.forEach( j => j.reset());
      //se asigna de forma aleatoria el orden de los jugadores.
      this.sortearOrdenYPosRelJugadores();
      //estado iniciando
      this.estado = Partida.INICIANDO;
    }
    sortearOrdenYPosRelJugadores(){
      //definir arreglo de consecutivos
      const array = Array.from({ length: this.jugadores.length }, (_, i) => i);
      //ordenar aleatoriamente
      for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
      }
      //asignar nuevo orden y posicion relativa igual a al orden por ser la primera vez.
      this.jugadores.forEach((j,index) => {
        j.orden = array[index];
        j.posRelativa = array[index];
      });
    }
    /**
     * Se define el jugador actual
     */
    iniciar(){
      this.jugadorActual = this.jugadores.find( j => j.orden == 0 );
      this.tablero = new Tablero(this);
      this.tablero.updatePosInternasCasilla();
      this.tablero.permitirCambiarCarril(this.jugadorActual.posicion);
      this.calcularCoordenadasIniciales();
      this.inicializarTurno();
    }
    /**
     * calcula las coordenadas iniciales de todos los jugadores de la partida indicada
     */  
    calcularCoordenadasIniciales(){
      this.jugadores.forEach(j => j.calcularTransformacionInicial());
    }
    /**
     * Cambia el estado de la partida a INICIO_TURNO y el boton de acción a Lanzar
     */
    inicializarTurno(){
      this.btnAccion = Partida.BOTON_ACCION_LANZAR;
      this.jugadorActual.fichaEstado = Jugador.FICHA_ESTADO_SALUDO;
      this.jugadorActual.calcularTransformacionInicial();
      this.estado = Partida.INICIO_TURNO;
    }
}

module.exports = Partida;