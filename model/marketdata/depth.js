"use strict";

require("sugar");

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
        return this.contract.validExchanges.split(',');
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
        
        return this;
    }
    
    stream(exchanges, rows) {
        if (Object.isNumber(exchanges)) {
            rows = exchanges;
            exchanges = null;
        }
        
        if (exchanges == null) {
            exchanges = this.validExchanges;
        }
        
        exchanges.each(exchange => {
            this.streamExchange(exchange, rows);
        });
        
        return this;
    }
    
    cancel() {
        this._subscriptions.map("cancel");
    }
    
}

module.exports = Depth;