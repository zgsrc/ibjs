"use strict";

const fs = require("fs"),
      IB = require("ib"),
      Service = exports.Service = require("./service/service"),
      Dispatch = exports.Dispatch = require("./service/dispatch"),
      Proxy = exports.Proxy = require("./service/proxy"),
      Session = exports.Session = require("./model/session"),
      flags = exports.flags = require("./model/flags"),
      id = exports.id = 0;

const open = exports.open = (options, cb) => {
    if (Object.isFunction(options) && cb == null) {
        cb = options;
        options = { };
    }
    
    options = options || { };
    
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

const session = exports.session = options => {
    options = options || { };

    let ib = options.ib || new IB({
        clientId: options.id || exports.id++,
        host: options.host || "127.0.0.1",
        port: options.port || 4001
    });
    
    if (options.trace) {
        ib.on("all", (name, data) => {
            fs.appendFile(options.trace, (new Date()) + " | " + name + ": " + data + "\n", err => {
                throw err;
            });
        });
    }
    
    return new Session(new Service(ib, options.dispatch || new Dispatch()));
};

const proxy = exports.proxy = (socket, dispatch) => {
    return new Session(new Proxy(socket), dispatch);
};