const {DIAG_TIPO,DIAG_RSP} = require("./valores");

class Dialogo{
    
    constructor(partida){
        this.partida = partida;
        this.id = -1;  
        this.tipo = undefined;
        this.contenido = undefined;
        this.codigoRetorno = undefined;
    }
    
    abrir(tipo,contenido){
        let maxId = 0;
        this.partida.dialogos.forEach( d => {
            if(d.id>maxId) maxId = d.id;
        });
        this.id = maxId+1;
        this.tipo = tipo;
        this.contenido = contenido;
        //insertar al inicio. En el cliente, sólo la primera ventana se mostrará.
        this.partida.dialogos =[this,...this.partida.dialogos];
    }

    cerrar(){
        this.partida.dialogos = this.partida.dialogos.filter( d => { return d.id != this.id} );
    }
}
module.exports = Dialogo;