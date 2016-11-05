"use strict";

require("sugar");

const async = require("async"),
      Events = require("events"),
      config = require("./config");

class Symbol extends Events {
    
    constructor(security, options) {
        super();
        
        options = Object.merge(config().symbol, options || { });
        
        this.security = security;
        
        this.name = options.name || security.summary.localSymbol;
        
        let errors = [ ],
            errorHandler = err => {
                if (this.loaded) this.emit("error", err);
                else errors.push(err);
            };
        
        (this.fundamentals = security.fundamentals())
            .on("error", errorHandler)
            .on("warning", msg => this.emit("warning", msg));
        
        (this.quote = security.quote())
            .on("error", errorHandler)
            .on("warning", msg => this.emit("warning", msg));
        
        (this.level2 = security.level2())
            .on("error", errorHandler)
            .on("warning", msg => this.emit("warning", msg));
        
        (this.charts = security.charts())
            .on("error", errorHandler)
            .on("warning", msg => this.emit("warning", msg));

        async.series([
            cb => {
                if (options.fundamentals) {
                    if (options.fundamentals == "all") this.fundamentals.loadAll(cb);
                    else if (Array.isArray(options.fundamentals)) this.fundamentals.loadSome(options.fundamentals, cb);
                    else if (Object.isString(options.fundamentals)) this.fundamentals.load(options.fundamentals, cb);
                    else cb();
                }
                else cb();
            },
            cb => {
                if (options.quote) {
                    if (Array.isArray(options.quote)) this.quote.fields = options.quote;
                    this.quote.refresh(cb);
                    if (options.quote != "snapshot") this.quote.stream();
                }
                else cb();
            },
            cb => {
                if (options.level2) {
                    if (options.level2.markets == "all") this.level2.streamAllValidExchanges(options.level2.rows || 10);
                    else this.level2.stream(options.level2.markets, options.level2.rows || 10);
                    this.level2.once("load", cb);
                }
                else cb();
            },
            cb => {
                if (options.charts) {
                    let sizes = Object.keys(options.charts).filter(k => options.charts[k]);
                    async.forEachSeries(sizes, (size, cb) => {
                        let periods = options.charts[k];
                        this.charts[size].history(err => {
                            if (!err && periods > 1) {
                                async.forEach(
                                    (1).upto(periods).exclude(1), 
                                    (i, cb) => this.charts[size].history(cb), 
                                    cb
                                );
                            }
                            else cb(err);
                        });
                        
                        this.charts[size].stream();
                    }, cb);
                }
                else cb();
            }
        ], err => {
            this.loaded = true;
            if (err) {
                err = new Error("Errors encountered during " + this.name + " symbol load.");
                err.errors = errors;
            }
            
            this.emit("load", err);
        });
    }
    
    order(defaults) {
        return security.order(defaults);
    }
    
    cancel() {
        this.fundamentals.cancel();
        this.quote.cancel();
        this.depth.cancel();
        this.charts.cancel();
        this.emit("close");
    }
    
}

module.exports = Symbol;