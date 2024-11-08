const Casillas = require("./casillas");
const Dialogo = require("./dialogo");
const {PE,CA,CA_TIPO,DIAG_TIPO} = require("./valores");

class Tablero{

    static COLOR_PREDET = '0C0C0C'; //color neutro para todas las posiciones = 82, 98, 122 = 52627A

    constructor(partida) {
        this.partida = partida;
        this.casillerosDef = new Casillas();
        this.titulos =[];
        this.casilleros = [];
        this.casillerosDef.items.forEach((c,i) => {
            this.casilleros.push({
                color: Tablero.COLOR_PREDET,
                transparencia: 1.0,
                elegible: false,
                posInternas: [false,false,false,false,false,false],
                giro: Math.round(((c.giro*Math.PI)/180)*1000)/1000
            });
            //agregar títulos de inversión y profesionales
            if([CA_TIPO.TITULO_INVR,CA_TIPO.TITULO_PROF].includes(c.tipo)){
                this.titulos.push({
                    poseedores:[],
                    cantDisponible:4, //la cantidad disponible de titulos. Por defecto es 4.
                    id:i //igual que id de casilla
                });
            }
        });        
    }
    /** 
     * Valida si el jugador se encuentra el Año nuevo o Festividades para permitirle la sessión de una ruta diferente.
     * @param {*} jugador_posicion es la posición actual del jugador
     */
    permitirCambiarCarril(jugador_posicion){
        if(this.esAnioNuevo(jugador_posicion)){
            let ids = [CA.ANIO_NUEVO_ROSADO,CA.ANIO_NUEVO_CELESTE,CA.ANIO_NUEVO_VERDE];
            this.setElegible(ids, true);
            this.setElegible([jugador_posicion], false);
        }else if(this.esFestividades(jugador_posicion)){
            let ids = [CA.FESTIVIDADES_ROSADO,CA.FESTIVIDADES_CELESTE,CA.FESTIVIDADES_VERDE];
            this.setElegible(ids, true);
            this.setElegible([jugador_posicion], false);
        } else{
            let ids = [CA.ANIO_NUEVO_ROSADO,CA.ANIO_NUEVO_CELESTE,CA.ANIO_NUEVO_VERDE,CA.FESTIVIDADES_ROSADO,CA.FESTIVIDADES_CELESTE,CA.FESTIVIDADES_VERDE];
            this.setElegible(ids, false);
        }
    }

    esAnioNuevo(posicion){
        return [CA.ANIO_NUEVO_ROSADO,CA.ANIO_NUEVO_CELESTE,CA.ANIO_NUEVO_VERDE].includes(posicion);
    }

    esFestividades(posicion){
        return [CA.FESTIVIDADES_ROSADO,CA.FESTIVIDADES_CELESTE,CA.FESTIVIDADES_VERDE].includes(posicion);
    }
    /**
     * Establece si una casilla debe ser elegible o no.
     * @param {*} casillaIDs arreglo de casillas
     * @param {*} elegible valor aplicable a las casillas
     */
    setElegible(casillaIDs,elegible){
        casillaIDs.forEach( c => this.casilleros[c].elegible = elegible);
    }
    /**
     * 
     * @param {*} jugador 
     * @param {*} esCambioAN 
     * @param {*} esCambioFTV 
     * @param {*} esReproceso indica si se vuelve a procesar la casilla por que viene de una situación de insolvencia
     */
    procesarCasilla(jugador,esCambioAN,esCambioFTV,esReproceso){
        const idcasilla = jugador.posicion;
        const casilla = this.casillerosDef.items[idcasilla];
        let titulo;
        let dialogo;
        switch(casilla.tipo){
            case CA_TIPO.TITULO_INVR:
                titulo = this.titulos.find( t => {return t.id == idcasilla});
                //Sólo se puede comprar si no tiene poseedores o si el jugador actual lo es y aún hay títulos disponibles
                //Para un titulo de inversión sólo existe un poseedor
                dialogo = new Dialogo(this.partida);
                if(titulo.poseedores.length == 0 || (titulo.poseedores[0] == jugador.id && titulo.cantDisponible > 0)){
                    //activar ventana de compra de título.
                    dialogo.abrir(DIAG_TIPO.COMPRAR_TITULO,{id:casilla.id,precio:casilla.precio});
                }else if(titulo.poseedores[0] != jugador.id){ //si alguién mas ya lo compro se le tiene pagar
                    const resultado = jugador.pagarUtilidades(titulo.poseedores[0],casilla);
                    if(resultado){ //se la logrado pagar la deuda
                        dialogo.abrir(DIAG_TIPO.PAGO_JUGADOR,{texto: resultado});
                        this.partida.escribirNota(resultado);
                    }else{ //no se pudo pagar la deuda. Insolvente                        
                        const acreedor = this.partida.jugadores.find( j => {return j.id == titulo.poseedores[0]});
                        const deuda = acreedor.calcularPago(casilla);
                        dialogo.abrir(DIAG_TIPO.DECLARAR_BANCAROTA,{iddeudor:jugador.id, idacreedores:titulo.poseedores, deuda: deuda});
                    }
                }else{
                    this.partida.escribirNota(`@j${jugador.id} posee todos los títulos de ${casilla.nombre.toUpperCase()}`);
                    this.partida.finalizarTurno();
                }
                break;
            case CA_TIPO.TITULO_PROF:
                titulo = this.titulos.find( t => {return t.id == idcasilla});
                const profesion = jugador.tiene(idcasilla);
                if(!profesion){
                    //si hay para vender
                    if(titulo.cantDisponible>0){
                        dialogo = new Dialogo(this.partida);
                        dialogo.abrir(DIAG_TIPO.COMPRAR_TITULO,casilla);
                    }else {
                        this.partida.escribirNota("Ya no hay títulos disponibles");
                        this.partida.finalizarTurno();
                    }
                }else{
                    this.partida.escribirNota(`@j${jugador.id} ya es ${casilla.nombre}`);
                    this.partida.finalizarTurno();
                }
                break;
            case CA_TIPO.COMODIN:
                //vuelve a evaluar casilla luego de una situación de insolvencia
                if(esReproceso){               
                    this.partida.evaluarCierreComodin(casilla,jugador);
                }else{
                    dialogo = new Dialogo(this.partida);
                    dialogo.abrir(DIAG_TIPO.COMODIN,casilla);
                }
                break;
            default: //Año nuevo, Festividades, Meses,
                console.log("anio nuevo, festividades, meses");
                const reglas = this.partida.reglas;
                //validar si se debe cobrar utilidad
                if(!esCambioAN&&(this.casillerosDef.esAnioNuevo(idcasilla)&&jugador.utilidadAnual!=0) && 
                   (this.partida.dVal!=0||(this.partida.dVal==0 && reglas.repetirAnioNuevo))){
                    dialogo = new Dialogo(this.partida);
                    const mensaje = `@j${jugador.id} ha recibido @d${jugador.utilidadAnual} por sus utilidades anuales`;
                    dialogo.abrir(DIAG_TIPO.COBRAR_UTILIDAD, {texto: mensaje});
                }else{
                    this.permitirCambiarCarril(jugador.posicion);
                    if((esCambioAN||esCambioFTV) && this.partida.estadoInicial == PE.INICIO_TURNO){                        
                        this.partida.estadoInicial = "";
                        this.partida.inicializarTurno();
                        console.log("turno inicializado");
                    }else{
                        //cambiar nombre a PermitirFinalizarTurno
                        this.partida.finalizarTurno();
                    }
                }
        }        
    }
    entregarTitulo(jugador,idtitulo){
        const titulo = this.titulos.find( t => {return t.id == idtitulo});
        if(!titulo.poseedores.find(id => {return id == jugador.id})){
            titulo.poseedores.push(jugador.id);
        }
        titulo.cantDisponible--;
    }
    limpiar(){
        const color = Tablero.COLOR_PREDET;
        this.casilleros.forEach( c => {
            c.elegible = false,
            c.transparencia = 1.0,
            c.color = color
        });
    }
    /**
     * actualiza las posiciones relativas de las casillas utilizadas por los jugadores en la partida.
     */
    updatePosInternasCasilla(){
        this.casilleros.forEach( c => c.posInternas = [false,false,false,false,false,false] );
        let jEnDescanso = this.partida.jugadores.filter(j => j.posRelativa != -1 && !j.bancaRota);
        jEnDescanso.forEach(j => {
           this.casilleros[j.posicion].posInternas[j.posRelativa] = true;
        });
    }
        
    getPosicionLibre(idCasilla){
        const posInternas = this.casilleros[idCasilla].posInternas;
        let iPosInterna = -1;
        posInternas.every((p,index) => {
            if(!p) {
                iPosInterna = index;
                return false;
            }
            return true;
        });
        return iPosInterna;
    }

    mostrarCaminos(rutas) {
        const finP = rutas.principal.getFin();
        const finS = rutas.secundario.getFin();
        const ini = rutas.principal.get(0);
        this.casilleros.forEach( (c,index) => {
            if([finP,finS].includes(index)){
                c.elegible = true;
                c.transparencia = 1.0;
            }else if(index == ini){
                c.elegible = false;
                c.transparencia = 1.0;
            }else{
                c.elegible = false;
                c.transparencia = 0.5;
            }
        });
    }
    
    /**
     * muestra y devuelve la cantidad de titulos que el jugador indicado puede adquirir.
     * @param colorRubro el color del título de inversión. r,c,v o la combinación de ellos.
     * @param excepto el id de un titulo que se debe excluir de la selección (Caso FUSIÓN)
     */
    mostrarTitulosDisponibles(jugador,colorRubro, excepto) {
        const color = Tablero.COLOR_PREDET;
        const excluido = (excepto?excepto:-1);
        //limmpiar todo
        this.casilleros.forEach( c => {c.elegible = false,c.transparencia=0.5,c.color = color});
        //seleccionar titulos disponibles
        let cantidad = 0;
        this.titulos.forEach( t => {
            const cd = this.casillerosDef.items[t.id];
            if(cd.tipo!==CA_TIPO.TITULO_INVR) return;
            if(!colorRubro.includes(cd.colorRubro)) return;
            if(t.poseedores.length > 0 && !t.poseedores.includes(jugador.id)) return;
            if(t.cantDisponible == 0) return;
            if(t.id == excluido) return;

            const ct = this.casilleros[t.id];
            ct.elegible = true;
            ct.transparencia = 1;
            cantidad++;
        });
        return cantidad;
    }
    /**
     * muestra los títulos del jugador indicado.
     * @param $todo si es true entonces muestra todos los títulos del jugador, caso contrario sólo muestra los títulos de inversión.
     */
    mostrarTitulosDe(jugador,excepto) {
        const excluido = (excepto?excepto:-1);
        const color = "FFFFFF";//Tablero.COLOR_PREDET;
        //this.casilleros.forEach( c => {c.elegible = false,c.transparencia=0.5,c.color = color});
        this.casilleros.forEach( c => {c.elegible = false,c.transparencia=1,c.color = color});
        this.titulos.forEach( t => {
            let cd = this.casillerosDef.items[t.id];
            if(cd.tipo!==CA_TIPO.TITULO_INVR) return;
            if(!t.poseedores.includes(jugador.id)) return;
            if(t.id == excluido) return;

            const ct = this.casilleros[t.id];
            ct.elegible = true;
            ct.transparencia = 1;
        });
    }
}
module.exports = Tablero;