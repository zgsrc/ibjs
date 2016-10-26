"use strict";

const repl = require("repl"),
      colors = require("colors"),
      fs = require("fs"),
      IB = require("ib");

const Service = exports.Service = require("./service/service"),
      Dispatch = exports.Dispatch = require("./service/dispatch"),
      Session = exports.Session = require("./model/session"),
      Proxy = exports.Proxy = require("./service/proxy"),
      config = exports.config = require("./model/config");


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
            cb(new Error("Connection timeout. Make sure TWS or IB Gateway is running and you are logged in. Then check IB software is configured to accept API connections over the correct port."), sess);
        }
    }, options.timeout || 2500);
    
    sess.service.socket.on("connected", () => {
        clearTimeout(timeout);
        cb(null, sess);
    }).connect();
    
    return sess;
};

const environment = exports.environment = (config, cb) => {
    connect(config.connection, (err, session) => {
        if (err) cb(err);
        else session.environment(config.environment).once("load", cb);
    });
}


////////////////////////////////////////////////////////////////////////////////////////////////////////////
// REMOTING
////////////////////////////////////////////////////////////////////////////////////////////////////////////
const proxy = exports.proxy = (socket, dispatch) => {
    return new Session(new Proxy(socket), dispatch);
};


////////////////////////////////////////////////////////////////////////////////////////////////////////////
// TERMINAL
////////////////////////////////////////////////////////////////////////////////////////////////////////////
const terminal = exports.terminal = config => {
    console.log("Starting...".green);
    environment(config, (err, env) => {
        if (err) {
            console.log(err.message.red);
            if (err.errors) {
                err.errors.each(e => {
                    console.log(err.message.gray)
                    if (e.errors) {
                        e.errors.each(x => {
                            console.log((" - " + x.message).gray);
                        });
                    }
                });
            }
            
            if (err.badState) {
                env.close(() => {
                    console.log("Disconnected".red)
                    process.exit(0);
                });
            }
        }
        else {
            env.on("error", err => {
                console.log(err.message.red);
                if (err.errors) {
                    err.errors.each(e => {
                        console.log((" - " + e.message).gray);
                    });
                }
            }).on("warning", msg => {
                console.log(msg.yellow);
            });
            
            console.log("Use the 'ib' variable to access the environment. Type .exit to quit.".gray);

            let cmd = repl.start('> ');
            cmd.context.ib = env;
            cmd.context.watch = (desc, opt) => env.watch(desc, opt);
            cmd.context.$ = env.symbols;

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

if (process.argv[2] && process.argv[2] == "terminal") {
    terminal(config());
}