"use strict";

const MarketData = require("./marketdata");

class Curve extends MarketData {
    
    constructor(session, securities, symbol) {
        super(session, securities[0].contract);
        Object.defineProperty(this, "securities", { value: securities });
        Object.defineProperty(this, "symbol", { value: symbol || this.contract.summary.symbol + "_" + this.constructor.name.toLowerCase() });
    }
    
    get points() {
        return this.securities.map(s => Object.merge(s.quote.snapshot, { expiry: s.contract.expiry }));
    }
    
    types(values) {
        if (!Array.isArray(values)) values = [ values ];
        values.forEach(val => this.securities.map(s => s.quote[val]()));
    }
    
    stream() {
        let count = this.securities.count("quote.streaming");
        if (count == this.securities.length){
            this.emit("load");
        }
        else {
            this.securities.map(s => {
                if (!s.quote.streaming) {
                    s.quote.stream()
                        .on("error", err => this.emit("error", err))
                        .on("update", data => this.emit("update", data))
                        .on("load", () => {
                            count--;
                            if (count == 0) {
                                this.emit("load");
                            }
                        });
                }
            });
        }
    }
    
    cancel() {
        this.securities.map(s => s.quote.cancel());
    }
    
}

module.exports = Curve;