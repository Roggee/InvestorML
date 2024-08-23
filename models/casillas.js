const THREE = require('three');
const {CA} = require("./valores");

class Casillas{
    constructor(){
        //TODO: SE CARGA CADA VEZ QUE SE INICIALIZA pero mantiene los valores modificados de la primera vez del forEach
        const cas = require('../resources/casillas.json');
        //console.log(`CASILLAS.ITEMS1: ${JSON.stringify(cas)}`);
        this.items = cas;
        //convertir arreglo de coordenadas en vector3
        this.items.forEach(item => {
            item.coords = new THREE.Vector3(item.coords.x,item.coords.y,item.coords.z);
            item.posInternas.forEach( (pi,i) => {
                item.posInternas[i] = new THREE.Vector3(pi.x,pi.y,pi.z);
            });
        });
        //console.log(`CASILLAS.ITEMS2: ${JSON.stringify(this.items)}`);
    }
    esAnioNuevo(id){
        return ([CA.ANIO_NUEVO_ROSADO,CA.ANIO_NUEVO_CELESTE,CA.ANIO_NUEVO_VERDE].includes(id));
    }
}
module.exports = Casillas;