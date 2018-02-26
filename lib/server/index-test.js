const express = require('express');
const http = require('http');
const bodyParser = require('body-parser')
const dop = require('dop');
const util = require("util");
const Subscription = require("../model/subscription");

function newServer(context) {
    let app = express(),
        server = http.createServer(app);

    dop.listen({ httpServer: server });
    
    /*
    let scope = new Subscription();
    scope.account = { };
    scope.account.balances = { };
    scope.inject(dop.register({ }));
    dop.onSubscribe(() => scope.data);
    */
    
    let scope = dop.register({ });
    scope.account = { };
    scope.account.balances = { };
    dop.onSubscribe(() => scope);
    
    setInterval(() => {
        let idx = Math.floor(Math.random() * 100),
            value = Math.random() * 100;

        scope.account.balances[idx] = value;
    }, 100)
    
    /*
    let mainScope = context.scopes.first();
    mainScope.inject(dop.register({ }))
    dop.onSubscribe(() => mainScope.data);
    */
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