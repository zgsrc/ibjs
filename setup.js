const fs = require("fs"),
      util = require("util"),
      read = util.promisify(fs.readFile);

const repl = require("repl"),
      config = require("commander"),
      json = file => JSON.parse(fs.readFileSync(file).toString());

const id = exports.id = 0,
      IB = exports.IB = require("ib"),
      Service = exports.Service = require("./service/service"),
      Dispatch = exports.Dispatch = require("./service/dispatch"),
      Proxy = exports.Proxy = require("./service/proxy"),
      Session = exports.Session = require("./session"),
      mock = require("./service/mock");

config.version("0.13.0")
    .usage("[options] [files]")
    .option("--host <host>", "Specifies the host", "localhost")
    .option("--port <port>", "Specifies the port (otherwise IB gateway default port)", parseInt, 4001)
    .option("--paper", "Uses the IB gateway default paper trading port", 4002)
    .option("--tws", "Uses the TWS default port", 7496)
    .option("--timeout <millis>", "Specifies the connection timeout", parseInt, 2500)
    .option("--scope <file>", "Configure initial scope used in context", json)
    .option("--input <file>", "Mock events from trace file")
    .option("--input-speed <rate>", "Speed (e.g. 1.0) that mock events are replayed", parseFloat, 1.0)
    .option("--output [file]", "Record events with optional file name")
    .option("--repl", "Terminal interface")
    .option("--verbose", "Think out loud")
    .option("--config <file>", "Specify a JSON configuration file instead of command line options", json);

function processCommandLineArgs() {
    config.parse(process.argv);
    
    if (config.config) {
        config = config.config;
    }
    
    if (config.paper) {
        config.port = config.paper;
        delete config.paper;
    }
    
    else if (config.tws) {
        config.port = config.tws;
        delete config.tws;
    }
    
    if (config.scope) {
        config.scope = json(config.scope);
    }
    
    config.files = config.args;
    delete config.args;
    
    return preprocessConfiguration(config);
}

exports.processCommandLineArgs = processCommandLineArgs;

function preprocessConfiguration(config) {
    if (config.output) {
        let file = config.output;
        if (Object.isBoolean(file)) {
            file = (new Date()).getTime() + ".log";
        }

        config.trace = (name, data) => {
            let msg = (new Date()).getTime() + "|" + name + "|" + JSON.stringify(data) + "\n";
            fs.appendFile(file, msg, err => err ? config.hooks.traceError(err) || console.error(err) : null);
        };
    }

    if (config.input) {
        config.ib = new Mock();
        delete config.host;
        delete config.port;
    }
    
    if (config.scope && config.scope.libraries && Object.keys(config.scope.libraries)) {
        Object.keys(config.scope.libraries).forEach(key => config.scope.libraries[key] = require(config.scope.libraries[key]));
    }
    
    if (config.hooks && Object.isString(config.hooks)) {
        config.hooks = require(config.hooks);
    }
    
    return config;
}

exports.preprocessConfiguration = preprocessConfiguration;

async function initializeSession(config) {
    if (Object.isNumber(config)) {
        config = { port: config };
    }
    
    config = config || { };
    config.id = config.id || exports.id++;
    
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
};

exports.initializeSession = initializeSession;

async function setupEnvironment(config, hooks) {
    if (config == null) {
        config = processCommandLineArgs();
    }
    
    if (hooks) {
        config.hooks = hooks;
    }
    
    config.hooks = config.hooks || { };
    
    if (config.verbose) {
        console.log("Connecting...");
    }
    
    if (config.hooks.preSession) {
        config = await config.hooks.preSession(config) || config;
    }
    
    let connection;
    if (config.hooks.initSession) {
        connection = config.hooks.initSession(config);
    }
    
    if (connection == null) {
        connection = initializeSession(config);
    }
    
    connection.then(async session => {
        if (config.hooks.session) {
            await config.hooks.session(session);
        }
        else {
            session.on("error", config.hooks.sessionError || console.error)
                   .on("disconnected", config.hooks.disconnected || (() => console.log("Disconnected")));
        }

        let scope;
        if (config.hooks.initScope) {
            scope = await config.hooks.initScope(scope);
        }
        
        scope = await session.scope(config.scope, scope);
        if (config.hooks.scope) {
            await config.hooks.scope(scope);
        }
        
        let context = scope.context();
        if (config.hooks.context) {
            await config.hooks.context(context);
        }
        
        let files = config.files.map(async file => {
            if (config.verbose) {
                console.log("Loading " + file + "...");
            }
            
            if (config.hooks.preFile) {
                file = (await config.hooks.preFile(file)) || file;
            }
            
            return config.hooks.initFile ? config.hooks.initFile(file, context) : context.load(file);
        });

        files.reduce((promise, func) => promise.then(result => func().then(Array.prototype.concat.bind(result))), Promise.resolve([])).then(async () => {
            if (config.hooks.files) {
                await config.hooks.files(config.files, context, session);
            }
            
            if (config.repl) {
                if (config.verbose) {
                    console.log("Starting REPL...\n");
                }
                
                if (config.hooks.initRepl) {
                    config.hooks.initRepl(context, session);
                }
                else {
                    let terminal = repl.start({ 
                        prompt: "> ",
                        eval: (cmd, cxt, filename, cb) => {
                            context.evaluate(cmd).then(val => cb(null, val)).catch(e => {
                                if (e.name === "SyntaxError" && /^(Unexpected end of input|Unexpected token)/.test(e.message)) cb(new repl.Recoverable(e));
                                else cb(e);
                            });
                        }
                    });
                    
                    if (config.hooks.repl) await config.hooks.repl(terminal, context, session);
                    else terminal.on("exit", () => session.close());
                }
            }
            else if (config.verbose) {
                console.log("Load complete.");
            }
            
            if (config.hooks.load) {
                config.hooks.load();
            }
        }).catch(config.hooks.fileError || console.error);
    }).catch(config.hooks.connectError || (err => {
        console.error(err.message);
        process.exit(1);
    }));

    if (config.input) {
        if (config.hooks.preReplay) await config.hooks.preReplay();
        config.ib.replay(config.input, config.inputSpeed || 1, config.hooks.postReplay);
    }
    
    process.on("uncaughtException", config.hooks.uncaughtException || console.error);
}

exports.setupEnvironment = setupEnvironment;