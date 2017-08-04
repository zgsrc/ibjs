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
        return Object.keys(this).exclude(/\_.*/).subtract(this._exclude).exclude("cancel").exclude("domain");
    }
    
    get snapshot() {
        let obj = Object.select(this, this.fields);
        for (let prop in obj) {
            let snapshot = null;
            if (snapshot = obj[prop].snapshot) {
                obj[prop] = snapshot;
            }
        }
        
        return obj;
    }
    
    each(fn) {
        this.fields.forEach((e, i) => fn(this[e], e, i));
    }
    
    cancel() {
        return false;
    }
    
    either(event1, event2, cb) {
        let done = false;
        this.once(event1, arg => { 
            if (!done) {
                done = true;
                cb(arg, null);
            }
        }).once(event2, arg => { 
            if (!done) {
                done = true;
                cb(null, arg);
            }
        });
        
        return this;
    }
    
}

module.exports = RealTime;