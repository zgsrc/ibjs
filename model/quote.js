"use strict";

require("sugar");

const Events = require("events");

function parseQuotePart(datum) {
    let key = datum.name, value = datum.value;
    
    if (!key || key == "") throw new Error("Tick key not found.");
    if (value === null || value === "") throw new Error("No tick data value found.");
    if (key == "LAST_TIMESTAMP") value = new Date(parseInt(value) * 1000);
    
    return { key: key.camelize(false), value: value };
}

const TICKS = {
    fundamentalValues: 47,
    optionVolume: 100,
    optionOpenInterest: 101,
    historicalVolatility: 104,
    optionImpliedVolatility: 106,
    indexFuturePremium: 162,
    miscellaneousStats: 165,
    markPrice: 221,
    auctionValues: 225,
    realTimeVolume: 233,
    shortable: 236,
    inventory: 256,
    fundamentalRatios: 258,
    news: 292,
    realtimeHistoricalVolatility: 411,
    dividends: 456
};

class Quote extends Events {
    
    constructor(security) {
        super();
        this.security = security;
        this.fields = [ ];        
        this.TICK_TYPES = TICKS;
    }
    
    pricing() {
        this.fields.add([ TICKS.markPrice, TICKS.auctionValues, TICKS.realTimeVolume ]);
        return this;
    }
    
    fundamentals() {
        this.fields.add([ TICKS.dividends, TICKS.fundamentalValues, TICKS.fundamentalRatios, TICKS.miscellaneousStats ]);
        return this;
    }
    
    volatility() {
        this.fields.add([ TICKS.historicalVolatility, TICKS.optionImpliedVolatility, TICKS.realtimeHistoricalVolatility ]);
        return this;
    }
    
    options() {
        this.fields.add([ TICKS.optionVolume, TICKS.optionOpenInterest ]);
        return this;
    }
    
    short() {
        this.fields.add([ TICKS.shortable, TICKS.inventory ]);
        return this;
    }
    
    news() {
        this.fields.add([ TICKS.news ]);
        return this;
    }
    
    refresh(cb) {
        this.security.service.mktData(this.security.summary, this.fields.join(","), true)
            .on("data", datum => {
                datum = parseQuotePart(datum);
                this[datum.key] = datum.value;
                this.emit("update");
            }).on("error", (err, cancel) => {
                this.emit("error", err);
                if (cb) cb(err);
                cancel();
            }).on("end", cancel => {
                this.emit("load");
                if (cb) cb(null, this);
                cancel();
            }).send();
    }
    
    stream() {
        let req = this.security.service.mktData(this.security.summary, this.fields.join(","), false)
            .on("data", datum  => {
                datum = parseQuotePart(datum);
                
                let oldValue = this[datum.key];
                this[datum.key] = datum.value;
                this.emit("update", { key: datum.key, newValue: datum.value, oldValue: oldValue });
            })
            .on("error", err => {
                this.emit("error", err);
            }).send();
        
        this.cancel = () => {
            req.cancel();
            return true;
        };
    }
    
    cancel() {
        return false;
    }
    
}

module.exports = Quote;