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
                posInternas: [false,false,false,false]
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

    procesarCasilla(jugador,ruta){
        const idcasilla = jugador.posicion;
        const casilla = this.casillerosDef.items[idcasilla];
        let titulo;
        let dialogo;
        switch(casilla.tipo){
            case CA_TIPO.TITULO_INVR:
                titulo = this.titulos.find( t => {return t.id == idcasilla});
                //Sólo se puede comprar si no tiene poseedores o si el jugador actual lo es y aún hay títulos disponibles
                //Para un titulo de inversión sólo existe un poseedor
                dialogo = new Dialogo(jugador.partida);
                if(titulo.poseedores.length == 0 || (titulo.poseedores[0] == jugador.id && titulo.cantDisponible > 0)){
                    //activar ventana de compra de título.
                    dialogo.abrir(DIAG_TIPO.COMPRAR_TITULO,casilla);
                }else if(titulo.poseedores[0] != jugador.id){ //si alguién mas ya lo compro se le tiene pagar
                    const resultado = jugador.pagarUtilidades(titulo.poseedores[0],casilla);
                    if(resultado){ //se la logrado pagar la deuda
                        dialogo.abrir(DIAG_TIPO.PAGO_JUGADOR,{texto: resultado});
                        // $partida->escribirNota($idpartida, $resultado, $cnn);
                    }else{ //no se pudo pagar la deuda. Insolvente
                        const deuda = jugador.calcularPago(titulo.poseedores[0],casilla);
                        dialogo.abrir(DIAG_TIPO.DECLARAR_BANCAROTA,{iddeudor:jugador.id, idacreedores:titulo.poseedores, deuda: deuda});
                    }
                }else{
                //     $partida->escribirNota($idpartida, "@j$jugador->id posee todos los títulos de esta inversión", $cnn);
                    this.partida.finalizarTurno();
                }
                break;
            case CA_TIPO.TITULO_PROF:
                titulo = this.titulos.find( t => {return t.id == idcasilla});
                const profesion = jugador.tiene(idcasilla);
                if(!profesion){
                    //si hay para vender
                    if(titulo.cantDisponible>0){
                        dialogo = new Dialogo(jugador.partida);
                        dialogo.abrir(DIAG_TIPO.COMPRAR_TITULO,casilla);
                    }else {
                        //$partida->escribirNota($idpartida, "Ya no hay títulos disponibles", $cnn);
                        this.partida.finalizarTurno();
                    }
                }else{
                    //$partida->escribirNota($idpartida, "@j$jugador->id ya es $casilla->nombre", $cnn);
                    this.partida.finalizarTurno();
                }
                break;
            case CA_TIPO.COMODIN:
                dialogo = new Dialogo(jugador.partida);
                dialogo.abrir(DIAG_TIPO.COMODIN,casilla);
                // //vuelve a evaluar casilla luego de un CONTINUAR?
                // if($variable->tomar($idpartida, "deuda", $cnn)){
                //     //se eliminan las variables de deuda porque se volvera a evaluar el estado y de ser necesario se vuelven a crear.
                //     $variable->tomar($idpartida, "acreedores", $cnn); 
                //     $dialogo->cerrar($idpartida, $dialogo->iddialogo, $cnn);
                //     $servidorML = new ServidorML();
                //     //entrará a evaluar cierra de comodín                    
                //     $servidorML->evaluarCierreComodin($casilla->id,$jugador->id,$idpartida,$cnn);
                // }
                break;
            default: //Año nuevo, Festividades, Meses,
                console.log("anio nuevo, festividades, meses");
                const reglas = this.partida.reglas;
                //validar si se debe cobrar utilidad
                if(ruta.esCambioCarrilAnioNuevo()&&(this.casillerosDef.esAnioNuevo(idcasilla)&&jugador.utilidadAnual!=0) && 
                   (this.partida.dVal!=0||(this.partida.dVal==0 && reglas.repetirAnioNuevo))){
                    console.log("pendiente implementar cobrar utilidad");
                    this.partida.finalizarTurno();
                    // $dialogo = new Dialogo();
                    // $mensaje = "@j$jugador->id ha cobrado sus utilidades por @d$jugador->utilidadAnual";
                    // $dialogo->abrir($idpartida, Dialogo::AVISO_COBRAR_UTILIDAD, $mensaje, $cnn);                    
                }
                //el cambio de carril permite continuar en el mismo estado de partida con el mismo jugador luego que la caminata termine.
                this.permitirCambiarCarril(jugador.posicion);
                if(ruta.esCambioCarril() && this.partida.estadoInicial == PE.INICIO_TURNO){
                    this.partida.estadoInicial = "";
                    this.partida.inicializarTurno();
                    console.log("turno inicializado");
                }else{
                    //cambiar nombre a PermitirFinalizarTurno
                    this.partida.finalizarTurno();
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
    // public function getCasilla($id,$idpartida,Conexion $cnn){
    //     $res = $cnn->consultar("SELECT id,color,transparencia, elegible,posInternas FROM mls_tablero WHERE idpartida = $idpartida AND id = $id");
    //     $row = mysqli_fetch_row($res);
    //     return ['id' => (int)$row[0], 'color' => $row[1], 'transparencia' => (float)$row[2], 'elegible' => (boolean)$row[3], posInternas=> json_decode($row[4])];
    // }

    /**
     * actualiza las posiciones relativas de las casillas utilizadas por los jugadores en la partida.
     */
    updatePosInternasCasilla(){
        this.casilleros.forEach( c => c.posInternas = [false,false,false,false] );
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
        })
        return iPosInterna;
    }

    mostrarCaminos(rutas) {
        const finP = rutas.principal.getFin();
        const finS = rutas.secundario.getFin();
        this.casilleros.forEach( (c,index) => {
            if([finP,finS].includes(index)){
                c.elegible = true;
                c.transparencia = 1.0;
            }else{
                c.elegible = false;
                c.transparencia = 0.5;
            }
        });
    }
    
    // /**
    //  * muestra y devuelve la cantidad de titulos disponibles del jugador actuales.
    //  * @param $colorRubro el color del título de inversión. r,c,v o la combinación de ellos.
    //  * @param $excepto el id de un titulo que se debe excluir de la selección (Caso FUSIÓN)
    //  */
    // public function mostrarTitulosDisponibles($idpartida, $colorRubro, $excepto, Conexion $cnn) {
    //     //limmpiar todo
    //     $color = Tablero::colorPredet;
    //     $excluido = ($excepto?$excepto:-1);
    //     $cnn->consultar("UPDATE mls_tablero SET elegible = false,transparencia=0.5,color = '$color' WHERE idpartida = $idpartida");
    //     //seleccionar titulos disponibles
    //     $res = $cnn->consultar("SELECT GROUP_CONCAT(mls_tablero.id) ".
    //                     "FROM mls_tablero INNER JOIN mls_casillas ON mls_tablero.id = mls_casillas.id AND mls_tablero.idpartida = $idpartida ".
    //                     "                 INNER JOIN mls_partidas ON mls_tablero.idpartida = mls_partidas.id ".
    //                     "                 LEFT JOIN (SELECT T1.idpartida,T0.* ".
    //                     "                            FROM mls_jugador_titulos T0 INNER JOIN mls_jugador T1 ON T1.id = T0.idjugador) AS TJ ".
    //                     "                                                   ON TJ.idtitulo = mls_casillas.id AND TJ.idpartida = mls_tablero.idpartida ".
    //                     "WHERE mls_casillas.tipo = 2 AND LOCATE(mls_casillas.colorRubro,'$colorRubro') > 0  AND IFNULL(TJ.idpartida,mls_tablero.idpartida) = mls_tablero.idpartida ".
    //                     "                            AND IFNULL(TJ.idjugador,mls_partidas.jugadorActual) = mls_partidas.jugadorActual AND mls_casillas.maxTitulos-IFNULL(TJ.num,0)>0".
    //                     "                            AND mls_tablero.id != $excluido ");     
    //     if($row = mysqli_fetch_row($res)){
    //         $ids = $row[0];         
    //         //opacar no selecionables y aclarar seleccionables
    //         $cnn->consultar("UPDATE mls_tablero SET elegible = true,transparencia = 1.0 ".
    //                         "WHERE idpartida = $idpartida and id in ($ids)");
    //         return $cnn->filasAfectadas();
    //     }
    //     return 0;
    // }
    // /**
    //  * @param $todo si es true entonces muestra todos los títulos del jugador, caso contrario sólo muestra los títulos de inversión.
    //  */
    // public function mostrarTitulosDe($idjugador, $todo, $cnn) {
    //     $tipos = $todo?"2,4":"2";
    //     $cnn->consultar("UPDATE mls_tablero INNER JOIN mls_jugador_titulos T2 ON T2.idtitulo = mls_tablero.id ".
    //                     "                   INNER JOIN mls_jugador T1 ON T1.idpartida = mls_tablero.idpartida AND T1.id = T2.idjugador ".
    //                     "                   INNER JOIN mls_color T3 ON T3.id = T1.color ".
    //                     "                   INNER JOIN mls_casillas T4 ON T4.id = mls_tablero.id ".
    //                     "SET mls_tablero.color = T3.hexa, ".
    //                     "    mls_tablero.transparencia = 0.5,".
    //                     "    mls_tablero.elegible = true ".
    //                     "WHERE T2.idjugador = $idjugador AND T4.tipo IN($tipos)");
    // }

    // /**
    //  * permite que todas las casilla sean elegibles excepto la central(MILLONARIO) y la indicada en $excluir.
    //  * @param $excluir indicar un id de casilla para que no sea elegible
    //  */
    // public function permitirSeleccionGeneral($idpartida,$excluir, $cnn) {
    //     $ids = $excluir?Casilla::MILLONARIO.",$excluir":strval(Casilla::MILLONARIO);
    //     $cnn->consultar("UPDATE mls_tablero SET elegible = true WHERE idpartida = $idpartida AND id NOT IN($ids)");        
    // }
}
module.exports = Tablero;