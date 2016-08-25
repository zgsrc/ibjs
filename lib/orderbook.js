"use strict";

require("sugar");

const Events = require("events");

class OrderBook extends Events {
    
    constructor(cxn, contract, exchange) {
        super();
        
        this.connection = cxn;
        this.contract = contract;
        
        this.bids = { };
        this.offers = { };
        
        var copy = Object.clone(this.contract);
        if (exchange) copy.exchange = exchange;
        
        var me = this;
        this.connection.marketDepth(copy, function(err, data, cancel) {
            if (cancel) me.cancelFunction = fn;
            if (err) me.emit("error", err);
            if (data) {
                me.emit("beforeUpdate", datum);
                if (datum.side == 1) me.bids[datum.position] = datum;
                else me.offers[datum.position] = datum;
                me.emit("update", datum);
            }
        });
    }
    
    cancel() {
        if (this.cancelFunction && Object.isFunction(this.cancelFunction)) {
            this.cancelFunction();
            this.emit("cancelled");
        }
        
        return me;
    }
    
}

module.exports = OrderBook;