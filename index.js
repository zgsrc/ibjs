require("sugar").extend();

const IB = require("ib"),
      Service = require("./lib/service/service"),
      Dispatch = require("./lib/service/dispatch"),
      Proxy = require("./lib/service/proxy"),
      Session = require("./lib/session"),
      constants = require("./lib/constants");

const connectErrorHelp = "Make sure TWS or IB Gateway is running and you are logged in.\n" + 
    "Then check IB software is configured to accept API connections over the correct port.\n" +
    "If all else fails, try restarting TWS or IB Gateway.";

async function subscribe(session, options) {
    options = options || {
        session: true,
        system: true,
        account: true,
        accounts: false,
        positions: false,
        trades: true,
        orders: true,
        displayGroups: false,
        quotes: [ ] || { },
        autoStreamQuotes: false
    };

    let scope = { };
    if (options.session) scope.session = session;
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

module.exports = { IB, Service, Dispatch, Proxy, Session, constants, subscribe, id, session }