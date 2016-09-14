"use strict";

const Events = require("events"),
      async = require("async");

class Environment extends Events {
    
    constructor(session, options) {
        super();
        
        options = options || { 
            system: true,
            accounts: true,
            positions: true,
            executions: true,
            orders: "all"
        };
        
        this.session = session;
        
        let badState = 0,
            badStateHandler = err => {
                if (err.timeout) {
                    badState--;
                    if (badState == 0) this.emit("badState");
                }
            },
            badStateWatcher = obj => {
                badState++;
                obj.once("error", badStateHandler);
                setTimeout(() => obj.removeListener("error", badStateHandler), 15000);
            };
        
        if (options.system) {
            this.system = this.session.system();
            this.system.on("message", data => this.emit("message", data));
        }
        
        if (options.accounts) {
            this.accounts = this.session.accounts();
            this.accounts.on("error", err => this.emit("error", err));
            badStateWatcher(this.accounts);
        }
        
        if (options.positions) {
            this.positions = this.session.positions();
            this.positions.on("error", err => this.emit("error", err));
            badStateWatcher(this.positions);
        }
        
        if (options.executions) {
            this.executions = this.session.executions();
            this.executions.on("error", err => this.emit("error", err));
            badStateWatcher(this.executions);
        }
        
        if (options.orders) {
            if (options.orders == "all") {
                this.orders = this.session.orders(true);
                this.orders.autoOpenOrders(true);
            }
            else {
                this.orders = this.session.orders(false);
                this.orders.autoOpenOrders(false);
            }
            
            this.orders.on("error", err => this.emit("error", err));
            badStateWatcher(this.orders);
        }
        
        this.symbols = { };
        if (options.symbols) {
            options.symbols.each(security => {
                if (security) {
                    if (Array.isArray(security)) this.define(...security);
                    else if (Object.isObject(security)) this.define(security.description, security.options);
                    else this.define(security);
                }
            });
        }
    }
    
    define(description, options) {
        this.session.security(description, (err, security) => {
            if (err) {
                this.emit("error", err);
            }
            else {
                let symbol = security.symbol(options);
                
                if (symbol.name) {
                    this.symbols[symbol.name] = symbol;
                }
                
                symbol.on("close", () => {
                    if (symbol.name) {
                        delete this.symbols[symbol.name];
                    }
                });
                
                symbol.on("error", err => this.emit("error", err));
                
                symbol.once("ready", () => this.emit("symbol", symbol));
            }
        });
    }
    
}

module.exports = Environment;