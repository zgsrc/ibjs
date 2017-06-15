"use strict";

require("sugar");

const MarketData = require("./marketdata"),
      flags = require("../flags");

function parseQuotePart(datum) {
    let key = datum.name, value = datum.value;
    
    if (!key || key == "") throw new Error("Tick key not found.");
    if (value === null || value === "") throw new Error("No tick data value found.");
    if (key == "LAST_TIMESTAMP") value = new Date(parseInt(value) * 1000);
    
    return { key: key.camelize(false), value: value };
}

const TICKS = flags.QUOTE_TICK_TYPES;

class Quote extends MarketData {
    
    constructor(security) {
        super(security);
        this.fields = [ ];
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
    
}

module.exports = Quote;