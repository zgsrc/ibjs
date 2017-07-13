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
            if (err && cb) cb(err);
            else {
                securities.forEach(s => {
                    this.assign(s.contract.symbol, s);
                });
                
                if (cb) cb(null, s);
            }
        });
    }
    
    setup(cb) {
        this.workspace.session = this.session;
        
        this.workspace.account = this.session.account().on("load", err => {
            if (cb) cb(err);
        });
        
        this.workspace.$ = text => {
            this.session.securities(text, (err, list) => {
                if (err) this.emit("error", err);
                else list.forEach(l => assign(l.contract.symbol, l));
            });
        };
        
        this.workspace.symbols = [ ];
        
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