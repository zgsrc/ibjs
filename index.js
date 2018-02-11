require("sugar").extend();

const connectErrorHelp = "Make sure TWS or IB Gateway is running and you are logged in.\n" + 
    "Then check IB software is configured to accept API connections over the correct port.\n" +
    "If all else fails, try restarting TWS or IB Gateway.";


////////////////////////////////////////////////////////////////////////
// NOT THAT YOU NEED IT, BUT YOU MIGHT WANT IT
////////////////////////////////////////////////////////////////////////
const id = exports.id = 0,
      IB = exports.IB = require("ib"),
      Service = exports.Service = require("./service/service"),
      Dispatch = exports.Dispatch = require("./service/dispatch"),
      Proxy = exports.Proxy = require("./service/proxy"),
      proxy = exports.proxy = (socket, dispatch) => new Service(new Proxy(socket), dispatch),
      Session = exports.Session = require("./session");


////////////////////////////////////////////////////////////////////////
// THE PROGRAMMING INTERFACE
////////////////////////////////////////////////////////////////////////
const constants = exports.constants = require("./constants"),
      studies = exports.studies = require("./model/studies");

async function session(options) {
    if (Object.isNumber(options)) {
        options = { port: options };
    }
    
    options = options || { };
    options.id = options.id || exports.id++;
    
    return new Promise((yes, no) => {
        let timeout = setTimeout(() => {
            no(new Error("Connection timeout. " + connectErrorHelp));
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
            if (err.code == "ECONNREFUSED") no(new Error("Connection refused. " + connectErrorHelp));
            else no(err);
        }).connect();
    });
};

exports.session = session;