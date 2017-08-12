"use strict";

const MarketData = require("./marketdata");

class Curve extends MarketData {
    
    constructor(session, securities, symbol) {
        super(session, securities.sortBy(s => s.contract.expiry).map("contract"));
        Object.defineProperty(this, "securities", { value: securities.sortBy(s => s.contract.expiry) });
        Object.defineProperty(this, "symbol", { value: symbol || this.contract.first().summary.symbol + "_curve" });
    }
    
    get points() {
        let p = this.securities.map(s => {
            return {
                expiry: s.contract.expiry, 
                timestamp: s.quote.lastTimestamp,
                last: s.quote.last
            };
        });
        
        p[0].spread = 0;
        for (let i = 1; i < p.length; i++) {
            p[i].spread = p[i].last - p[i - 1].last;
        }
        
        return p;
    }
    
    stream() {
        this.securities.map(s => {
            s.quote.stream()
                .on("error", err => this.emit("error", err))
                .on("update", data => this.emit("update", data));
        });
    }
    
    cancel() {
        this.securities.map(s => s.quote.cancel());
    }
    
}

module.exports = Curve;