"use strict";

const MarketData = require("./marketdata");

class Depth extends MarketData {
    
    constructor(session, contract) {
        super(session, contract);
        
        this._exclude.push("_subscriptions");
        this._subscriptions = [ ];
        
        this.exchanges = [ ];
        this.bids = { };
        this.offers = { };
    }
    
    get validExchanges() {
        return this.contract.validExchanges;
    }
    
    streamExchange(exchange, rows) {
        if (this.exchanges.indexOf(exchange) < 0) {
            this.exchanges.push(exchange);
            
            let copy = Object.clone(this.contract.summary);
            copy.exchange = exchange;
            
            this.bids[exchange] = { };
            this.offers[exchange] = { };

            let req = this.session.service.mktDepth(copy, rows || 5).on("data", datum => {
                if (datum.side == 1) this.bids[exchange][datum.position] = datum;
                else this.offers[exchange][datum.position] = datum;
                this.lastUpdate = Date.create();
                this.emit("update", datum);
            }).on("error", (err, cancel) => {
                this.emit("error", this.contract.summary.localSymbol + " level 2 quotes on " + exchange + " failed.");
                this._subscriptions.remove(req);
                this.exchanges.remove(exchange);
                delete this.bids[exchange];
                delete this.offers[exchange];
                cancel();
            }).send();
            
            this._subscriptions.push(req);
            this.streaming = true;
        }
        
        return this;
    }
    
    cancelExchange(exchange) {
        let idx = this.exchanges.indexOf(exchange),
            req = this._subscriptions[i];
        
        req.cancel();
        
        this._subscriptions.remove(req);
        this.exchanges.remove(exchange);
        delete this.bids[exchange];
        delete this.offers[exchange];
        
        if (this.exchanges.length == 0) {
            this.streaming = false;
        }
        
        return this;
    }
    
    stream(exchanges, rows) {
        if (typeof exchanges == "number") {
            rows = exchanges;
            exchanges = null;
        }
        
        if (exchanges == null) {
            if (this.exchanges.length) {
                exchanges = this.exchanges;
                this.exchanges = [ ];
            }
            else exchanges = this.validExchanges;
        }
        
        exchanges.forEach(exchange => {
            this.streamExchange(exchange, rows);
        });
        
        return this;
    }
    
    cancel() {
        this._subscriptions.map("cancel");
        this._subscriptions = [ ];
        this.streaming = false;
    }
    
}

module.exports = Depth;