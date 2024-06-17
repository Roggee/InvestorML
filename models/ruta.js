const {CA} = require('./valores');

class Ruta {
    
    constructor(casilleros = [],numMeses = 0) {
        this.casilleros = casilleros;
        this.numMeses = numMeses;
    }
    get(i){
        return this.casilleros[i];
    }
    getCasilleros(){
        return this.casilleros;        
    }
    
    getNumMeses(){
        return this.numMeses;
    }
    
    /**
     * Devuelve la cantidad de casillas sin contar la inicial
     */
    getLongitud(){
        return this.casilleros.length - 1;
    }

    esCambioCarrilAnioNuevo(){
        let res = true;
        this.casilleros.every((cas) => {
            if(![CA.ANIO_NUEVO_ROSADO,CA.ANIO_NUEVO_CELESTE,CA.ANIO_NUEVO_VERDE].includes(cas)){
                res = false;
                return false;
            }
            return true;
        });
        // Sólo se considera como una ruta de cambio de carrill cuando tiene al menos una casilla de dicha zona
        return res && this.getLongitud()>0;
    }

    esCambioCarrilFestividades(){
        let res = true;
        this.casilleros.every((cas) => {
            if(![CA.FESTIVIDADES_ROSADO,CA.FESTIVIDADES_CELESTE,CA.FESTIVIDADES_VERDE].includes(cas)){
                res = false;
                return false;
            }
            return true;
        });
        // Sólo se considera como una ruta de cambio de carrill cuando tiene al menos una casilla de dicha zona
        return res && this.getLongitud()>0;
    }

    esCambioCarril(){
        return this.esCambioCarrilAnioNuevo() || this.esCambioCarrilFestividades();
    }

    getFin(){
        return this.casilleros[this.casilleros.length-1];
    }
}

module.exports = Ruta;