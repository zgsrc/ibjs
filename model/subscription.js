"use strict";

const Events = require("events");
const { observable } = require('@nx-js/observer-util');

class Subscription extends Events {
    
    constructor(base) {
        super();
        
        Object.defineProperty(this, "domain", { value: this.domain, enumerable: false });
        Object.defineProperty(this, "_events", { value: this._events, enumerable: false });
        Object.defineProperty(this, "_eventsCount", { value: this._eventsCount, enumerable: false });
        Object.defineProperty(this, "_maxListeners", { value: this._maxListeners, enumerable: false });
        
        if (base) {
            if (base.service) {
                Object.defineProperty(this, "contract", { value: base, enumerable: false });
                Object.defineProperty(this, "service", { value: base.service, enumerable: false });
            }
            else if (base.socket) {
                Object.defineProperty(this, "service", { value: base, enumerable: false });
            }
        }
        
        Object.defineProperty(this, "subscriptions", { value: [ ], enumerable: false });
        return observable(this);
    }
    
    each(fn) {
        Object.keys(this).forEach((e, i) => fn(this[e], e, i));
    }
    
    map(fn) {
        Object.keys(this).map(e => fn(this[e], e));
    }
    
    cancel() {
        this.subscriptions.forEach(subscription => {
            subscription.cancel();
        });
        
        Object.values(this).forEach(value => {
            if (value.cancel && typeof value == "function") {
                value.cancel();
            }
        });
        
        Object.defineProperty(this, "subscriptions", { value: [ ], enumerable: false });
    }
    
    log(fn) {
        this.on("update", fn || console.log).on("error", fn || console.log);
    }
    
}

Subscription.observable = observable;

module.exports = Subscription;