"use strict";

const Curve = require("./curve");

class OptionChain extends Curve {
    
    constructor(session, contracts) {
        super(session, contracts[0]);
        
        let dates = contracts.groupBy(c => c.summary.expiry);
        Object.keys(dates).forEach(date => {
            dates[date] = {
                calls: dates[date].filter(s => s.summary.right == "C").sortBy("summary.strike").map(c => c.summary.localSymbol),
                puts: dates[date].filter(s => s.summary.right == "P").sortBy("summary.strike").map(c => c.summary.localSymbol)
            };
        });
        
        Object.defineProperty(this, "dates", { value: dates, enumerable: false });
    }
    
}

module.exports = OptionChain;