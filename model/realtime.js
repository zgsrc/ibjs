"use strict";

const Events = require("events");

class RealTime extends Events {
    
    constructor(service) {
        super();
        Object.defineProperty(this, 'service', { value: service });
    }
    
    get fields() {
        return Object.keys(this).exclude(/\_.*/, "cancel");
    }
    
    cancel() {
        return false;
    }
    
}

module.exports = RealTime;