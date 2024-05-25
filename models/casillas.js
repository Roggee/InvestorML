const THREE = require('three');

class Casillas{
    static POS_INTERNAS = [[2,0,7],[-2,0,7],[2,0,-7],[-2,0,-7]];
    //rosados
    static ANIO_NUEVO_ROSADO = 0;
    static AVANCE_BOULEVARD_SO = 1;
    static TALLERES = 2;
    static COMERCIO = 3;
    static VOLVER_TIRAR_DADOS_INI = 4;
    static HOSPITAL = 5;
    static RECREACION = 6;
    static ENERO = 7;
    static MEDICO = 8;
    static AUMENTO_SUELDO = 9;
    static AVANCE_PARQUE_SE = 10;
    static ABRIL = 11;
    static TRANSPORTES = 12;
    static JUSTICIA = 13;
    static PROMOCION = 14;
    static MAYO = 15;
    static ADELANTE_BOULEVARD_SE = 16;
    static OPORTUNIDAD = 17;
    static FESTIVIDADES_ROSADO = 18;
    static OFERTA = 19;
    static ADELANTE_AVENIDA_ESTE = 20;
    static AGOSTO = 21;
    static ABOGADO = 22;
    static INFLACION = 23;
    static BIENES_RAICES = 24;
    static SETIEMBRE = 25;
    static ECONOMISTA = 26;
    static MORATORIA = 27;
    static AVANCE_CALLE_NE = 28;
    static DICIEMBRE = 29;
    static FINANZAS = 30;
    static DEPRESION = 31;
    static VOLVER_TIRAR_DADOS_FIN = 32;
    static SERVICIOS = 33;
    static CIENTIFICO = 34;
    static RETROCEDA6_ROSADO = 35;
    //celestes
    static ANIO_NUEVO_CELESTE = 36;
    static IMPRENTA = 37;
    static CONSTRUCCION = 38;
    static FUSION = 39;
    static FEBRERO = 40;
    static ENVASADORA = 41;
    static PAGUE_IMPUESTO = 42;
    static MARZO = 43;
    static GANA_JUICIO = 44;
    static JUNIO = 45;
    static FABRICAS = 46;
    static ADELANTE_AUTOPISTA_ESTE = 47;
    static FESTIVIDADES_CELESTE = 48;
    static ADELANTE_AVENIDA_NE = 49;
    static TEXTILES = 50;
    static JULIO = 51;
    static PAGUE_DIVIDENDOS = 52;
    static OCTUBRE = 53;
    static QUIMICA = 54;
    static PERDIO_TRABAJO = 55;
    static NOVIEMBRE = 56;
    static BONANZAS = 57;
    static METALURGIA = 58;
    static AUTOMOTORES = 59;
    //verde
    static ANIO_NUEVO_VERDE = 60;
    static AVANCE_FESTIVIDADES = 61;
    static EXCELENTE_COSECHA = 62;
    static AGRICOLA = 63;
    static FRACASO = 64;
    static PESCA = 65;
    static FESTIVIDADES_VERDE = 66;
    static PETROLEO = 67;
    static DIO_EN_LA_VETA = 68;
    static MINAS = 69;
    static ESTA_PERDIDO = 70;
    static RETROCEDA6_VERDE = 71;
    static MILLONARIO = 72;
    
    //tipos
    static TIPO_NINGUNO = 0;
    static TIPO_COMODIN = 1;
    static TIPO_TITULO_INVR = 2;
    static TIPO_MES = 3;
    static TIPO_TITULO_PROF = 4;

    constructor(){
        //TODO: SE CARGA CADA VEZ QUE SE INICIALIZA pero mantiene los valores modificados de la primera vez del forEach
        this.items = require('../resources/casillas.json');
        //console.log(`CASILLAS.ITEMS1: ${JSON.stringify(this.items)}`);
        //convertir arreglo de coordenadas en vector3
        this.items.forEach(item => {
            item.coords = new THREE.Vector3(item.coords.x,item.coords.y,item.coords.z);
        });
        //console.log(`CASILLAS.ITEMS2: ${JSON.stringify(this.items)}`);
    }
    esAnioNuevo(id){
        return ([Casillas.ANIO_NUEVO_ROSADO,Casillas.ANIO_NUEVO_CELESTE,Casillas.ANIO_NUEVO_VERDE].includes(id));
    }
}
module.exports = Casillas;