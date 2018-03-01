const { session, constants } = require("../index"),
      { processCommandLineArgs, preprocess } = require("./program"),
      { observe, computed, dispose } = require("hyperactiv"),
      { Observable, Computable } = require("hyperactiv/mixins"),
      wss = require('hyperactiv/websocket/server').server,
      ObservableObject = Computable(Observable(Object)),
      Context = require("./context"),
      http = require('http'),
      WebSocket = require('ws'),
      express = require('express'),
      bodyParser = require('body-parser'),
      util = require('util'),
      repl = require("repl");

function createApp(context, app) {
    app = app || express();
    
    app.use("/hyperactiv", express.static("node_modules/hyperactiv"));
    app.use(express.static(__dirname + '/html'));
    app.use(bodyParser.urlencoded({ extended: false }));
    app.use(bodyParser.json());
    
    app.get('/cmd/:cmd', async (req, res) => {
        let cmd = req.params.cmd;
        res.send(cmd);
    });
    
    app.post('/eval', async (req, res) => {
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
    
    return app;
}

async function environment(config) {
    if (config == null) config = processCommandLineArgs();
    else config = preprocess(config);
    
    config.hooks = config.hooks || { };
    if (config.hooks.config) await config.hooks.config(config);
    
    let connection;
    if (config.verbose) console.log("Connecting...");
    session(config).then(async session => {
        if (config.verbose) console.log("Session established");
        session.on("error", config.hooks.error || console.error);
        
        if (config.verbose) console.log("Opening subscriptions...");
        let subscriptions = await session.subscribe(config.subscriptions);
        
        let context = new Context(constants, { observe, computed, dispose, Observable, Computable }, global);
        context.resolvers.push(name => session.quote(name));
        if (config.hooks.context) await config.hooks.context(context);
        
        if (config.http) {
            if (config.verbose) console.log(`Starting HTTP server on port ${Number.isInteger(config.http) ? config.http : 8080}...`);
            
            const server = http.createServer(createApp(context)), endpoint = wss(new WebSocket.Server({ server }));
            context.scopes.unshift(endpoint.host(subscriptions));
            server.listen(Number.isInteger(config.http) ? config.http : 8080);
        }
        else {
            subscriptions = Object.assign(new ObservableObject({ }), subscriptions);
            context.scopes.unshift(subscriptions);
        }
        
        if (config.repl) {
            if (config.verbose) console.log("Starting REPL...\n");
            let terminal = repl.start({ prompt: "> ", eval: context.replEval });
            terminal.on("exit", () => session.close(true));
        }
        else if (config.verbose) console.log("Ready.");
        
        process.on("exit", config.hooks.exit || (() => session.close()));
        process.on("SIGINT", config.hooks.sigint || (() => session.close()));
        process.on("message", msg => msg == "shutdown" ? session.close() : null);
        if (Object.isFunction(process.send)) process.send("ready");
        if (config.hooks.ready) config.hooks.ready(session, context);
    }).catch(config.hooks.error || (err => {
        console.error(err);
        process.exit(1);
    }));

    if (config.input) {
        config.ib.replay(config.input, config.inputSpeed || 1, config.hooks.afterReplay);
    }
    
    process.on("warning", config.hooks.warning || config.hooks.error || console.warn);
    process.on("uncaughtException", config.hooks.error || console.error);
}

module.exports = environment;