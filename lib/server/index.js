const express = require('express');
const http = require('http');
const bodyParser = require('body-parser')
const dop = require('dop');
const util = require("util");

function newServer(context) {
    let app = express(),
        server = http.createServer(app);

    dop.listen({ httpServer: server });
    context.scopes[0].host();
    
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
    
    server.listen(4444);
    return server;
}

module.exports = newServer;