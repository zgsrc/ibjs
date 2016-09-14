"use strict";

require("sugar");

const async = require("async"),
      Events = require("events");

class Symbol extends Events {
    
    constructor(security, options) {
        super();

        options = options || {
            fundamentals: "all",
            quote: "streaming",
            depth: "all",
            rows: 10,
            bars: {
                ONE_SECOND: false,
                FIVE_SECONDS: false,
                FIFTEEN_SECONDS: false,
                THIRTY_SECONDS: false,
                ONE_MINUTE: false,
                TWO_MINUTES: false,
                THREE_MINUTES: false,
                FIVE_MINUTES: true,
                FIFTEEN_MINUTES: false,
                THIRTY_MINUTES: false,
                ONE_HOUR: false,
                TWO_HOURS: false,
                FOUR_HOURS: false,
                EIGHT_HOURS: false,
                ONE_DAY: false,
            }
        };
        
        this.security = security;
        
        this.name = options.name || security.summary.localSymbol;

        this.order = defaults => security.order(defaults);
        
        this.cancel = () => {
            if (this.quote) this.quote.cancel();
            if (this.depth) this.depth.cancel();
            if (this.bars) this.bars.cancel();
            this.emit("close");
        };

        async.parallel([
            cb => {
                if (options.fundamentals) {
                    this.fundamentals = security.fundamentals();
                    if (options.fundamentals == "all") {
                        this.fundamentals.loadAll(cb);
                    }
                    else if (Array.isArray(options.fundamentals)) {
                        this.fundamentals.loadSome(options.fundamentals, cb);
                    }
                    else if (Object.isString(options.fundamentals)) {
                        this.fundamentals.load(options.fundamentals, cb);
                    }
                    else {
                        cb();
                    }
                }
                else {
                    cb();
                }
            },
            cb => {
                if (options.quote) {
                    this.quote = security.quote();
                    
                    this.quote
                        .on("error", err => this.emit("error", err))
                        .on("warning", msg => this.emit("warning", msg))
                        .on("message", msg => this.emit("message", msg));
                    
                    if (options.quote == "streaming") {
                        this.quote.stream();
                    }
                    
                    this.quote.refresh(cb);
                }
                else cb();
            },
            cb => {
                if (options.depth) {
                    this.depth = security.depth();
                    
                    this.depth
                        .on("error", err => this.emit("error", err))
                        .on("warning", msg => this.emit("warning", msg))
                        .on("message", msg => this.emit("message", msg));
                    
                    if (options.depth == "all") {
                        this.depth.openAllValidExchanges(options.rows || 10);
                    }
                    else if (Array.isArray(options.depth)) {
                        this.depth.openAll(options.depth, options.rows || 10);
                    }
                    else if (Object.isString(options.depth)) {
                        this.depth.open(options.depth, options.rows || 10);
                    }
                    
                    cb();
                }
                else cb();
            },
            cb => {
                if (options.bars) {
                    this.bars = { };
                    
                    if (Array.isArray(options.bars)) {
                        options.bars.each(
                            size => {
                                this.bars[size] = security.bars[size]();
                                this.bars[size]
                                    .on("error", err => this.emit("error", err))
                                    .on("warning", msg => this.emit("warning", msg))
                                    .on("message", msg => this.emit("message", msg));
                                
                                this.bars[size].load();
                            }
                        );
                    }
                    else if (Object.isObject(options.bars)) {
                        Object.keys(options.bars).filter(k => options.bars[k]).each(
                            size => {
                                this.bars[size] = security.bars[size]();
                                this.bars[size]
                                    .on("error", err => this.emit("error", err))
                                    .on("warning", msg => this.emit("warning", msg))
                                    .on("message", msg => this.emit("message", msg));
                                
                                this.bars[size].load();
                            }
                        );
                    }
                    else if (Object.isString(options.bars)) {
                        this.bars[options.bars] = security.bars[options.bars]();
                        this.bars[options.bars]
                            .on("error", err => this.emit("error", err))
                            .on("warning", msg => this.emit("warning", msg))
                            .on("message", msg => this.emit("message", msg));
                        
                        this.bars[options.bars].load();
                    }
                    
                    this.bars.cancel = () => {
                        Object.values(this.bars).cancel();
                        this.bars = { };
                    }
                    
                    cb();
                }
                else cb();
            }
        ], err => {
            if (err) this.emit("error", err);
            this.emit("ready");
        });
    }
    
}

module.exports = Symbol;