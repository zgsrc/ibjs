"use strict";

require("sugar");

const RealTime = require("./realtime"),
      Fundamentals = require("./fundamentals"),
      Quote = require("./quote"),
      OrderBook = require("./orderbook"),
      Charts = require("./charts"),
      Order = require("./order"),
      Symbol = require("./symbol");

class Security extends RealTime {
    
    constructor(service, contract) {
        super(service);
        Object.merge(this, contract);
    }
    
    fundamentals() {
        return new Fundamentals(this);
    }
    
    quote() {
        return new Quote(this);
    }
    
    level2() {
        return new OrderBook(this);
    }
    
    charts() {
        return new Charts(this);
    }
    
    order(defaults) {
        return new Order(this.service, this.summary, defaults);
    }
    
    symbol(options) {
        return new Symbol(this, options);
    }
    
}

module.exports = Security;