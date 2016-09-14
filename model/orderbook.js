"use strict";

require("sugar");

const Events = require("events");

class OrderBook extends Events {
    
    constructor(security) {
        super();
        
        this.security = security;
        this.requests = [ ];
        this.exchanges = [ ];
        this.bids = { };
        this.offers = { };
    }
    
    open(exchange, rows) {
        if (this.exchanges.indexOf(exchange) < 0) {
            let copy = Object.clone(this.security.summary);
            copy.exchange = exchange;

            this.exchanges.push(exchange);
            this.bids[exchange] = { };
            this.offers[exchange] = { };

            let req = this.security.service.mktDepth(copy, rows || 5)

            req.on("data", datum => {
                this.emit("beforeUpdate", datum);

                if (datum.side == 1) {
                    this.bids[exchange][datum.position] = datum;
                }
                else {
                    this.offers[exchange][datum.position] = datum;
                }

                this.emit("update", datum);
            })
            .on("error", (err, cancel) => {
                this.emit("warning", this.security.summary.localSymbol + " on " + exchange + " failed.");
                this.requests.remove(req);
                this.exchanges.remove(exchange);
                delete this.bids[exchange];
                delete this.offers[exchange];
                cancel();
            }).send();

            this.requests.push(req);
            
            return true;
        }
        else return false;
    }
    
    openAll(exchanges, rows) {
        exchanges.each(ex => this.open(ex, rows));
    }
    
    openAllValidExchanges(rows) {
        let valid = this.security.validExchanges.split(',');
        valid.each(exchange => this.open(exchange, rows));
    }
    
    close(exchange) {
        let idx = this.exchanges.indexOf(exchange),
            req = this.requests[i];
        
        req.cancel();
        
        this.requests.remove(req);
        this.exchanges.remove(exchange);
        delete this.bids[exchange];
        delete this.offers[exchange];
    }
    
    cancel() {
        this.requests.map("cancel");
    }
    
}

module.exports = OrderBook;