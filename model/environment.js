"use strict";

let Events = require("events");

class Environment extends Events {
    
    constructor(session) {
        super();
        
        Object.defineProperty(this, "session", { value: session });
        
        this.workspace = { };
    }
    
    setup(cb) {
        this.workspace.session = this.session;
        
        this.workspace.account = this.session.account().on("load", err => {
            if (cb) cb(err);
        });
        
        this.workspace.$ = text => {
            this.session.securities(text, (err, list) => {
                if (err) {
                    this.emit("error", err);
                }
                else {
                    this.workspace.symbols = this.workspace.symbols.union(list.map(l => l.contract.symbol)).sort();
                    list.forEach(l => {
                        if (this.workspace[l.contract.symbol] == null) {
                            this.workspace[l.contract.symbol] = l;
                        }
                    });
                }
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