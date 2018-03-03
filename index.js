require("sugar").extend();

////////////////////////////////////////////////////////////////////////////////////////////////
// Open Session
////////////////////////////////////////////////////////////////////////////////////////////////
const IB = require("ib"),
      Service = require("./lib/service/service"),
      Dispatch = require("./lib/service/dispatch"),
      Proxy = require("./lib/service/proxy"),
      Session = require("./lib/session"),
      constants = require("./lib/constants");

const connectErrorHelp = "Make sure TWS or IB Gateway is running and you are logged in.\n" + 
    "Then check IB software is configured to accept API connections over the correct port.\n" +
    "If all else fails, try restarting TWS or IB Gateway.";

let id = 0;

async function session(config) {
    if (Object.isNumber(config)) config = { port: config };
    config = config || { };
    config.id = config.id >= 0 ? config.id : id++;
    if (!Number.isInteger(config.id)) throw new Error("Client id must be an integer: " + config.id);
    if (config.host && typeof config.host !== 'string') throw new Error("Host must be a string: " + config.host);
    if (config.port && !Number.isInteger(config.port)) throw new Error("Port must be a number: " + config.port);
    
    return new Promise((yes, no) => {
        let timeout = setTimeout(() => {
            no(new Error("Connection timeout. " + connectErrorHelp));
        }, config.timeout || 2500);
        
        let ib = config.ib || new IB({
            clientId: config.id,
            host: config.host || "127.0.0.1",
            port: config.port || 4001
        });

        if (config.trace && typeof config.trace == "function") {
            ib.on("all", config.trace);
        }

        if (typeof config.orders == "undefined") {
            config.orders = "passive"; // "all", "local", "passive"
        }

        new Session(
            new Service(ib, config.dispatch || new Dispatch()), 
            config
        ).once("load", sess => {
            clearTimeout(timeout);
            Object.defineProperty(sess, "subscribe", { value: options => subscribe(sess, options), enumerable: false });
            yes(sess);
        }).once("error", err => {
            clearTimeout(timeout);
            no(err);
        }).service.socket.once("error", err => {
            clearTimeout(timeout);
            if (err.code == "ECONNREFUSED") no(new Error("Connection refused. " + connectErrorHelp));
            else no(err);
        }).connect();
    });
}

async function subscribe(session, options) {
    let scope = { };
    if (options.system) {
        scope.system = session.system();
        if (options.system == "frozen") scope.system.useFrozenMarketData = true;
    }

    if (options.displayGroups) scope.displayGroups = await session.displayGroups();
    if (options.account) scope.account = await session.account(Object.isObject(options.account) ? options.account : null);
    if (options.accounts) scope.accounts = await session.accounts();
    if (options.positions) scope.positions = await session.positions();
    if (options.trades) scope.trades = await session.trades(Object.isObject(options.trades) ? options.trades : null);

    if (options.orders) {
        scope.orders = session.orders;
        scope.order = description => session.order(description);
    }

    if (options.quotes) {
        if (Array.isArray(options.quotes)) {
            await Promise.all(options.quotes.map(async description => {
                let quote = await session.quote(description.description || description);
                scope[quote.contract.toString()] = quote;
                if (description.fields) session.query.addFieldTypes(description.fields);
                if (options.autoStreamQuotes) {
                    if (options.autoStreamQuotes == "all") return quote.streamAll();
                    else return quote.stream();
                }
                else quote.refresh();
            }));
        }
        else {
            await Promise.all(Object.keys(options.quotes).map(async key => {
                let description = options.quotes[key];
                let quote = scope[key] = await session.quote(description.description || description);
                if (description.fields) session.query.addFieldTypes(description.fields);
                if (options.autoStreamQuotes) {
                    if (options.autoStreamQuotes == "all") return quote.streamAll();
                    else return quote.stream();
                }
                else quote.refresh();
            }));
        }
    }

    return scope;
}

////////////////////////////////////////////////////////////////////////////////////////////////
// Create Express App Interface
////////////////////////////////////////////////////////////////////////////////////////////////
const http = require('http'),
      WebSocket = require('ws'),
      express = require('express'),
      bodyParser = require('body-parser'),
      util = require('util');

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

////////////////////////////////////////////////////////////////////////////////////////////////
// Startup Environment
////////////////////////////////////////////////////////////////////////////////////////////////
const createContext = require("./runtime"),
      wellKnownSymbols = require("./lib/symbol").wellKnownSymbols,
      repl = require("repl"),
      { observe, computed, dispose } = require("hyperactiv"),
      { Observable, Computable } = require("hyperactiv/mixins"),
      ObservableObject = Computable(Observable(Object)),
      wss = require('hyperactiv/websocket/server').server;

async function environment(config) {
    config.hooks = config.hooks || { };
    if (config.hooks.init) await config.hooks.init(config);
    
    if (config.symbols) {
        Object.assign(wellKnownSymbols, config.symbols)
    }
    
    if (config.output) {
        let file = config.output;
        if (Object.isBoolean(file)) {
            config.output = Date.create().format("{dow}-{H}:{mm}:{ss}")
            file = config.output + ".api.log";
        }

        config.trace = (name, data) => {
            let msg = (new Date()).getTime() + "|" + name + "|" + JSON.stringify(data) + "\n";
            fs.appendFile(file, msg, err => err ? config.hooks.traceError(err) || console.error(err) : null);
        };
    }
    
    let connection;
    if (config.verbose) console.log("Connecting...");
    session(config).then(async session => {
        if (config.verbose) console.log("Session established");
        session.on("error", config.hooks.error || console.error);
        
        let context = createContext();
        context.scopes.unshift(require("./lib/model/market").markets);
        if (config.hooks.setup) await config.hooks.setup(session, context);
        
        if (config.verbose) console.log("Opening subscriptions...");
        let subscriptions = await session.subscribe(config.subscriptions || { });
        if (config.output) {
            fs.appendFile(config.output + ".change.log", JSON.stringify({ type: "sync", state: subscriptions }), err => err ? config.hooks.traceError(err) || console.error(err) : null)
        }
        
        if (config.http) {
            if (config.verbose) console.log(`Starting HTTP server on port ${Number.isInteger(config.http) ? config.http : 8080}...`);
            const app = createApp(context);
            if (config.html) app.use(express.static(config.html));
            
            const server = http.createServer(app), endpoint = wss(new WebSocket.Server({ server }));
            context.scopes.unshift(endpoint.host(subscriptions));
            server.listen(Number.isInteger(config.http) ? config.http : 8080);
        }
        else {
            subscriptions = Object.assign(new ObservableObject({ }, { bubble: true, batch: true }), subscriptions);
            context.scopes.unshift(subscriptions);
        }
        
        if (config.output) {
            subscriptions.__handler = (keys, value, old, proxy) => {
                fs.appendFile(config.output + ".change.log", JSON.stringify({ type: "update", keys: keys, value: value }), err => err ? config.hooks.traceError(err) || console.error(err) : null)
            };
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
        
        if (config.globals) {
            if (typeof config.globals === 'string') {
                config.globals = fs.readdirSync(config.globals).filter(file => file[0] !== '.' && file.endsWith(".js"));
            }
            
            if (Array.isArray(config.globals)) {
                for (let i = 0; i < config.globals.length; i++) {
                    if (config.verbose) console.log("Including " + config.globals[i])
                    await context.include(config.globals[i]);
                }
            }
        }
        
        if (config.modules) {
            if (typeof config.modules === 'string') {
                config.modules = fs.readdirSync(config.modules).filter(file => file[0] !== '.' && file.endsWith(".js"));
            }
            
            if (Array.isArray(config.modules)) {
                for (let i = 0; i < config.modules.length; i++) {
                    if (config.verbose) console.log("Importing " + config.modules[i])
                    await context.import(config.modules[i]);
                }
            }
        }
        
        if (config.hooks.load) config.hooks.load(session, context);
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

////////////////////////////////////////////////////////////////////////////////////////////////
// Exports
////////////////////////////////////////////////////////////////////////////////////////////////
module.exports = { IB, Service, Dispatch, Proxy, Session, constants, session, environment }