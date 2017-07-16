"use strict";

const Events = require("events"),
      Sugar = require("sugar");

class RealTime extends Events {
    
    constructor(session) {
        super();
        this._exclude = [ ];
        Object.defineProperty(this, 'session', { value: session });
        Object.defineProperty(this, 'service', { value: session.service });
    }
    
    get fields() {
        return Sugar.Object.keys(this).exclude(/\_.*/).subtract(this._exclude).exclude("cancel").exclude("domain");
    }
    
    each(fn) {
        this.fields.forEach((e, i) => fn(this[e], e, i));
    }
    
    cancel() {
        return false;
    }
    
}

module.exports = RealTime;