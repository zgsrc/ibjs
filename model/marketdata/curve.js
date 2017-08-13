"use strict";

const MarketData = require("./marketdata");

class Curve extends MarketData {
    
    constructor(session, securities, symbol) {
        super(session, securities[0].contract);
        Object.defineProperty(this, "securities", { value: securities });
        Object.defineProperty(this, "symbol", { value: symbol || this.contract.summary.symbol + "_curve" });
    }
    
    get points() {
        return this.securities.map(s => Object.merge(s.quote.snapshot, { expiry: s.contract.expiry }));
    }
    
    stream() {
        this.securities.map(s => {
            if (!s.quote.streaming) {
                s.quote.stream().on("error", err => this.emit("error", err)).on("update", data => this.emit("update", data));
            }
        });
    }
    
    cancel() {
        this.securities.map(s => s.quote.cancel());
    }
    
}

module.exports = Curve;