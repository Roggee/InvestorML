const Jugador = require("./jugador");
const Tablero = require("./tablero");
const Rutas = require("./rutas");
const {PE,TABLA_DADOS,DIAG_TIPO,CA} = require("./valores");
const Dialogo = require("./dialogo");

class Partida {
    static PQT_COMPLETO             =   1;
    static PQT_CAMINANDO            =   2;
    static PQT_VTNTITULOS           =   3;
    
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

    constructor(id,nombre) {
      this.id=id;
      this.nombre=nombre;
      this.estado="I";
      this.estadoInicial=""; //para validar el estado previo al cambio de carrill en una evaluación de casilla
      this.maxJugadores=2;
      this.reglas={
        modoVictoria: "lf", // us: último sobreviviente, lf: límite de fortuna
        limiteFortuna: 1000,
        pararAnioNuevo: true,
        repetirAnioNuevo: false,
        turnosDescansando: 2,
        pagoAsistenciaProf: 5,
        salario: 0.5,
        tributos: 5,
      }
      this.host=undefined;
      this.d1Ix=undefined;
      this.d2Ix=undefined;
      this.dVal=undefined;
      this.jugadorActual=undefined;
      this.btnAccion = Partida.BOTON_ACCION_LANZAR;
      this.ganador = undefined; //si es está definido entonces hay un ganador
      this.numJugadores = 0;
      this.jugadores = [];
      this.tablero = undefined;
      this.dialogos = [];
    }
    minify(){
      let strp = JSON.stringify(this,(key,value)=>{
        if (["wsclient","token","casillerosDef","f1","posInternas"].includes(key)) return undefined;
        if (key=="host") return value.id;
        if (key=="partida") return (value?value.id:undefined);
        if (key=="jugadorActual"||key=="ganador") return (value?value.id:undefined);
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
      jugador.partida = undefined;
      jugador.isHost = false;
      jugador.listo = false;
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
      this.estado = PE.INICIANDO;
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
      this.setPosicionesIniciales();
      this.inicializarTurno();
    }
    /**
     * calcula las coordenadas iniciales de todos los jugadores de la partida indicada
     */  
    setPosicionesIniciales(){
      this.jugadores.forEach(j => j.setPosicionInicial());
    }
    /**
     * Cambia el estado de la partida a INICIO_TURNO y el boton de acción a Lanzar
     */
    inicializarTurno(){
      this.btnAccion = Partida.BOTON_ACCION_LANZAR;
      //this.jugadorActual.fichaEstado = Jugador.FICHA_ESTADO_SALUDO;
      this.jugadorActual.setPosicionInicial();
      this.estado = PE.INICIO_TURNO;
      this.d1Ix = undefined;
      this.d2Ix = undefined;
      this.dVal = undefined;
    }

    lanzarDados(valor){
      this.tablero.limpiar();
      let indice1 = Math.floor(Math.random()*5);
      let indice2 = Math.floor(Math.random()*5);
      if(valor != undefined){
        let m = -1;
        TABLA_DADOS[0].forEach((val,i) => {
          if(val <= valor && val>m) {
            indice1 = i;
            m = TABLA_DADOS[0][indice1];
          }
        });
        TABLA_DADOS[1].forEach((val,i) => {
          if(val+TABLA_DADOS[0][indice1] == valor) {
            indice2 = i;
          }
        });
      }
      console.log(`Los valores calculados son: ${TABLA_DADOS[0][indice1]} y ${TABLA_DADOS[1][indice2]}`);
      this.estado = PE.LANZANDO;
      this.d1Ix = indice1;
      this.d2Ix = indice2;
      this.dVal = TABLA_DADOS[0][indice1] + TABLA_DADOS[1][indice2];
    }
    
    validarResultadoDados() {
      const rutas = new Rutas();
      rutas.calcularRutas(this);
      const ruta1 = rutas.principal;
      //el desplazamiento es cero
      if(ruta1.getLongitud()==0){
        this.jugadorActual.terminarCaminata(ruta1);
        return;
      }
      //si solo hay un camino 
      if(rutas.getCantidadRutas()==1){
        this.iniciarCaminata(ruta1);
      }else{
        setTimeout(() => {
          this.rutas = rutas;
          this.tablero.mostrarCaminos(rutas);
          this.estado = PE.DECIDIENDO_CAMINO;
          this.transmitir();
        }, 500);
      }
    }
    /**
     * cambia el estado de la partida a CAMINANDO y lanza un temporizador para calcular cada paso
     */
    iniciarCaminata(ruta){
      this.estado = PE.CAMINANDO;
      this.transmitir();
      setTimeout(() => {          
        this.jugadorActual.avanzarCaminata(ruta);
      }, 500);
    }
    /**
     * Cambia el estado de la partida a FINALIZANDO_TURNO y el boton de acción a Terminar
     */
    finalizarTurno(){
      const nuevo_estado = PE.FINALIZANDO_TURNO;      
      if(nuevo_estado == this.estado){
        console.log(`La partida ${this.id} ya se encuentra en estado ${nuevo_estado}`);
        return;
      }
      //this.btnAccion = PE.BOTON_ACCION_TERMINAR;
      this.estado = nuevo_estado;
      console.log(`La partida ${this.id} a cambiado a ${nuevo_estado}`);
    }
    /**
     * Devuelve el jugador siguiente según el orden. Este no considera a los juagdores en banca rota.
     */
    getJugadorSiguiente(jAnterior_orden){
      let [min,max,sig] = [this.maxJugadores,-1,this.maxJugadores];
      this.jugadores.forEach(j => { 
        if(j.orden < min && !j.bancaRota) min = j.orden;
        if(j.orden > max && !j.bancaRota) max = j.orden;
        if(j.orden > jAnterior_orden && j.orden < sig && !j.bancaRota){
          sig = j.orden;
        }
      });
      if(sig>max) sig = min;
      const jSig = this.jugadores.find( j => {return j.orden == sig});
      return jSig;
    }
    /**
     * Verifica con las reglas del juego si ya se tiene un ganador por límite de fortuna. 
     * Si hay mas de un ganador entonces se elige al primero segun orden de juego.
     * También considera si sólo hay un jugador restante verificando si está en banca rota
     */
    evaluarGanador() {
      let jGanador = this.evaluarGanadorLimiteFortuna();
      if(!jGanador){
        jGanador = this.evaluarGanadorUltimoSobreviviente();
      }
      if(jGanador){
        jGanador.activarFicha();
        this.ganador = jGanador;
        this.jugadorActual = jGanador;        
        this.estado = PE.GANADOR;        
        const dialogo = new Dialogo(this);
        dialogo.abrir(DIAG_TIPO.GANADOR,{texto:`¡Felicitaciones, @j${jGanador.id} ha ganado!`});
        //$this->escribirNota($idpartida, "¡@j$idjugador ha ganado la partida!", $cnn);          
        return true;
      }
      return false;
    }
    evaluarGanadorLimiteFortuna() { 
      if( this.reglas.modoVictoria == "lf"){
        //Ganador por límite de fortuna
        const jGanador = this.jugadores.find( j => {return j.efectivo>= this.reglas.limiteFortuna && !j.bancaRota });
        return jGanador;
      }
    }

    evaluarGanadorUltimoSobreviviente() {
      //Ganador por último sobreviviente.
      const restantes = this.jugadores.filter( j => !j.bancaRota);      
      if(restantes.length==1){
          const jGanador = restantes[0];
          return jGanador;
      }
    }
    /**
     * Finaliza el turno actual. Define el jugador siguiente. Verifica si hay turnos de descanso. Inicia el siguiente turno.
     * Devuelve el siguiente jugador si este esta descansando.
     */
    avanzarTurno(){
      const jEnDescanso = this.jugadorActual.terminarTurno();
      if(!jEnDescanso) {
        this.estado = PE.INICIO_TURNO;
      }
      else{        
        console.log(`El jugador ${jEnDescanso.nombre} está descansando`);
        return jEnDescanso;
      }
    }
    evaluarHospitalYJusticia(jugador,casilla) {
      const idTitulo = (casilla.id==CA.HOSPITAL?CA.MEDICO:CA.ABOGADO);
      const titulo = this.tablero.titulos.find( t => {return t.id == idTitulo});
      if(titulo.poseedores.length==0){
        jugador.iniciarDescanso();
        this.avanzarTurno();
        //$partida->escribirNota($idpartida, "@j$idjugador descansará $jugador->turnosDescansado turnos", $cnn);
      }else{
        const idacreedores = [];
        titulo.poseedores.forEach(profesional => {
          if(jugador.id != profesional){
            idacreedores.push(profesional);
          }
        });
        if(idacreedores.length == 0){
          //$partida->escribirNota($idpartida, "@j$idjugador es el único $titulo->nombre", $cnn);
          this.finalizarTurno();
        }else{
          const acreedores = this.jugadores.filter( j=> { return idacreedores.includes(j.id)});
          const montopago = this.reglas.pagoAsistenciaProf;
          const resultado = jugador.pagar(acreedores,montopago);
          const dialogo = new Dialogo(this);
          if(resultado){ //se la logrado pagar la deuda
              dialogo.abrir(DIAG_TIPO.PAGO_JUGADOR, {texto:resultado});
              //$partida->escribirNota($idpartida, $resultado, $cnn);
          }else{ //no se pudo pagar la deuda. Insolvente
              dialogo.abrir(DIAG_TIPO.DECLARAR_BANCAROTA,{iddeudor:jugador.id, idacreedores:idacreedores, deuda: montopago*idacreedores.length});
          }                
        }
      }        
    }         
    /**
     * Envia estado COMPLETO del juego a todos los jugadores de la partida actual.
     */
    transmitir(){
      this.jugadores.forEach( j => {
          let rsp = {type:"game",content:{partida:this.minify(),msj:""}};
          j.wsclient.send(JSON.stringify(rsp));
      });
    }
}

module.exports = Partida;