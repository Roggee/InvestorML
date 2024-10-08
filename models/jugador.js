const Casillas = require('./casillas');
const Ruta = require('./ruta');
const THREE = require('three');
const {PE,CA,CA_TIPO, DIAG_TIPO} = require("./valores");
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
    this.titulos = []; //{id,num,util}
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
    this.cobrarSueldo(ruta.numMeses); //cobrar sueldo por los meses pasados
    if(this.partida.evaluarGanador()) return;
    this.partida.tablero.procesarCasilla(this,ruta.esCambioCarrilAnioNuevo(),ruta.esCambioCarrilFestividades()); //procesa CASILLA ACTUAL
  }
  evaluarSeleccionCamino(idcasilla) {
    //this.partida.tablero.limpiar();
    this.iniciarCaminata();
    this.partida.estado = PE.CAMINANDO;
    const rutas = this.partida.rutas;
    //eliminar variable
    this.partida.rutas = undefined;
    const ruta = (rutas.principal.getFin()==idcasilla?rutas.principal:rutas.secundario);  
    return ruta;
  }
  /**
   * Si el siguiente jugador está descansando entonces devuelve está instancia. Si no devuelve UNDEFINED
   */
  terminarTurno() {
    //limpiar acción de FUSIÓN no finalizada
    this.partida.fusionT0 = undefined;
    this.partida.fusionT1 = undefined;
    this.partida.tablero.limpiar();
    this.partida.dialogos=[];
    //calcular siguiente jugador y asignar animación de ficha correspondiente
    let jActual = this.partida.getJugadorSiguiente(this.orden);
    this.partida.jugadorActual = jActual;
    this.reposarFicha();
    jActual.activarFicha();    
    //limpiar variables de turno
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
    console.log(`${this.nombre} tiene la posición libre = ${iLibre}`);
    let transformacion = new THREE.Matrix4();
    transformacion.makeRotationY(csl.giro*Math.PI/180.0);
    let vpi = csl.posInternas[iLibre];
    let p = new THREE.Matrix4();
    p.makeTranslation(vpi);
    transformacion.premultiply(p);
    p.makeTranslation(csl.coords);
    transformacion.premultiply(p);
    this.fichaTransform = transformacion.toArray();
    this.fichaEstado = Jugador.FICHA_ESTADO_ESPERAR;
    this.posRelativa = iLibre;
    this.partida.tablero.updatePosInternasCasilla();
  }
    /**
     * @tipo uno de CA_TIPO.TITULO_INVR,CA_TIPO.TITULO_PROF
     */
  getNumTitulos(tipo){
    let numTitulos = 0;
    this.titulos.forEach( t => {
      const tInfo = this.partida.tablero.casillerosDef.items[t.id];
      if(tipo==undefined||tInfo.tipo == tipo){
        numTitulos+=t.num;
      }
    });
    return numTitulos;
  }  
  comprarTitulo(idtitulo,mitadPrecio){
    const titulo = this.partida.tablero.casillerosDef.items[idtitulo];
    const precio = titulo.precio/(mitadPrecio?2:1);
    if(precio <= this.efectivo){
        this.efectivo -= precio;
        this.adquirirTitulo(idtitulo);
        this.partida.escribirNota(`@j${this.id} ha comprado ${titulo.nombre} por @d${precio}`);
        return true;
    }
    return false;    
  }
  adquirirTitulo(idtitulo){
    let jt = this.titulos.find( t => {return t.id == idtitulo});    
    this.partida.tablero.entregarTitulo(this,idtitulo);
    if(jt){
      jt.num++;
    }else{
      jt = {id:idtitulo,num:1};
      this.titulos.push(jt);
    }    
    const titDef = this.partida.tablero.casillerosDef.items[idtitulo];
    jt.util=this.calcularPago(titDef);
    this.calcularUtilidadAnual();
  }
  devolverTitulo(idtitulo,num){
    const titulo = this.titulos.find(t => {return t.id==idtitulo});
    if(!titulo) {
      console.log(`El jugador no tiene el título indicado(${idtitulo})`);
      return;
    }
    if(titulo.num-num<0){
      console.log(`El jugador solo tiene ${titulo.num} del título indicado(${idtitulo})`);
      return;
    }
    titulo.num-=num;
    const tInfo = this.partida.tablero.titulos.find(t => {return t.id == titulo.id});
    tInfo.cantDisponible += num;
    if(titulo.num==0){
      //eliminar poseedor de titulo
      tInfo.poseedores = tInfo.poseedores.filter( p => {return p!=this.id});
      //eliminar titulo de la lista de titulos.
      this.titulos = this.titulos.filter( t => {return t.id!=titulo.id});
    }else{
      const titDef = this.partida.tablero.casillerosDef.items[idtitulo];
      const utilidades = this.calcularPago(titDef);
      titulo.util = utilidades;
    }
    this.calcularUtilidadAnual();
  }

  devolverTitulos(){
    while(this.titulos.length>0){
      const titulo = this.titulos[0];
      const tInfo = this.partida?.tablero.titulos.find(t => {return t.id == titulo.id});
      if(!tInfo) continue;
      //eliminar poseedor de titulo
      tInfo.poseedores = tInfo.poseedores.filter( p => {return p!=this.id});
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
      const tInfo = this.partida.tablero.casillerosDef.items[t.id];
      if(tInfo.tipo == CA_TIPO.TITULO_INVR){
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
    let utilidades = acreedor.calcularPago(titInfo);
    //pagar obligaciones
    return this.pagar([acreedor],utilidades);
  }
  /**
   * Sólo aplica para títulos de inversión, no para títulos profesionales.
  */
  calcularPago(titInfo) {
    if(titInfo.tipo != CA_TIPO.TITULO_INVR){
      console.log(`Sólo se puede calcular el pago para los títulos de inversión`);
      return 0;
    }
    const jt = this.tiene(titInfo.id);
    if(!jt){
      console.log(`El jugador no posee ${titInfo.nombre}`);
      return 0;
    }
    let utilidades = 0;
    //sumar utilidades de propieddad
    utilidades += titInfo.utilidades[jt.num-1];
    //duplicar cientifico
    utilidades += utilidades*(this.tiene(CA.CIENTIFICO)?1:0);
    //sumar economista
    utilidades += jt.num*(this.tiene(CA.ECONOMISTA)?5:0);

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
                console.log(`pagar a ${acreedor.nombre}`);
                console.log(`con id = ${acreedor.id}`);                
                nombres+=`@j${acreedor.id} , `;
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
  cobrarUtilidadAnual() {
    this.efectivo += this.utilidadAnual;
  }  
  iniciarDescanso() {
    this.turnosDescanso = this.partida.reglas.turnosDescansando;
  }
  reducirDescanso() {
    this.turnosDescanso--;
  }

  cobrarSueldo(numMeses){
    if(this.numTarjSueldo!=0&&numMeses!=0){
      const rlgs = this.partida.reglas;        
      const salario = numMeses*this.numTarjSueldo*rlgs.salario;
      const msj = `@j${this.id} ha recibido @d${salario} por ${numMeses} mes${numMeses==1?"":"es"} de salario`;
      this.cobrarDinero(salario);
      console.log(`cobrarSueldo: ${msj}`);
      this.partida.escribirNota(msj);
    }
  }
  
  aumentarSueldo() {
    this.numTarjSueldo++;
  }
  perderTrabajo() {
    this.numTarjSueldo=0;
  }
  aplicarInflacion(){
    const devuelto = Math.floor(this.efectivo)/2;
    const saldo = this.efectivo - devuelto;    
    this.efectivo = saldo;
    return devuelto;            
  } 
  cobrarPagare(creditId) {    
    if(this.pagares[creditId] == undefined) return false;
    if(!this.pagares[creditId]) return false;
    this.pagares[creditId] = false;
    const creditValue = (creditId+1)*10;
    this.efectivo += creditValue;
    this.deuda += creditValue;
    return true;
  }
  recuperarPagares() {
    const cantidad = this.pagares.filter( p => {return !p}).length;
    this.pagares.forEach( (_,i) => {this.pagares[i] = true;});
    return cantidad;
  }
  /**
   * recaudar dinero entre efectivo y propiedades para intentar saldra la deuda.
   */
  liquidar_saldar(idsAcreedores,deudaTotal){
    let recaudado = this.efectivo;
    //acumula venta de titulos
    this.titulos.forEach( t => {
      const tInfo = this.partida.tablero.casillerosDef.items[t.id];
      recaudado+=tInfo.precio*t.num;
    });
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
          nombres+=`@j${acreedor.id} , `;
          acreedor.efectivo+=prorateoDeuda;
          recaudado-=prorateoDeuda;
      });
      nombres = this.decorarNombres(nombres);
      console.log(`declararBancaRota: el banco se quedó con ${recaudado*1000}`);
      this.partida.escribirNota(`@j${this.id} trató de saldar su deuda con ${nombres}`);
    }
  }
  devolverActivosPasivos(){
    //elimina títulos pertenecientes a este jugador
    this.devolverTitulos();
    //Los pagarés restantes no es dinero propio por lo tanto no se debe recaudar.
    //El orden se mantiene asignado para los cálculos posteriores.
    this.numTarjSueldo = 0;
    this.efectivo = 0;
    this.utilidadAnual = 0;
    this.turnosDescanso = 0;
    this.deuda = 0;
    this.pagares = [false,false,false,false,false];
  }
  declararBancaRota(idsAcreedores,deudaTotal){
    this.liquidar_saldar(idsAcreedores,deudaTotal);
    this.devolverActivosPasivos();
    //reasignar host al siguiente
    if(this.isHost){ 
      this.isHost = false;
      const jSiguiente = this.partida.getJugadorSiguiente(this.orden);
      jSiguiente.isHost = true;
      this.partida.host = jSiguiente;
    }
    this.bancaRota = true;
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
    if(i>=0) nombres = `${nombres.substring(0,i)} y ${nombres.substring(i+1)}`;
    
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