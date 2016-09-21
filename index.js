"use strict";

const repl = require("repl"),
      colors = require("colors"),
      IB = require('ib');

const Service = exports.Service = require("./service/service"),
      Dispatch = exports.Dispatch = require("./service/dispatch"),
      Session = exports.Session = require("./model/session"),
      Proxy = exports.Proxy = require("./service/proxy");

const id = exports.id = 0;
      
const connect = exports.connect = options => {
    options = options || { };

    let ib = options.ib || new IB({
        clientId: options.id || exports.id++,
        host: options.host || "127.0.0.1",
        port: options.port || 4001
    });
    
    return new Session(new Service(ib, options.dispatch || new Dispatch()));
};

const proxy = exports.proxy = (socket, dispatch) => {
    return new Session(new Proxy(socket), dispatch);
};

const terminal = exports.terminal = session => {
    let timeout = setTimeout(() => {
        console.log("Connection timeout.".red);
        console.log("Make sure TWS or IB Gateway is running and you are logged in. Then check IB software is configured to accept API connections over the correct port.".gray);
        process.exit(0);
    }, 2500);
    
    process.on("uncaughtException", err => {
        console.log("UNCAUGHT ERROR: ".red + err.stack.red);
    });
    
    console.log("Connecting...".gray);
    session.service.socket.on("connected", () => {
        clearTimeout(timeout);
        
        console.log("Connected".green);
        console.log("Use the 'ib' variable to access the environment. Type .exit to quit.".gray);
        
        let cmd = repl.start('> '),
            env = session.environment();
        
        env.on("error", err => {
            console.log(err.message.red);
        }).on("warning", msg => {
            console.log(msg.yellow);
        }).on("badState", () => {
            console.log("IB API unresponsive!!! Try restarting IB software and reconnecting.".red);
            process.exit(0);
        });
        
        cmd.context.ib = env;
        cmd.context.watch = (desc, opt) => env.watch(desc, opt);
        cmd.context.$ = env.symbols;
        
        cmd.on("exit", () => {
            console.log("Disconnecting...".gray);
            session.service.socket.once("disconnected", () => console.log("Disconnected".red));
            session.service.socket.disconnect();
        });
    }).connect();
};

if (process.argv[2] && process.argv[2] == "terminal") {
    terminal(connect({ port: process.argv[3] || 4001 }));
}