const Jugador = require('./jugador');

class JugadorFactory{
    constructor() {
        this.jugadores = [];
    }
    crearJugador(nombre,token,ws){
        let maxId = 0;
        this.jugadores.map((jd) => {            
            maxId = Math.max(maxId, jd.id);
        });
        let j = new Jugador(maxId+1,nombre);
        j.wsclient = ws;
        j.token = token;
        this.jugadores.push(j);
        return j;
    }
    eliminarJugador(jugador){
        this.jugadores = this.jugadores.filter( j => j !== jugador);
    }
    getByNombre(nombre){
        const jdr = this.jugadores.filter(j => j.nombre == nombre);
        return jdr[0];
    }
    getByToken(token){
        const jdr = this.jugadores.filter((j) => j.token == token);
        return jdr[0];
    }
}

module.exports = JugadorFactory;