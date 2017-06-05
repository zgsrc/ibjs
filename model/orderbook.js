"use strict";

require("sugar");

const MarketData = require("./marketdata");

class OrderBook extends MarketData {
    
    constructor(security) {
        super(security);
        this.requests = [ ];
        this.exchanges = [ ];
        this.bids = { };
        this.offers = { };
    }
    
    stream(exchanges, rows) {
        if (!Array.isArray(exchanges)) {
            exchanges = [ exchanges ];
        }
        
        let exchangeList = Object.clone(exchanges);
        
        exchanges.each(exchange => {
            if (this.exchanges.indexOf(exchange) < 0) {
                let copy = Object.clone(this.security.summary);
                copy.exchange = exchange;

                this.exchanges.push(exchange);
                this.bids[exchange] = { };
                this.offers[exchange] = { };

                let req = this.security.service.mktDepth(copy, rows || 5)

                req.on("data", datum => {
                    if (datum.side == 1) {
                        this.bids[exchange][datum.position] = datum;
                    }
                    else {
                        this.offers[exchange][datum.position] = datum;
                    }
                    
                    exchangeList.remove(exchange);
                    this.emit("update", datum);
                }).on("error", (err, cancel) => {
                    exchangeList.remove(exchange);
                    this.emit("warning", this.security.summary.localSymbol + " on " + exchange + " failed.");
                    this.requests.remove(req);
                    this.exchanges.remove(exchange);
                    delete this.bids[exchange];
                    delete this.offers[exchange];
                    cancel();
                }).send();

                this.requests.push(req);
            }
        });
        
        let watcher = setInterval(() => {            
            if (exchangeList.length == 0) {
                clearInterval(watcher);
                this.loaded = true;
                this.emit("load");
            }
        }, 100);
        
        setTimeout(() => {
            if (!this.loaded) {
                this.loaded = true;
                
                let err = new Error("Level 2 data timeout loading data.");
                err.timeout = true;
                
                clearInterval(watcher);
                
                this.emit("error", err);
                this.emit("load", err);
            }
        }, 15000);
    }
    
    streamAllValidExchanges(rows) {
        this.stream(this.security.validExchanges.split(','), rows);
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