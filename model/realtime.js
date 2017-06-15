"use strict";

const Events = require("events");

class RealTime extends Events {
    
    constructor(session) {
        super();
        this._exclude = [ ];
        Object.defineProperty(this, 'session', { value: session });
        Object.defineProperty(this, 'service', { value: session.service });
    }
    
    get fields() {
        return Object.keys(this).exclude(/\_.*/, this._exclude, "cancel");
    }
    
    close() {
        return false;
    }
    
}

module.exports = RealTime;