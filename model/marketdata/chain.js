"use strict";

const MarketData = require("./marketdata");

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
        Object.defineProperty(this, "symbol", { value: symbol || this.contract.first().summary.symbol + "_options" });
    }
    
    get expirations() {
        return Object.keys(this.dates);
    }
    
}

module.exports = Chain;