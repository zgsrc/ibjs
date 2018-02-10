"use strict";

require("sugar").extend();

const connectMessage = "Make sure TWS or IB Gateway is running and you are logged in.\n" + 
    "Then check IB software is configured to accept API connections over the correct port.\n" +
    "If all else fails, try restarting TWS or IB Gateway.";

const id = exports.id = 0,
      IB = exports.IB = require("ib"),
      Service = exports.Service = require("./service/service"),
      Dispatch = exports.Dispatch = require("./service/dispatch"),
      Proxy = exports.Proxy = require("./service/proxy"),
      Session = exports.Session = require("./model/session"),
      constants = exports.constants = require("./model/constants"),
      studies = exports.studies = require("./model/studies"),
      proxy = exports.proxy = (socket, dispatch) => new Service(new Proxy(socket), dispatch);

async function session(options) {
    if (Object.isNumber(options)) {
        options = { port: options };
    }
    
    options = options || { };
    options.id = options.id || exports.id++;
    
    return new Promise((yes, no) => {
        let timeout = setTimeout(() => {
            no(new Error("Connection timeout. " + connectMessage));
        }, options.timeout || 2500);
        
        let ib = options.ib || new IB({
            clientId: options.id,
            host: options.host || "127.0.0.1",
            port: options.port || 4001
        });

        if (options.trace && typeof options.trace == "function") {
            ib.on("all", options.trace);
        }

        if (typeof options.orders == "undefined") {
            options.orders = "passive"; // "all", "local", "passive"
        }

        new Session(
            new Service(ib, options.dispatch || new Dispatch()), 
            options
        ).once("load", sess => {
            clearTimeout(timeout);
            yes(sess);
        }).once("error", err => {
            clearTimeout(timeout);
            no(err);
        }).service.socket.once("error", err => {
            clearTimeout(timeout);
            if (err.code == "ECONNREFUSED") no(new Error("Connection refused. " + connectMessage));
            else no(err);
        }).connect();
    });
};

exports.session = session;