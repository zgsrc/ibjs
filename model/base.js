"use strict";

const Events = require("events");

class Base extends Events {
    
    constructor(session) {
        super();
        this._exclude = [ "cancel", "domain", "undefined", "null", "true", "false" ];
        Object.defineProperty(this, 'session', { value: session });
        Object.defineProperty(this, 'service', { value: session.service });
    }
    
    cancel() {
        return false;
    }
    
    get fields() {
        return Object.keys(this).exclude(/\_.*/).subtract(this._exclude);
    }
    
    get values() {
        return this.fields.map(field => this[field]);
    }
    
    each(fn) {
        this.fields.forEach((e, i) => fn(this[e], e, i));
    }
    
    map(fn) {
        return this.fields.map(e => fn(this[e], e));
    }
    
    log() {
        this.on("update", console.log).on("error", console.log);
        return this;
    }
    
    get snapshot() {
        let obj = Object.select(this, this.fields);
        for (let prop in obj) {
            let snapshot = null;
            if (obj[prop] && (snapshot = obj[prop].snapshot)) {
                obj[prop] = snapshot;
            }
        }
        
        return obj;
    }
    
}

module.exports = Base;