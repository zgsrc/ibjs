"use strict";

let Events = require("events");

class Environment extends Events {
    
    constructor(session) {
        super();
        
        Object.defineProperty(this, "session", { value: session });
        
        this.workspace = { };
    }
    
    assign(name, value) {
        if (!this.workspace.symbols) {
            this.workspace.symbols = [ ];
        }
        
        if (this.workspace[name] == null) {
            this.workspace[name] = value;
            this.workspace.symbols.append(name).sort();
        }
    }
    
    free(name) {
        if (this.workspace[name]) {
            this.workspace[name].cancel();
        }
        
        delete this.workspace[name];
        this.symbols.remove(name);
    }
    
    security(symbol, cb) {
        this.session.securities(symbol, (err, securities) => {
            if (err) {
                if (cb) cb(err);
                else this.emit("error", err);
            }
            else {
                securities.forEach(s => {
                    s.environment = this;
                    this.assign(s.contract.symbol, s);
                });
                
                if (cb) cb(null, securities);
                else this.emit("load", securities);
            }
        });
    }
    
    securities(symbols, interval, cb) {
        if (cb == null && typeof interval == "function") {
            cb = interval;
            interval = 50;
        }
        
        if (!symbols || !symbols.length) {
            if (cb) cb();
            else this.emit("load");
        }
        else {
            let result = [ ];
            let loop = setInterval(() => {
                this.security(symbols.pop(), (err, sym) => {
                    if (err) {
                        clearTimeout(loop);
                        if (cb) cb(err);
                        else this.emit("error", err);
                    }
                    else {
                        result.append(sym);
                        if (symbols.length == 0) {
                            clearTimeout(loop);
                            if (cb) cb(null, result);
                            else this.emit("load", result);
                        }
                    }
                });
                
                if (symbols.length == 0) {
                    clearTimeout(loop);
                }
            }, Math.max(interval || 50, 50));
        }
    }

    account(options, cb) {
        if (cb == null && typeof options == "function") {
            cb = options;
            options = null;
        }
        
        this.workspace.account = this.session.account(options).on("load", err => cb(err, this.workspace.account));
    }
    
    accountSummary(options, cb) {
        if (cb == null && typeof options == "function") {
            cb = options;
            options = null;
        }
        
        this.workspace.accountSummary = this.session.accountSummary(options).on("load", err => cb(err, this.workspace.accountSummary));
    }
    
    positions(options, cb) {
        if (cb == null && typeof options == "function") {
            cb = options;
            options = null;
        }
        
        this.workspace.positions = this.session.positions(options).on("load", err => cb(err, this.workspace.positions));
    }
    
    orders(options, cb) {
        if (cb == null && typeof options == "function") {
            cb = options;
            options = null;
        }
        
        this.workspace.orders = this.session.orders(options).on("load", err => cb(err, this.workspace.orders));
    }
    
    trades(options, cb) {
        if (cb == null && typeof options == "function") {
            cb = options;
            options = null;
        }
        
        this.workspace.trades = this.session.trades(options).on("load", err => cb(err, this.workspace.trades));
    }
    
    terminal(repl) {
        for (let key in this.workspace) {
            repl.context[key] = this.workspace[key];
        }
        
        repl.context.session = this.session;
        
        repl.context.$ = text => {
            this.session.securities(text, (err, list) => {
                if (err) this.emit("error", err);
                else list.forEach(l => this.assign(l.contract.symbol, l));
            });
        };
        
        this.workspace = repl.context;
        repl.on("exit", () => this.session.close());
        return repl;
    }
    
}

module.exports = Environment;