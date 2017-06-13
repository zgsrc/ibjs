"use strict";

const repl = require("repl"),
      colors = require("colors"),
      fs = require("fs"),
      IB = require("ib");

const Service = exports.Service = require("./service/service"),
      Dispatch = exports.Dispatch = require("./service/dispatch"),
      Session = exports.Session = require("./model/session"),
      Proxy = exports.Proxy = require("./service/proxy"),
      config = exports.config = require("./model/config"),
      flags = exports.flags = require("./model/flags");


////////////////////////////////////////////////////////////////////////////////////////////////////////////
// ENVIRONMENT
////////////////////////////////////////////////////////////////////////////////////////////////////////////
const id = exports.id = 0;
      
const session = exports.session = options => {
    options = options || { };

    let ib = options.ib || new IB({
        clientId: options.id || exports.id++,
        host: options.host || "127.0.0.1",
        port: options.port || 4001
    });
    
    return new Session(new Service(ib, options.dispatch || new Dispatch()));
};

const connect = exports.connect = (options, cb) => {
    if (Object.isFunction(options) && cb == null) {
        cb = options;
        options = null;
    }
    
    let sess = session(options);
    
    let timeout = setTimeout(() => {
        if (cb) {
            cb(new Error(
                "Connection timeout. Make sure TWS or IB Gateway is running and you are logged in. " + 
                "Then check IB software is configured to accept API connections over the correct port."
            ), sess);
        }
    }, options.timeout || 2500);
    
    sess.service.socket.on("connected", () => {
        clearTimeout(timeout);
        if (cb) cb(null, sess);
    }).connect();
    
    return sess;
};

const environment = exports.environment = (configuration, cb) => {
    if (cb == null && Object.isFunction(configuration)) {
        cb = configuration;
        configuration = config();
    }
    else if (configuration && /[0-9]+/.test(configuration)) {
        var port = parseInt(configuration);
        configuration = config();
        configuration.connection.port = port;
    }
    else if (configuration && Object.isString(configuration)) {
        if (fs.existsSync( configuration)) {
            configuration = JSON.parse(fs.readFileSync(configuration).toString());
        } else {
            cb(new Error(`No configuration file '${configuration}' exists.`));
            return;
        }
    }
    else if (configuration == null) {
        configuration = config();
    }
    
    connect(configuration.connection, (err, session) => {
        if (err) cb(err);
        else session.environment(configuration.environment, configuration.symbol).once("load", cb);
    });
};


////////////////////////////////////////////////////////////////////////////////////////////////////////////
// REMOTING
////////////////////////////////////////////////////////////////////////////////////////////////////////////
const proxy = exports.proxy = (socket, dispatch) => {
    return new Session(new Proxy(socket), dispatch);
};


////////////////////////////////////////////////////////////////////////////////////////////////////////////
// TERMINAL
////////////////////////////////////////////////////////////////////////////////////////////////////////////
function printError(err, prefix) {
    if (err) {
        console.log(err.message.red);
        if (err.errors) {
            err.errors.each(e => {
                console.log((" - " + err.message).gray)
                if (e.errors) {
                    e.errors.each(x => {
                        console.log(("    - " + x.message).gray);
                    });
                }
            });
        }
    }
}

const terminal = exports.terminal = configuration => {
    console.log("Starting...".green);
    environment(configuration || config(), (err, env) => {
        if (err) {
            printError(err);
            if (err.badState) {
                env.close(() => {
                    console.log("Disconnected".red)
                    process.exit(0);
                });
            }
        }
        else {
            env.on("error", printError).on("warning", msg => {
                console.log(msg.yellow);
            });
            
            console.log("Use the 'ib' variable to access the environment. Type .exit to quit.".gray);

            let cmd = repl.start('> ');
            cmd.context.ib = env;
            cmd.context.$ = env.symbols;
            
            cmd.context.search = desc => env.securities(desc, (err, sec) => {
                if (err) printError(err);
                else console.log(sec.map("summary"));
            });
            
            cmd.context.watch = (desc, opt) => env.watch(desc, opt);
            
            cmd.on("exit", () => {
                console.log("Disconnecting...".gray);
                env.close(() => {
                    console.log("Disconnected".red)
                    process.exit(0);
                });
            });
        }
    });
};


////////////////////////////////////////////////////////////////////////////////////////////////////////////
// COMMAND LINE
////////////////////////////////////////////////////////////////////////////////////////////////////////////
if (process.argv[2]) {
    let arg = process.argv[2].toLowerCase();
    if (arg == "terminal") {
        terminal(process.argv[3]);
    }
    else if (arg == "config") {
        if (process.argv[3]) {
            fs.writeFileSync(process.argv[3], JSON.stringify(config(), null, "\t"));    
        }
        else {
            console.log("Cannot write config file.  No file specified.");
        }
    }
}