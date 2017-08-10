"use strict";

const MarketData = require("./marketdata");

class Chain extends MarketData {
    
    constructor(session, securities) {
        super(session, securities.sortBy(s => s.contract.expiry).map("contract"));
        
        let expirations = securities.groupBy(s => s.contract.summary.expiry);
        
        Object.keys(expirations).forEach(date => {
            expirations[date] = {
                calls: expirations[date].filter(s => s.contract.summary.right == "C").sortBy("strike"),
                puts: expirations[date].filter(s => s.contract.summary.right == "P").sortBy("strike")
            };
        })
        
        Object.defineProperty(this, "expirations", { value: expirations });
    }
    
}

module.exports = Chain;