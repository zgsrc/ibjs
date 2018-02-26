const Events = require("events");
const util = require("util");

class Subscription extends Events {
    
    constructor(base, state) {
        super();
        
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
    }
    
    cancel() {
        this.streaming = false;
        
        while (this.subscriptions.length) {
            this.subscriptions.pop().cancel();
        }
        
        Object.values(this).forEach(value => {
            if (value.cancel && typeof value == "function") {
                value.cancel();
            }
        });
    }
    
    log(fn) {
        this.on("update", fn || console.log).on("error", fn || console.log);
    }
    
    each(fn) {
        Object.keys(this).forEach((e, i) => fn(this[e], e, i));
    }
    
    map(fn) {
        Object.keys(this).map(e => fn(this[e], e));
    }
    
    toJSON() {
        let obj = { };
        Object.keys(this).exclude(prop => [ "domain", "_events", "_eventsCount" ].indexOf(prop) >= 0).forEach(prop => {
            if (this[prop] !== undefined) {
                if (typeof this[prop].toJSON === 'function') obj[prop] = this[prop].toJSON();
                else obj[prop] = this[prop];
            }
        });
        
        return obj;
    }
    
    toString() {
        return this.constructor.name + (this.id ? " " + this.id : "");
    }
    
}

module.exports = Subscription;