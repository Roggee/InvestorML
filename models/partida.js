const Jugador = require("./jugador");
const Tablero = require("./tablero");
const Rutas = require("./rutas");
const {PE,TABLA_DADOS,DIAG_TIPO,CA, CA_TIPO} = require("./valores");
const Dialogo = require("./dialogo");
const Ruta = require("./ruta");

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
      this.ganador = undefined; //si es está definido entonces hay un ganador
      this.numJugadores = 0;
      this.jugadores = [];
      this.tablero = undefined;
      this.dialogos = [];
      this.mensajes = [];
      this.horaInicio = undefined;
      this.L = [];
    }
    minify(){
      let strp = JSON.stringify(this,(key,value)=>{
        if (["wsclient","token","casillerosDef","f1","posInternas","horaInicio"].includes(key)) return undefined;
        if (key=="host") return value.id;
        if (key=="partida") return (value?value.id:undefined);
        if (["jugadorActual","ganador","jbk"].includes(key)) return (value?value.id:undefined);
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
      jugador.devolverTitulos();
      jugador.partida = undefined;
      jugador.isHost = false;
      jugador.listo = false;
      //jugador.ficha ="Clásico";
      //Se agrega el jugador a la lista de perdedores
      this.L.push({id:jugador.id,nombre:jugador.nombre,colorId:jugador.colorId});
      this.jugadores = this.jugadores.filter( j => j !== jugador);
      this.numJugadores=this.jugadores.length;
      //si no hay jugadores termina función
      if(this.numJugadores == 0) return;
      //si no hay jugador actual
      if(this.jugadorActual.id == jugador.id){
        this.jugadorActual = this.getJugadorSiguiente(jugador.orden);
      }
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
      //asignar nuevo orden y posicion interna nula
      this.jugadores.forEach((j,index) => {
        j.orden = array[index];
        j.posRelativa = -1;
      });
    }
    /**
     * Se define el jugador actual
     */
    iniciar(){
      this.mensajes = [];
      this.horaInicio = new Date();
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
      this.jugadorActual.setPosicionInicial();
      this.estado = PE.INICIO_TURNO;
      this.d1Ix = undefined;
      this.d2Ix = undefined;
      this.dVal = undefined;
    }

    lanzarDados(valor){
      this.tablero.limpiar();
      this.jugadores.forEach(j => j.f1 = false);
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
     * Cambia el estado de la partida a FINALIZANDO_TURNO
     */
    finalizarTurno(){
      const nuevo_estado = PE.FINALIZANDO_TURNO;      
      if(nuevo_estado == this.estado){
        console.log(`La partida ${this.id} ya se encuentra en estado ${nuevo_estado}`);
        return;
      }
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
        this.escribirNota(`@j${jGanador.id} ha ganado la partida.`);
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
        return this.jugadorActual;
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
        this.escribirNota(`@j${jugador.id} descansará ${jugador.turnosDescanso} turnos`);
      }else{
        const idacreedores = [];
        titulo.poseedores.forEach(profesional => {
          if(jugador.id != profesional){
            idacreedores.push(profesional);
          }
        });
        if(idacreedores.length == 0){
          this.escribirNota(`@j${jugador.id} es el único ${titulo.nombre}`);
          this.finalizarTurno();
        }else{
          const acreedores = this.jugadores.filter( j=> { return idacreedores.includes(j.id)});
          const montopago = this.reglas.pagoAsistenciaProf;
          const resultado = jugador.pagar(acreedores,montopago);
          const dialogo = new Dialogo(this);
          if(resultado){ //se la logrado pagar la deuda
              dialogo.abrir(DIAG_TIPO.PAGO_JUGADOR, {texto:resultado});
              this.escribirNota(resultado);
          }else{ //no se pudo pagar la deuda. Insolvente
              dialogo.abrir(DIAG_TIPO.DECLARAR_BANCAROTA,{iddeudor:jugador.id, idacreedores:idacreedores, deuda: montopago*idacreedores.length});
          }                
        }
      }        
    }
    evaluarOportunidadOferta(jugador,color,casilla) {
      const colores = [];
      colores["c"] = ["CELESTE",DIAG_TIPO.NO_CELESTES];
      colores["r"] = ["ROSADAS",DIAG_TIPO.NO_ROSADAS];
      const cantidad = this.tablero.mostrarTitulosDisponibles(jugador, color);
      if(cantidad!=0){
          this.caso = casilla.id;
          this.estado = PE.COMPRANDO_OF_OP;
      }else{
          const dialogo = new Dialogo(this);
          const colorInfo = colores[color];
          dialogo.abrir(colorInfo[1], {texto:`No hay inversiones ${colorInfo[0]} disponibles`});
      }
    }
    evaluarCompraOFOP(jugador, idtitulo) {
      const casilla = this.tablero.casillerosDef.items[idtitulo];
      const precio = casilla.precio/(this.caso!=CA.OPORTUNIDAD?2:1);
      const dialogo = new Dialogo(this);
      dialogo.abrir(DIAG_TIPO.COMPRAR_TITULO,{id:idtitulo,precio:precio});
      this.tablero.limpiar();
    }
    evaluarDepresion(jugador) {
      const numTitulos = jugador.getNumTitulos();
      const dev = Math.floor(numTitulos/2);
      if(dev>0) {
          const grpOrigen = JSON.parse(JSON.stringify(jugador.titulos));
          const contenido = {pendientes: dev,grpOrigen: grpOrigen,grpDestino:[],nf:Math.ceil(jugador.titulos.length/6)};
          const dialogo = new Dialogo(this);
          dialogo.abrir(DIAG_TIPO.DEVOLVER_TITULOS,contenido);
      }else{
          this.escribirNota(`@j${jugador.id} no tiene títulos para devolver`);
          this.finalizarTurno();
      }  
    }
    entregarTitulo(idg,tituloId){
      const dialogo = this.dialogos.find( d=>{return d.id==idg});
      if(!dialogo){
        return `El dialogo ${idg} no existe`;
      }
      if(dialogo.contenido.pendientes==0){
        return `No hay titulos pendientes por entregar`;
      }
      //Descontar del origen
      const tituloInfoOrg = dialogo.contenido.grpOrigen.find( t=>{return t.id== tituloId});
      if(!tituloInfoOrg){
        return `El jugador no tiene el título ${tituloId}`;
      }
      tituloInfoOrg.num--;
      if(tituloInfoOrg.num==0){
          dialogo.contenido.grpOrigen = dialogo.contenido.grpOrigen.filter( t=>{return t.id != tituloId})
      }
      //Agregar al destino
      const tituloInfoDes = dialogo.contenido.grpDestino.find( t=>{return t.id== tituloId});
      if(tituloInfoDes){
          tituloInfoDes.num++;
      }else{
          dialogo.contenido.grpDestino.push({"id":tituloId,"num":1});
      }
      dialogo.contenido.pendientes--;
    }
    recuperarTitulo(idg,tituloId){
      const dialogo = this.dialogos.find( d=>{return d.id==idg});
      if(!dialogo){
        return `El dialogo ${idg} no existe`;
      }   
      //Descontar del destino
      const tituloInfoDes = dialogo.contenido.grpDestino.find( t=>{return t.id== tituloId});
      if(!tituloInfoDes){
        return `El jugador no ha entregado el título ${tituloId}`;
      }      
      tituloInfoDes.num--;
      if(tituloInfoDes.num==0){
          dialogo.contenido.grpDestino = dialogo.contenido.grpDestino.filter( t=>{return t.id != tituloId})
      }
      //Agregar al origen
      const tituloInfoOrg = dialogo.contenido.grpOrigen.find( t=>{return t.id== tituloId});
      if(tituloInfoOrg){
        tituloInfoOrg.num++;
      }else{
          dialogo.contenido.grpOrigen.push({"id":tituloId,"num":1});
      }
      dialogo.contenido.pendientes++;
    }
    evaluarFusion(jugador) {
      const numTitulos = jugador.getNumTitulos(CA_TIPO.TITULO_INVR);
      if(numTitulos>0){// tiene titulos para intercambiar?
          const numDisponibles = this.tablero.mostrarTitulosDisponibles(jugador,'rcv');
          if(numDisponibles>0){
              this.tablero.mostrarTitulosDe(jugador);
              this.estado = PE.FUSIONANDO;
              const dialogo = new Dialogo(this);
              dialogo.abrir(DIAG_TIPO.FUSIONANDO);
          }else{
              this.tablero.limpiar();
              this.escribirNota("No hay inversiones disponibles");
              this.finalizarTurno();
          }
      }else{
          this.escribirNota(`@j${jugador.id} no posee títulos de inversion para intercambiar`);
          this.finalizarTurno();
      }
    }
    evaluarFusionaTitulo(jugador, idtitulo) {
      let idtitulo0 = this.fusionT0;
      if(!idtitulo0){
          let tit = jugador.tiene(idtitulo);
          if(tit){
            this.fusionT0 = idtitulo;            
            if(!this.fusionT1){
              this.tablero.mostrarTitulosDisponibles(jugador,"rcv", idtitulo);
            }else{
              this.tablero.limpiar();
            }
          }else{
            return "Debes elegir un título tuyo primero";
          }
      }else {
        let idtitulo1 = this.fusionT1;
        if(!idtitulo1){
          if(idtitulo1==idtitulo0){
            return "No puedes intercambiar el mismo título";
          }
          let tit = this.tablero.titulos.filter(t => {
            const casDef = this.tablero.casillerosDef.items.find( cd => {return cd.id == idtitulo});
            return t.cantDisponible>0 && (t.poseedores.includes(jugador.id) || t.poseedores.length==0 ) && casDef.tipo == CA_TIPO.TITULO_INVR && t.id == idtitulo1;
          });
          if(tit){
            this.fusionT1 = idtitulo;
            this.tablero.limpiar();
          }else{
            return "El título seleccionado no está disponible";
          }
        }else{
          return "Acción de fusión no válida";
        }
      }
    }
    fusionarTitulos(jugador){
      if(!this.fusionT0 || !this.fusionT1){
        return "No se han definido los títulos para fusionar";
      }
      jugador.devolverTitulo(this.fusionT0,1);
      jugador.adquirirTitulo(this.fusionT1);
      const titulo0 = this.tablero.casillerosDef.items.find( cd => {return cd.id == this.fusionT0});
      const titulo1 = this.tablero.casillerosDef.items.find( cd => {return cd.id == this.fusionT1});
      this.escribirNota(`@j${jugador.id} ha intercambiado ${titulo0.nombre} por ${titulo1.nombre}`);
      this.fusionT0 = undefined;
      this.fusionT1 = undefined;
    }
    evaluarPagoImpuestos(jugador){
      const numTitulos = jugador.getNumTitulos();
      if(numTitulos==0){
          this.escribirNota(`@j${jugador.id} no posee títulos para pagar tributos`);
          this.finalizarTurno();
          return;
      }
      const montoPago = numTitulos*this.reglas.tributos;
      const acreedores = []; //se le debe pagar al banco
      const resultado = jugador.pagar(acreedores, montoPago);
      const dialogo = new Dialogo(this);
      if(resultado){ //se la logrado pagar la deuda
          dialogo.abrir(DIAG_TIPO.PAGO_JUGADOR, {texto: resultado});
          this.escribirNota(resultado);
      }else{ //no se pudo pagar la deuda. Insolvente
          dialogo.abrir(DIAG_TIPO.DECLARAR_BANCAROTA,{iddeudor:jugador.id, idacreedores:acreedores, deuda: montoPago});          
      }      
    }
    evaluarCierreComodin(casilla, jugador) {
      switch (casilla.id) {
        case CA.VOLVER_TIRAR_DADOS_INI: 
        case CA.VOLVER_TIRAR_DADOS_FIN:
          this.lanzarDados();
          break;
        case CA.HOSPITAL:
        case CA.JUSTICIA:
          this.evaluarHospitalYJusticia(jugador,casilla);
          break;
        case CA.AUMENTO_SUELDO:
          jugador.aumentarSueldo();
          this.finalizarTurno();
          this.escribirNota(`@j${jugador.id} ha recibido una nueva Tarjeta de sueldo`);
          break;
        case CA.OPORTUNIDAD: //Comprar inversiones Celestes
          this.evaluarOportunidadOferta(jugador,"c",casilla);
          break;
        case CA.OFERTA: //Comprar inversiones Rosadas Mitad de Precio
          this.evaluarOportunidadOferta(jugador,"r",casilla);
          break;
        case CA.INFLACION : //Pierde la mitad de su dinero efectivo
          const devuelto = jugador.aplicarInflacion();
          this.escribirNota(`@j${jugador.id} ha perdido @d${devuelto} de su dinero efectivo`);
          this.finalizarTurno();
          break;
        case CA.MORATORIA:
          const cantidad = jugador.recuperarPagares();
          if(cantidad>0){
              this.escribirNota(`@j${jugador.id} ha recuperado ${cantidad} de sus pagares`);
          }else{
              this.escribirNota(`@j${jugador.id} no ha usado ninguno de sus pagares`);
          }
          this.finalizarTurno();
          break;
        case CA.DEPRESION:
          thia.evaluarDepresion(jugador);
            break;                 
        case CA.FUSION:
          this.evaluarFusion(jugador);
          break;                        
        case CA.PAGUE_IMPUESTO:
          this.evaluarPagoImpuestos(jugador);
          break;
        case CA.GANA_JUICIO:
          this.evaluarGanaJuicio(jugador);
          break;
        case CA.PAGUE_DIVIDENDOS: // PAGAR 20 A CADA JUGADOR
          this.evaluarPagarDividendos(jugador);
          break;                        
        case CA.PERDIO_TRABAJO:
            // $jugador->perderTrabajo($idjugador,$cnn);
            this.finalizarTurno();
            this.escribirNota(`@j${jugador.id} ha perdido todas sus tarjetas de sueldo`);
            break;                        
        case CA.BONANZAS:
        case CA.DIO_EN_LA_VETA:
            this.evaluarRegalosDelBanco(jugador,40);
            this.finalizarTurno();
            break;                                                
        case CA.EXCELENTE_COSECHA:
            this.evaluarRegalosDelBanco(jugador,20);
            this.finalizarTurno();
            break;
        case CA.FRACASO:
            // $this->evaluarFracaso($idpartida,$idjugador,$cnn);
            console.log("pendiente: evaluarFracaso");
            this.finalizarTurno();
            break;
        case CA.ESTA_PERDIDO: //ESTA PERDIDO
            // $this->evaluarEstaPerdido($idpartida,$idjugador,$cnn);
            console.log("pendiente: evaluarEstaPerdido");
            this.finalizarTurno(); 
            break;
        default: //avanzar o retroceder
            const ruta = casilla.rutaEspecial;
            if(ruta){
                const rutaE = casilla.rutaEspecial;
                this.iniciarCaminata(new Ruta(rutaE.ruta,rutaE.nm));
            }else{
                return `casilla ${casilla.id} no tiene un ruta especial`;
            }
            break;
      }
    }
    evaluarGanaJuicio(jugador) {
      //calcular siguiente jugador habilitado
      const jSiguiente = this.getJugadorSiguiente(jugador.orden);
      if(jSiguiente.turnosDescanso>0){
          const dialogo = new Dialogo(this);
          dialogo.abrir(DIAG_TIPO.NO_INDEMNIZAR,{texto:`Esa indemnización tendrá que esperar. @j${jSiguiente.id} esta descansando.`});
          this.finalizarTurno();
          return;
      }
      //efectuar pago
      const montoPago = 40;
      const resultado = jSiguiente.pagar([jugador], montoPago);
      const dialogo = new Dialogo(this);
      if(resultado){ //se la logrado pagar la deuda
          dialogo.abrir(DIAG_TIPO.PAGO_JUGADOR, {texto: resultado});
          this.escribirNota(resultado);
      }else{ //no se pudo pagar la deuda. Insolvente
          this.jbk = jugador;
          this.jugadorActual = jSiguiente;
          dialogo.abrir(DIAG_TIPO.DECLARAR_BANCAROTA,{iddeudor:jSiguiente.id, idacreedores:[jugador.id], deuda: montoPago});
      }        
    }
    evaluarPagarDividendos(jugador) {
      //calcular todos los jugjugadoradores a los que se les pagará
      const acreedores = [];
      const idacreedores = [];
      let jSiguiente = this.getJugadorSiguiente(jugador.orden);
      while(jSiguiente.id!=jugador.id){
          if(jSiguiente.turnosDescanso==0){
            acreedores.push(jSiguiente);
            idacreedores.push(jSiguiente.id);
          }
          jSiguiente = this.getJugadorSiguiente(jSiguiente.orden);
      }
      //efectuar pago
      const montoPago = 20;
      const montoTotal = montoPago*idacreedores.length;
      const resultado = jugador.pagar(acreedores, montoPago);
      const dialogo = new Dialogo(this);
      if(resultado){ //se la logrado pagar la deuda
          dialogo.abrir(DIAG_TIPO.PAGO_JUGADOR, {texto: resultado});
          this.escribirNota(resultado);
      }else{ //no se pudo pagar la deuda. Insolvente
          dialogo.abrir(DIAG_TIPO.DECLARAR_BANCAROTA,{iddeudor:jugador.id, idacreedores:idacreedores, deuda: montoTotal});
      }         
    }    
    evaluarRegalosDelBanco(jugador, monto) {
      jugador.cobrarDinero(monto);
      this.escribirNota(`@j${jugador.id} ha cobrado @d${monto} al Banco`);
      if(!this.evaluarGanador()){
          this.finalizarTurno();
      }
    }
    escribirNota(msj){
      const ahora = new Date();
      const diff = new Date(ahora - this.horaInicio);
      const options = {hour: "2-digit",minute: "2-digit",second: "2-digit",timeZone: 'UTC'};
      const marca = diff.toLocaleTimeString("en-GB",options);
      this.mensajes = [`[${marca}] ${msj}`,...this.mensajes];
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