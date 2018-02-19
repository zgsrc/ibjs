const express = require('express');
const http = require('http');
const bodyParser = require('body-parser')

function newServer(context) {
    let app = express(),
        server = http.createServer(app);
    
    app.use(bodyParser.urlencoded({ extended: false }));
    
    app.use(bodyParser.json());
    
    app.use(express.static('static'));
    
    app.post("/eval", async (req, res) => {
        res.json(await context.evalInContext(req.body.src));
    });
    
    app.post("/call", async (req, res) => {
        res.json(await context.callInContext(req.body.src));
    });
    
    app.post("/run", async (req, res) => {
        res.json(await context.runInContext(req.body.src));
    });
    
    app.get("/:name", async (req, res) => {
        if (req.params.name[0] == "$") {
            await context.reifyImplicitIdentifiers(req.params.name);
        }
        
        res.json(context.scope[req.params.name]);
    });
    
    context.scopes[0].host({ httpServer: server });
    
    server.listen(4444);
    return server;
}

module.exports = newServer;