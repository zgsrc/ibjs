const http = require('http');
const express = require('express');
const bodyParser = require('body-parser')
const util = require("util");
const WebSocket = require('ws');
const overactiv = require('hyperactiv/websocket/server').server;

function newServer(subscriptions, port) {
    const app = express();
    const server = http.createServer(app);
    const wss = overactiv(new WebSocket.Server({ server }));
    
    wss.host(subscriptions);
    
    app.use(express.static("./static"));
    app.use(bodyParser.urlencoded({ extended: false }));
    app.use(bodyParser.json());
    app.use(express.static(__dirname + '/static'));
    
    app.get("/cmd/:cmd", async (req, res) => {
        let cmd = req.params.cmd;
        res.send(cmd);
    });
    
    app.post("/eval", async (req, res) => {
        let src = req.body.src.trim();
        if (src.length) {
            try {
                let result = await context.evalInContext(req.body.src);
                res.send(util.inspect(result));
            }
            catch (ex) {
                res.send(util.inspect(ex));
            }
        }
        else res.end();
    });
    
    server.listen(Number.isInteger(port) ? port : 8080);
    return server;
}

module.exports = newServer;