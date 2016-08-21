"use strict";

require("sugar");

const Events = require("events");

class Quote extends Events {
    
    constructor() {
        super();
    }
    
    add(datum) {
        var key = datum.name,
            value = datum.value;

        if (key == "LAST_TIMESTAMP") {
            value = Date.create(parseInt(value) * 1000);
        }
        
        if (!key || key == "") {
            console.log("Tick key not found.");
            console.log(datum);
            return;
        }
        
        if (value === null || value === "") {
            console.log("No tick data value found.");
            console.log(datum);
            return;
        }
        
        var oldValue = me[key];
        this.emit("beforeUpdate", { key: key, newValue: value, oldValue: oldValue });
        this[key] = value;
        this.emit("afterUpdate", { key: key, newValue: value, oldValue: oldValue });
    }
    
    error(err) {
        this.emit("error", err);
    }
    
    setCancel(fn) {
        this.cancelFunction = fn;
    }
    
    cancel() {
        if (this.cancelFunction && Object.isFunction(this.cancelFunction)) {
            this.cancelFunction();
            this.emit("cancelled");
        }
    }
    
}

exports.Quote = Quote;

class Offers extends Events {
    
    constructor() {
        super();
        this.bids = { };
        this.offers = { };
    }
    
    add(datum) {
        this.emit("beforeUpdate", datum);
        
        if (datum.side == 1) me.bids[datum.position] = datum;
        else me.offers[datum.position] = datum;
        
        this.emit("afterUpdate", datum);
    }
    
    error(err) {
        this.emit("error", err);
    }
    
    setCancel(fn) {
        this.cancelFunction = fn;
    }
    
    cancel() {
        if (this.cancelFunction && Object.isFunction(this.cancelFunction)) {
            this.cancelFunction();
            this.emit("cancelled");
        }
    }
    
}

exports.Offers = Offers;