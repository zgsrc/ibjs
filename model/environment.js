"use strict";

const Events = require("events"),
      async = require("async"),
      config = require("./config");

class Environment extends Events {
    
    constructor(session, options, symbolDefaults) {
        
        super();
        
        this.defaults = config();
        this.defaults.environment = options = options || this.defaults.environment;
        this.defaults.symbol = symbolDefaults || this.defaults.symbol;
        
        this.session = session;
        
        let loadCount = 0,
            loadTimeouts = 0,
            loadErrors = 0,
            loadSuccess = 0,
            loadErrorsList = [ ];
        
        let errorHandler = err => {
            if (err.timeout) loadTimeouts++;
            else loadErrors++;

            if (loadCount == loadTimeouts) {
                let bs = new Error("IB API unresponsive. Try restarting IB software and reconnecting.");
                bs.badState = true;
                bs.errors = loadErrorsList;
                
                this.loaded = true;
                this.emit("load", bs, this);
            }
            else if (loadCount == loadTimeouts + loadErrors + loadSuccess) {
                let le = new Error("Errors encountered during initial load.");
                le.errors = loadErrorsList;
                
                this.loaded = true;
                this.emit("load", le, this);
            }
        };
        
        let loadHandler = err => {
            if (err) {
                errorHandler(err);
                return;
            }
            else loadSuccess++;

            if (loadCount == loadSuccess) {
                this.loaded = true;
                this.emit("load", null, this);
            }
            else if (loadCount == loadTimeouts + loadErrors + loadSuccess) {
                let le = new Error("Errors encountered during initial load.");
                le.errors = loadErrorsList;
                
                this.loaded = true;
                this.emit("load", le, this);
            }
        };

        let loadTimer = setTimeout(() => {
            if (!this.loaded) {
                let to = new Error("Environment load time out.");
                to.timeout = true;
                this.emit("load", to, this);
            }
        }, options.timeout || 30000);
        
        let load = obj => {
            loadCount++;
            obj.once("error", errorHandler)
               .once("load", loadHandler);
            
            setTimeout(() => obj.removeListener("error", errorHandler), options.timeout || 30000);
            setTimeout(() => obj.removeListener("load", loadHandler), options.timeout || 30000);
        };
        
        let emitError = err => {
            if (this.loaded) this.emit("error", err);
            else loadErrorsList.push(err);
        }
        
        this.system = this.session.system();    
        this.system
            .on("error", emitError)
            .on("warning", msg => this.emit("warning", msg))
            .on("update", data => this.emit("update", { type: "system", data: data }));
        
        if (options.system) {
            this.system.stream();
        }
        
        this.accounts = this.session.accounts();    
        this.accounts
            .on("error", emitError)
            .on("warning", msg => this.emit("warning", msg))
            .on("update", data => this.emit("update", { type: "accounts", data: data }));
        
        if (options.accounts) {
            if (Array.isArray(options.accounts)) {
                this.accounts.tags = options.accounts;
            }
            
            load(this.accounts);
            this.accounts.stream();
        }
        
        this.positions = this.session.positions();    
        this.positions
            .on("error", emitError)
            .on("warning", msg => this.emit("warning", msg))
            .on("update", data => this.emit("update", { type: "positions", data: data }));
        
        if (options.positions) {
            load(this.positions);
            this.positions.stream();
        }
        
        this.executions = this.session.executions(Object.isObject(options.executions) ? options.executions : null);
        this.executions
            .on("error", emitError)
            .on("warning", msg => this.emit("warning", msg))
            .on("update", data => this.emit("update", { type: "executions", data: data }));
        
        if (options.executions) {
            load(this.executions);
            this.executions.stream();
        }
        
        this.orders = this.session.orders();    
        this.orders
            .on("error", emitError)
            .on("warning", msg => this.emit("warning", msg))
            .on("update", data => this.emit("update", { type: "orders", data: data }));

        if (options.orders) {
            load(this.orders);
            this.orders.autoOpenOrders(options.orders == "all");
            this.orders.stream(options.orders == "all");
        }
        
        this.symbols = { };
        if (options.symbols && options.symbols.length) {
            let symbolLoad = (err, symbol) => {
                if (err) errorHandler(err);
                else symbol.on("load", loadHandler);
            };
            
            options.symbols.each(security => {
                loadCount++;
                if (Array.isArray(security)) this.watch(security[0], security[1], symbolLoad);
                else if (Object.isObject(security)) this.watch(security.description, security.options, symbolLoad);
                else this.watch(security, null, symbolLoad);
            });
        }
    }
    
    watch(description, options, cb) {
        options = Object.merge(Object.clone(this.defaults.symbol), options || { });
        this.session.security(description, (err, security) => {
            if (err) {
                this.emit("error", err);
                if (cb) cb(err);
            }
            else {
                let symbol = security.symbol(options);
                if (symbol.name) this.symbols[symbol.name] = symbol;
                
                symbol.on("close", () => delete this.symbols[symbol.name])
                      .on("error", err => this.emit("error", err))
                      .on("warning", msg => this.emit("warning", msg));
                
                if (cb) cb(null, symbol);
            }
        });
    }
    
    close(cb) {
        let socket = this.session.socket;
        if (socket && !socket.isProxy) {
            if (socket.disconnect && Object.isFunction(socket.disconnect)) {
                this.session.socket.once("disconnected", () => {
                    if (cb) cb();
                }).disconnect();
            }
            else if (cb) cb();
        }
        else if (cb) cb();
    }
    
}

module.exports = Environment;