"use strict";

let Events = require("events");

class Environment extends Events {
    
    constructor(session) {
        super();
        
        Object.defineProperty(this, "session", { value: session });
        
        this.workspace = { };
    }
    
    assign(name, value) {
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
    
    load(symbol, cb) {
        this.session.securities(symbol, (err, securities) => {
            if (err) {
                if (cb) cb(err);
                else this.emit("error", err);
            }
            else {
                securities.forEach(s => {
                    this.assign(s.contract.symbol, s);
                });
                
                if (cb) cb(null, s);
                else this.emit("load", s);
            }
        });
    }
    
    loadMany(symbols, interval, cb) {
        if (cb == null && Object.isFunction(interval)) {
            cb = interval;
            interval = 50;
        }
        
        if (!symbols || !symbols.length) {
            if (cb) cb();
        }
        else {
            let result = [ ];
            let loop = setTimeout(() => {
                this.load(symbols.pop(), (err, sym) => {
                    if (err) {
                        clearTimeout(loop);
                        if (cb) cb(err);
                        else this.emit("error", err);
                    }
                    else {
                        result.push(sym);
                        if (symbols.length == 0) {
                            clearTimeout(loop);
                            if (cb) cb(null, result);
                            else this.emit("load", result);
                        }
                    }
                });
            }, Math.max(interval || 50, 50));
        }
    }
    
    setup(symbols, cb) {
        if (cb == null && Object.isFunction(symbols)) {
            cb = symbols;
            symbols = null;
        }
        
        this.workspace.session = this.session;
        
        this.workspace.symbols = [ ];
        
        this.workspace.account = this.session.account().on("load", err => {
            if (cb) {
                cb(err);
            }
            else {
                if (symbols) {
                    if (Array.isArray(symbols)) {
                        loadMany(symbols);
                    }
                    else {
                        load(symbols);
                    }
                }
                else {
                    this.emit("load");
                }
            }
        });
        
        this.workspace.$ = text => {
            this.session.securities(text, (err, list) => {
                if (err) this.emit("error", err);
                else list.forEach(l => this.assign(l.contract.symbol, l));
            });
        };
        
        return this;
    }
    
    terminal(repl) {
        for (let key in this.workspace) {
            repl.context[key] = this.workspace[key];
        }
        
        this.workspace = repl.context;
        repl.on("exit", () => this.session.close());
        return repl;
    }
    
}

module.exports = Environment;