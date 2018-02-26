const http = require('http');
const express = require('express');
const bodyParser = require('body-parser')
const util = require("util");
const WebSocket = require('ws');
const overactiv = require('overactiv').server;

function newServer(context) {
    const app = express();
    const server = http.createServer(app);
    const wss = overactiv(new WebSocket.Server({ server }));
    
    wss.host(context.scopes.first());
    
    app.use(bodyParser.urlencoded({ extended: false }));
    app.use(bodyParser.json());
    app.use(express.static(__dirname + '/static'));
    
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
    
    server.listen(8080);
    return server;
}

module.exports = newServer;