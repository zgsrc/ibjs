"use strict";

require("sugar");

const Events = require("events"),
      Fundamentals = require("./fundamentals"),
      Quote = require("./quote"),
      OrderBook = require("./orderbook"),
      Bars = require("./bars"),
      Order = require("./order"),
      Symbol = require("./symbol");

class Security extends Events {
    
    constructor(service, contract) {
        super();
        
        this.service = service;
        
        this.bars = new Bars(this);
        
        Object.merge(this, contract);
    }
    
    fundamentals() {
        return new Fundamentals(this);
    }
    
    quote() {
        return new Quote(this);
    }
    
    depth() {
        return new OrderBook(this);
    }
    
    order(defaults) {
        return new Order(this.service, this.summary, defaults);
    }
    
    symbol(options) {
        return new Symbol(this, options);
    }
    
}

module.exports = Security;