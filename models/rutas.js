const Ruta = require("./ruta");
const {TABLA_DADOS,CA_TIPO,CA} = require("./valores");

class Rutas {
    constructor(){
        this.principal = undefined;
        this.secundario = undefined;
    }

    getCantidadRutas(){
        if(!this.secundario) return 1;
        return 2;
    }

    calcularRutas(partida){
        let longitud = partida.dVal;
        
        const posIni = partida.jugadorActual.posicion;
        const pararAnioNuevo = partida.reglas.pararAnioNuevo;
        //cambiar longitud en caso se deba parar en anio nuevo obligatoriamente
        if(pararAnioNuevo && posIni!=CA.NOVIEMBRE){ //nuevo valor acotado según reglas
            if(posIni <= CA.RETROCEDA6_ROSADO && posIni + longitud > CA.RETROCEDA6_ROSADO){
                longitud = CA.RETROCEDA6_ROSADO - posIni + 1;
            }else if(posIni <= CA.AUTOMOTORES && posIni + longitud > CA.AUTOMOTORES){
                longitud = CA.AUTOMOTORES - posIni + 1;
            }else if(posIni <= CA.RETROCEDA6_VERDE && posIni + longitud > CA.RETROCEDA6_VERDE){
                longitud = CA.RETROCEDA6_VERDE - posIni + 1;
            }
        }
        
        console.log(`caminará ${longitud} espacios`);
                
        let [cam1,cam2] = [posIni,posIni];
        let [cmes1,cmes2] = [0,0];
        let [ruta1,ruta2] =[[],[]];
        
        const sites = partida.tablero.casillerosDef.items;

        for(let i=0;i<longitud+1;i++){
            if(posIni != CA.MAYO){
                ruta1.push(cam1);//camino principal
                ruta2.push(cam2);//camino alternativo
            }else{
                ruta1.push(cam2);//camino principal
                ruta2.push(cam1);//camino alternativo
            }
            cam1 = this.avanzarUnaCasilla(cam1);
            if(i == 0){
                cam2 = sites[posIni].dirAdicional;
                if(posIni != CA.MAYO){                    
                    if(cam2==-1)ruta2[i] = -1;
                }else{
                    cam1=-1;
                    ruta2[i] = -1;
                }
                //para el caso que inicie en un mes con dados en cero
                if(sites[posIni].tipo == CA.TIPO_MES && longitud==0){
                    cmes1=1;
                    cmes2=1;
                }
            }
            else{          
                cam2 = this.avanzarUnaCasilla(cam2);
                console.log(`i= ${i},ruta1 = ${ruta1[i]},site_i=${JSON.stringify(sites[ruta1[i]])}`);
                if(sites[ruta1[i]].tipo == CA_TIPO.MES)cmes1++;
                if(ruta2[i]!=-1 && sites[ruta2[i]].tipo ==  CA_TIPO.MES)cmes2++;
            }
         }

        if(pararAnioNuevo && posIni==CA.NOVIEMBRE && longitud>4){
            ruta1 = [CA.NOVIEMBRE,CA.BONANZAS,CA.METALURGIA,CA.AUTOMOTORES,CA.ANIO_NUEVO_CELESTE];
            cmes1 = 0;
        }
        
        this.principal = new Ruta(ruta1, cmes1);
        this.secundario = (ruta2[0]==-1?undefined:new Ruta(ruta2,cmes2));
        
        return this;
    }
    avanzarUnaCasilla(pos){
        switch(pos){
            case -1: return -1; //si no hay camino alternativo
            case CA.RETROCEDA6_ROSADO: return CA.ANIO_NUEVO_ROSADO;
            case CA.AUTOMOTORES: return CA.ANIO_NUEVO_CELESTE;
            case CA.RETROCEDA6_VERDE: return CA.ANIO_NUEVO_VERDE;
            default: return pos+1; //cualquier otro espacio
        }
    }
}
module.exports = Rutas;