const Casillas = require('./casillas');
const Ruta = require('./ruta');
const THREE = require('three');
const {PE,CA,CA_POS_INTERNAS,CA_TIPO, DIAG_TIPO} = require("./valores");
const { stringify } = require('uuid');
const Dialogo = require('./dialogo');

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
    this.isHost = false; //para definir quien puede configurar la partida antes de iniciar
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
    this.titulos = []; //{id,num}
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
        const dialogo = new Dialogo(this.partida);
        dialogo.abrir(DIAG_TIPO.FERIADO, {texto: "Es feriado. Puedes descansar...zzZ"});
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
   * Si el siguiente jugador está descansando entonces devuelve está instancia. Si no devuelve UNDEFINED
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
    //limpiar varialbes de turno
    this.partida.tablero.limpiar();
    this.partida.d1Ix=undefined;
    this.partida.d2Ix=undefined;
    this.partida.dVal=undefined;
    //validar jugadores con turnos de descanso
    if(jActual.turnosDescanso>=1){
      this.partida.estado = PE.DESCANSANDO;
      jActual.reducirDescanso();
      const msj = `@j${jActual.id} descansará 1 turno mas...`;
      const dialogo = new Dialogo(this.partida);
      dialogo.abrir(DIAG_TIPO.DESCANSO, {texto:msj});
      return jActual;
    }else{
      this.partida.tablero.permitirCambiarCarril(jActual.posicion);
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

  devolverTitulos(){
    while(this.titulos.length>0){
      const titulo = this.titulos[0];
      const tInfo = this.partida.tablero.titulos.find(t => {return t.id == titulo.id});
      //eliminar poseedor de titulo
      tInfo.poseedores = tInfo.poseedores.filter( p => {return p.id!=this.id});
      //sumar cantidad de titulos devueltos
      tInfo.cantDisponible += titulo.num;
      //eliminar titulo de la lista de titulos.
      this.titulos = this.titulos.filter( t => {return t.id!=titulo.id});
    }
    this.utilidadAnual = 0;
  }

  calcularUtilidadAnual(){
    this.utilidadAnual = 0;
    let cant = 0;
    this.titulos.forEach( t => {
      if(t.tipo == CA_TIPO.TITULO_INVR){
        const tInfo = this.partida.tablero.casillerosDef.items[t.id];
        const monto = tInfo.utilidades[t.num-1];
        this.utilidadAnual+=monto;
        cant+=t.num;
      }
    });
    //Aplicar Cientifico
    this.utilidadAnual += this.utilidadAnual*(this.tiene(CA.CIENTIFICO)?1:0);
    //Aplicar Economista
    this.utilidadAnual += cant*(this.tiene(CA.ECONOMISTA)?5:0);
    //Aplicar Abogado
    this.utilidadAnual += (this.tiene(CA.ABOGADO)?50:0);
    //Aplicar Médico
    this.utilidadAnual += (this.tiene(CA.MEDICO)?50:0);   
  }

  pagarUtilidades(idAcreedor,titInfo){
    const acreedor = this.partida.jugadores.find( j=> {return j.id == idAcreedor});
    let utilidades = this.calcularPago(idAcreedor,titInfo);
    //pagar obligaciones
    return this.pagar([acreedor],utilidades);
  }
  calcularPago(idAcreedor,titInfo) {
    const acreedor = this.partida.jugadores.find( j=> {return j.id == idAcreedor});
    const jt = acreedor.tiene(titInfo.id);
    let utilidades = 0;
    //sumar utilidades de propieddad
    utilidades += titInfo.utilidades[jt.num-1];
    //duplicar cientifico
    utilidades += utilidades*(acreedor.tiene(CA.CIENTIFICO)?1:0);
    //sumar economista
    utilidades += jt.num*(acreedor.tiene(CA.ECONOMISTA)?5:0);
    return utilidades;
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
  cobrarDinero(valor) {
    this.efectivo += valor;
  }
  iniciarDescanso() {
    this.turnosDescanso = this.partida.reglas.turnosDescansando;
  }
  reducirDescanso() {
    this.turnosDescanso--;
  }
  declararBancaRota(idsAcreedores,deudaTotal){
    let recaudado = this.efectivo;
    //acumula venta de titulos
    this.titulos.forEach( t => {
      const tInfo = this.partida.tablero.casillerosDef.items[t.id];
      recaudado+=tInfo.precio*t.num; 
    });
    //elimina títulos pertenecientes a este jugador
    this.devolverTitulos();    
    //pago a acreedores. Sólo si hay mas de 1. si la lista es cero entonces se asume se paga al banco
    if(idsAcreedores.length>0){
      let nombres = "";
      //calcular deuda individual por acreedor
      let prorateoDeuda = deudaTotal/idsAcreedores.length;
      //es necesario redondear el monto de pago a 0.5 según las denominaciones del banco (0.5)
      if(recaudado<deudaTotal) {
          prorateoDeuda = recaudado/idsAcreedores.length;
          const base = Math.floor(prorateoDeuda);
          let ajustado = base;
          if(prorateoDeuda - ajustado > 0.5) ajustado += 0.5;
          prorateoDeuda = ajustado;
      }
      idsAcreedores.forEach(idacreedor => {
          const acreedor = this.partida.jugadores.find(j => { return j.id == idacreedor});
          nombres+=`@j${acreedor.id}, `;
          acreedor.efectivo+=prorateoDeuda;
          recaudado-=prorateoDeuda;
      });
      nombres = this.decorarNombres(nombres);
      console.log(`declararBancaRota: el banco se quedó con ${recaudado*1000}`);
      console.log(`@j${this.id} trató de saldar su deuda con ${nombres}`);
      //$partida->escribirNota($jugador->idpartida, "@j$jugador->id trató de saldar su deuda con $nombres", $cnn);
    }
    
    //Los pagarés restantes no es dinero propio por lo tanto no se debe recaudar.
    //El orden se mantiene asignado para los cálculos posteriores.
    this.numTarjSueldo = 0;
    this.efectivo = 0;
    this.utilidadAnual = 0;
    this.bancaRota = true;
    this.turnosDescanso = 0;
    this.deuda = 0;
    this.pagares = [false,false,false,false,false];
    //reasignar host al siguiente
    if(this.isHost){ 
      this.isHost = false;
      const jSiguiente = this.partida.getJugadorSiguiente(this.orden);
      jSiguiente.isHost = true;
      this.partida.host = jSiguiente;
    }
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