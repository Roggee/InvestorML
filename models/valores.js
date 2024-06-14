//PARTIDA ESTADOS
const PE = {
    PREPARACION           : "I",
    INICIANDO             : "N",
    INICIO_TURNO          : "J",
    LANZANDO              : "R",
    CAMINANDO             : "C",
    DECIDIENDO_CAMINO     : "D",
    COMPRANDO_OF_OP       : "S",
    FINALIZANDO_TURNO     : "Z",
    EVALUANDO_DESTINO     : "V",
    ESPERAR_TURNO         : "E",
    GANADOR               : "G",
    FUSIONANDO            : "U",
    FRACASANDO            : "A",
    DECIDIENDO_SUERTE     : "T",
    FIN_CAMINATA_FORZADA  : "M"
} 
//VALORES DADOS
const TABLA_DADOS = [[0,2,3,1,2,0],[0,2,4,1,3,0]];
//CASILLAS
const CA = {
    //rosados
    ANIO_NUEVO_ROSADO : 0,
    AVANCE_BOULEVARD_SO : 1,
    TALLERES : 2,
    COMERCIO : 3,
    VOLVER_TIRAR_DADOS_INI : 4,
    HOSPITAL : 5,
    RECREACION : 6,
    ENERO : 7,
    MEDICO : 8,
    AUMENTO_SUELDO : 9,
    AVANCE_PARQUE_SE : 10,
    ABRIL : 11,
    TRANSPORTES : 12,
    JUSTICIA : 13,
    PROMOCION : 14,
    MAYO : 15,
    ADELANTE_BOULEVARD_SE : 16,
    OPORTUNIDAD : 17,
    FESTIVIDADES_ROSADO : 18,
    OFERTA : 19,
    ADELANTE_AVENIDA_ESTE : 20,
    AGOSTO : 21,
    ABOGADO : 22,
    INFLACION : 23,
    BIENES_RAICES : 24,
    SETIEMBRE : 25,
    ECONOMISTA : 26,
    MORATORIA : 27,
    AVANCE_CALLE_NE : 28,
    DICIEMBRE : 29,
    FINANZAS : 30,
    DEPRESION : 31,
    VOLVER_TIRAR_DADOS_FIN : 32,
    SERVICIOS : 33,
    CIENTIFICO : 34,
    RETROCEDA6_ROSADO : 35,
    //celestes
    ANIO_NUEVO_CELESTE : 36,
    IMPRENTA : 37,
    CONSTRUCCION : 38,
    FUSION : 39,
    FEBRERO : 40,
    ENVASADORA : 41,
    PAGUE_IMPUESTO : 42,
    MARZO : 43,
    GANA_JUICIO : 44,
    JUNIO : 45,
    FABRICAS : 46,
    ADELANTE_AUTOPISTA_ESTE : 47,
    FESTIVIDADES_CELESTE : 48,
    ADELANTE_AVENIDA_NE : 49,
    TEXTILES : 50,
    JULIO : 51,
    PAGUE_DIVIDENDOS : 52,
    OCTUBRE : 53,
    QUIMICA : 54,
    PERDIO_TRABAJO : 55,
    NOVIEMBRE : 56,
    BONANZAS : 57,
    METALURGIA : 58,
    AUTOMOTORES : 59,
    //verde
    ANIO_NUEVO_VERDE : 60,
    AVANCE_FESTIVIDADES : 61,
    EXCELENTE_COSECHA : 62,
    AGRICOLA : 63,
    FRACASO : 64,
    PESCA : 65,
    FESTIVIDADES_VERDE : 66,
    PETROLEO : 67,
    DIO_EN_LA_VETA : 68,
    MINAS : 69,
    ESTA_PERDIDO : 70,
    RETROCEDA6_VERDE : 71,
    MILLONARIO : 72,
}
//TIPOS DE CASILLA
const CA_TIPO = {
    NINGUNO : 0,
    COMODIN : 1,
    TITULO_INVR : 2,
    MES : 3,
    TITULO_PROF : 4
}
//POSICIONES INTERNAS
const CA_POS_INTERNAS = [[2,0,7],[-2,0,7],[2,0,-7],[-2,0,-7]];

module.exports = {PE,TABLA_DADOS,CA,CA_POS_INTERNAS,CA_TIPO}