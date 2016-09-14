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

class Quote extends Events {
    
    constructor(security) {
        super();
        this.security = security;
    }
    
    refresh(cb) {
        let request = this.security.service.mktData(this.security.summary, "", true);
        
        request.on("data", datum => {
            datum = parseQuotePart(datum);
            this[datum.key] = datum.value;
            this.emit("update");
        }).on("error", (err, cancel) => {
            this.emit("error", err);
            if (cb) cb(err);
            cancel();
        }).on("end", cancel => {
            this.emit("updated");
            if (cb) cb(null, this);
            cancel();
        }).send();
    }
    
    stream(fields) {
        fields = fields || [];
        if (Array.isArray(fields)) fields = fields.join(",");
        else fields = fields.toString();
        
        let req = this.security.service.mktData(this.security.summary, fields, false)
            .on("data", datum  => {
                datum = parseQuotePart(datum);
                
                let oldValue = this[datum.key];
                this.emit("beforeUpdate", { key: datum.key, newValue: datum.value, oldValue: oldValue });
                this[datum.key] = datum.value;
                this.emit("update", { key: datum.key, newValue: datum.value, oldValue: oldValue });
            })
            .on("error", err => {
                this.emit("error", err);
            }).send();
        
        this.cancel = () => req.cancel();
    }
    
    cancel() {

    }
    
}

Quote.TICKS = {
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

module.exports = Quote;