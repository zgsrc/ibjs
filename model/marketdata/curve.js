"use strict";

const MarketData = require("./marketdata");

class Curve extends MarketData {
    
    constructor(session, securities) {
        super(session, securities.sortBy(s => s.contract.expiry).map("contract"));
        Object.defineProperty(this, "securities", { value: securities.sortBy(s => s.contract.expiry) });
    }
    
    stream() {
        this.securities.map(s => {
            s.quote.stream()
                .on("error", err => this.emit("error", err))
                .on("update", data => this.emit("update", data));
        });
    }
    
    cancel() {
        this.securities.map(s => {
            s.quote.cancel();
        });
    }
    
}

module.exports = Curve;