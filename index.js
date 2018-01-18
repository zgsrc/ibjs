"use strict";

// IMPOSED DESIGN OPINION
// * Programming the rest of the SDK is either 
// * not functional or readable otherwise.
require("sugar").extend();

const id = exports.id = 0,
      IB = exports.IB = require("ib"),
      Service = exports.Service = require("./service/service"),
      Dispatch = exports.Dispatch = require("./service/dispatch"),
      Proxy = exports.Proxy = require("./service/proxy"),
      Session = exports.Session = require("./model/session"),
      flags = exports.flags = require("./model/flags"),
      studies = exports.studies = require("./model/marketdata/studies"),
      RealTime = exports.RealTime = require("./model/realtime"),
      MarketData = exports.MarketData = require("./model/marketdata/marketdata");

const session = exports.session = options => {
    options = options || { };

    let ib = options.ib || new IB({
        clientId: options.id || exports.id++,
        host: options.host || "127.0.0.1",
        port: options.port || 4001
    });
    
    if (options.trace && typeof options.trace == "function") {
        ib.on("all", options.trace);
    }
    
    return new Session(new Service(ib, options.dispatch || new Dispatch()));
};

const proxy = exports.proxy = (socket, dispatch) => {
    return new Session(new Proxy(socket), dispatch);
};

const open = exports.open = (options, cb) => {
    if (typeof options == "function" && cb == null) {
        cb = options;
        options = { };
    }
    
    options = options || { };
    
    let timeout = setTimeout(() => {
        cb(new Error(
            "Connection timeout. Make sure TWS or IB Gateway is running and you are logged in. " + 
            "Then check IB software is configured to accept API connections over the correct port. " +
            "If all else fails, try restarting TWS or IB Gateway."
        ));
        
        cb = null;
    }, options.timeout || 500);
    
    session(options).once("ready", sess => {
        clearTimeout(timeout);
        if (cb) {
            cb(null, sess);
            cb = null;
        }
    }).once("error", err => {
        clearTimeout(timeout);
        if (cb) {
            cb(err);
            cb = null;
        }
    }).service.socket.once("error", err => {
        clearTimeout(timeout);
        if (cb) {
            cb(err);
            cb = null;
        }
    }).connect();
};

const start = exports.start = options => {
    if (Object.isNumber(options)) {
        options = { port: options };
    }
    
    return new Promise((yes, no) => {
        open(options, (err, session) => {
            if (err) no(err);
            else yes(session);
        });
    });
}

const account = exports.account = options => {
    if (Object.isString(options)) {
        options = { account: options };
    }
    
    return start(options).then(session => session.account(options ? options.account : null));
};

const accounts = exports.accounts = options => {
    return start(options).then(session => session.accounts(options ? options.accounts : null));
};