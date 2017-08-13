"use strict";

const MarketData = require("./marketdata"),
      Curve = require("./curve");

class Chain extends MarketData {
    
    constructor(session, securities, symbol) {
        super(session, securities[0].contract);
        
        Object.defineProperty(this, "count", { value: securities.length });
        
        let expirations = securities.groupBy(s => s.contract.summary.expiry);
        Object.keys(expirations).forEach(date => {
            expirations[date] = {
                calls: expirations[date].filter(s => s.contract.summary.right == "C").sortBy("strike"),
                puts: expirations[date].filter(s => s.contract.summary.right == "P").sortBy("strike")
            };
        });
        
        Object.defineProperty(this, "dates", { value: expirations });
        Object.defineProperty(this, "symbol", { value: symbol || this.contract.summary.symbol + "_options" });
    }
    
    get expirations() {
        return Object.keys(this.dates);
    }
    
    calls(strike) {
        return this.expirations.map(d => this.dates[d].calls.find(s => s.strike == strike));
    }
    
    puts(strike) {
        return this.expirations.map(d => this.dates[d].puts.find(s => s.strike == strike));
    }
    
}

module.exports = Chain;