const express = require('express');
const path = require('path');
const WebSocket = require('ws');
const http = require('http');
const Partida = require('./models/partida');
const Jugador = require('./models/jugador');
const url = require("url");
const jwt = require('jsonwebtoken');
const JugadorFactory = require("./models/jugadorFactory.js");
const PartidaFactory = require("./models/partidaFactory.js");

//token secret
let secret = '1nv3$t0r';
const prtFact = new PartidaFactory();
const jugFact = new JugadorFactory();
const app = express();
app.use(express.static(path.join(__dirname,'public')));

const server = http.Server(app);
const port = process.env.PORT ?? 3000;

const wss = new WebSocket.WebSocketServer({ server: server });
wss.on('connection', function connection(ws, request) {
    const qry  = url.parse(request.url, true).query;    
    let token = qry.token;
    let username = qry.username;
    console.log(`parametros = ${JSON.stringify(qry)}`);
    if(token){//verificación de token
        reconectarUsuario(token,ws);
    }else{//nuevo inicio de sesión
        conectarUsuario(username,ws);
    }

    ws.on('error', console.error);
  
    ws.on('message', function message(data) {        
        console.log(`Mensaje recibido: ${data}`);
        const msg = JSON.parse(data);
        let ja = null;
        let partida = null;
        switch(msg.type){
            case "createGame":
                let nombrePartida = msg.content;
                //Validar nombre de partida
                if(prtFact.getByNombre(nombrePartida)){ 
                    let rsp = {type:"error",content:"ya existe una partida con ese nombre"};
                    ws.send(JSON.stringify(rsp));
                    return;
                }
                //verificar que jugador existe
                ja = jugFact.getByToken(msg.token);  
                if(!ja){
                    let rsp = {type:"error",content:`El token indicado(${msg.token}) no es válido`};
                    ws.send(JSON.stringify(rsp));
                    return;
                }
                //verificar si está en una partida
                if(ja.idpartida!=0){
                    let rsp = {type:"error",content:`${ja.nombre} ya está en una partida`};
                    ws.send(JSON.stringify(rsp));
                    return;
                }
                //crear partida
                partida = prtFact.crearPartida(nombrePartida);
                partida.agregarJugador(ja);
                console.log(`se ha creado la partida "${nombrePartida}"`);
                //notificar a jugadores
                jugFact.jugadores.forEach((j)=>{
                    //cualquier jugador que no está en una partida
                    if(j.idpartida===0){
                        let rsp = {type:"games",content:prtFact.listMini()};
                        j.wsclient.send(JSON.stringify(rsp));
                        console.log("enviando a "+j.nombre+": "+JSON.stringify(rsp));
                    }
                });
                //notiticar al usuario creador
                let rsp = {type:"game",content:{partida:partida.minify(),msj:"¡Felicitaciones! Has creado una partida."}};
                ws.send(JSON.stringify(rsp));
                break;
            case "join":
                ja = jugFact.getByToken(msg.token);
                // el usuario no existe
                if(!ja){
                    let rsp = {type:"error",content:`El token ${msg.token} no es válido`};
                    ws.send(JSON.stringify(rsp));
                    return;                    
                }
                // El usuario ya está en una partida
                if(ja.idpartida !== 0){                    
                    let msj = `El jugador ${ja.nombre} ya está en una partida`;
                    let rsp = {type:"error",content:msj};
                    ws.send(JSON.stringify(rsp));
                    console.log(msj);
                    return;
                }

                let idp = msg.content;
                partida = prtFact.getById(idp);
                partida.agregarJugador(ja);
                partida.jugadores.forEach( j => {
                    let rsp = {type:"game",content:{
                        partida:partida.minify(),
                        msj:(j.id === ja.id?`Hola ${j.nombre}, te has unido a ${partida.nombre}`:
                                            `${ja.nombre} se ha unido a la partida`)}};
                    j.wsclient.send(JSON.stringify(rsp));
                    console.log(`${j.nombre} se ha unido a "${partida.nombre}"`);
                });
                break;
            case "message":
                ja = jugFact.getByToken(msg.token);
                // el usuario no existe
                if(!ja){
                    let rsp = {type:"error",content:`El token ${msg.token} no es válido`};
                    ws.send(JSON.stringify(rsp));
                    return;                    
                }
                //el usuario no está en una partida
                if(ja.idpartida == 0){
                    let msj = `El jugador ${ja.nombre} no está en una partida`;
                    let rsp = {type:"error",content:msj};
                    ws.send(JSON.stringify(rsp));
                    console.log(msj);
                    return;
                }

                partida = prtFact.getById(ja.idpartida);
                partida.jugadores.forEach( j => {
                    let rsp = {type:"message",content:`${ja.nombre}: ${msg.content}`};
                    j.wsclient.send(JSON.stringify(rsp));
                });
                console.log(`${ja.nombre} ha enviado el mensaje "${msg.content}"`);
                break;
            case "logout":
                ja = jugFact.getByToken(msg.token);
                // el usuario no existe
                if(!ja){
                    console.log(`El token ${msg.token} no es válido`);
                    ws.close();
                    return;
                }
                //el usuario no está en una partida
                if(ja.idpartida == 0){
                    jugFact.eliminarJugador(ja);
                    ws.close();
                    console.log(`El usuario ha sido eliminado`);
                    return;
                }
                
                partida =  prtFact.getById(ja.idpartida);
                partida.eliminarJugador(ja);
                jugFact.eliminarJugador(ja);
                prtFact.cleanEmpty();                
                partida.jugadores.forEach( j => {
                    let rsp = {type:"game",content:{
                        partida:partida.minify(),
                        msj:`${ja.nombre} ha dejado la partida`}};
                    j.wsclient.send(JSON.stringify(rsp));
                });
                ws.close();
                console.log(`${ja.nombre} ha dejado la partida ${partida.nombre}`);
                break;
        }
    });
    ws.on('close', () => {
        console.log("El cliente se desconectó");
    });
});

server.listen(port,() => {
    console.log(`WS escuchando en puerto ${port}`);
});

function reconectarUsuario(token,ws){
    jwt.verify(token, secret, (err, decoded) => {
        if (err) {//existe un error en la verificación.
            console.log(`ocurrió un problema con la autenticación: ${err}`);
            ws.close();
            return;
        }
        let j = jugFact.getByToken(token);
        j.wsclient = ws;
        let rsp = {type:"loggedin",content:j.minify()};
        ws.send(JSON.stringify(rsp));
        console.log("Sesión verificada. Token reenviado.");
        if(j.idpartida == 0){
            //El jugador NO ESTÁ en una partida
            let rsp1 = {type:"games",content:prtFact.listMini()};
            ws.send(JSON.stringify(rsp1));
            console.log(`El usuario ${j.nombre} ha recibido la lista de partidas disponibles`);
        }else{
            //El jugador YA ESTÁ en una partida
            let p = prtFact.getById(j.idpartida);
            let rsp1 = {type:"game",content:{partida:p.minify(),msj:"Te has reconectado a la partida."}};
            ws.send(JSON.stringify(rsp1));
            console.log(`El usuario ${j.nombre} ha recibido el estado actual de la partida.`);
        }
          
    }); 
}

function conectarUsuario(username,ws){
    let ja = jugFact.getByNombre(username);
    if(ja){
        let token = jwt.sign({ data: username }, secret, { expiresIn: '1h' });
        ja.token = token;
        ja.wsclient = ws;
        if(ja.idpartida === 0){ 
            // El usuario no está en una partida            
            let rsp = {type:"loggedin",content:ja.minify() };
            ws.send(JSON.stringify(rsp));
            console.log(`El usuario ${username}(${ja.id}) ha iniciado sesión`);

            let rsp1 = {type:"games",content:prtFact.listMini()};
            ws.send(JSON.stringify(rsp1));
            console.log(`El usuario ${username} ha recibido las partidas`);
        }else{
            // El usuario ya está en una partida
            let p = prtFact.getById(ja.idpartida);
            let rsp = {type:"game",content:{partida:p.minify(),msj:``}};
            ja.wsclient.send(JSON.stringify(rsp));
            console.log(`El usuario ${username} recibe el estado actual de la partida`);
        }
    } else {
        let token = jwt.sign({ data: username }, secret, { expiresIn: '1h' });
        let j = jugFact.crearJugador(username,token,ws);
        let rsp = {type:"loggedin",content:j.minify() };
        ws.send(JSON.stringify(rsp));
        console.log(`El usuario ${username}(${j.id}) ha iniciado sesión`);

        let rsp1 = {type:"games",content:prtFact.listMini()};
        ws.send(JSON.stringify(rsp1));
        console.log(`El usuario ${username} ha recibido las partidas`);
    }
}
