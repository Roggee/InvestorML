const Partida = require('./partida');

class PartidaFactory{
    constructor() {
        this.partidas = [];
    }
    crearPartida(nombre){
        let maxId = 0;
        this.partidas.map((pd) => {            
            maxId = Math.max(maxId, pd.id);
        });
        let p = new Partida(maxId+1,nombre);
        this.partidas.push(p);
        return p;
    }
    getById(id){
        const pa = this.partidas.find(p => {return p.id == id});
        return pa;
    }
    getByNombre(nombre){
        const pa = this.partidas.find(p => {return p.nombre == nombre});
        return pa;
    }
    listMini(){
        let minPartidas = [];
        let disponibles = this.partidas.filter(p => p.estado==Partida.PREPARACION);
        disponibles.forEach((p)=>{ minPartidas.push({id:p.id,nombre:p.nombre,pop:(p.numJugadores+"/"+p.maxJugadores)}) });
        return minPartidas;
    }
    cleanEmpty(){
        this.partidas = this.partidas.filter( p => p.numJugadores>0);
    }
}

module.exports = PartidaFactory;