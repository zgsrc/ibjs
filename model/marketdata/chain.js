"use strict";

const MarketData = require("./marketdata"),
      Curve = require("./curve");

class Chain extends MarketData {
    
    constructor(session, securities, symbol) {
        super(session, securities[0].contract);
        
        Object.defineProperty(this, "count", { value: securities.length });
        
        let dates = securities.groupBy(s => s.contract.summary.expiry);
        Object.keys(dates).forEach(date => {
            dates[date] = {
                calls: dates[date].filter(s => s.contract.summary.right == "C").sortBy("contract.summary.strike"),
                puts: dates[date].filter(s => s.contract.summary.right == "P").sortBy("contract.summary.strike")
            };
        });
        
        Object.defineProperty(this, "dates", { value: dates });
        Object.defineProperty(this, "symbol", { value: symbol || this.contract.summary.symbol + "_options" });
        Object.defineProperty(this, "expirations", { value: Object.keys(dates) });
        Object.defineProperty(this, "strikes", { 
            value: this.expirations.map(e => {
                return [ 
                    this.dates[e].calls.map("contract.summary.strike"),
                    this.dates[e].puts.map("contract.summary.strike")
                ];
            }).flatten().compact(true).unique().sortBy()
        });
    }
    
    calls(strike) {
        return new Curve(session, this.expirations.map(d => this.dates[d].calls.find(s => s.strike == strike)), this.symbol + "_" + strike.toString() + "_calls_curve");
    }
    
    puts(strike) {
        return new Curve(session, this.expirations.map(d => this.dates[d].calls.find(s => s.strike == strike)), this.symbol + "_" + strike.toString() + "_puts_curve");
    }
    
}

module.exports = Chain;