const Events = require("events");
const dop = require("dop");
const { observe } = require('hyperactiv');
const util = require("util");

class Subscription extends Events {
    
    constructor(base) {
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
        
        Object.defineProperty(this, "aggregateState", { value: { }, enumerable: false });
        Object.defineProperty(this, "distributableState", { value: dop.register(this.aggregateState), enumerable: false });
        Object.defineProperty(this, "data", { value: observe(this.distributableState, { deep: true, batch: true }), enumerable: false });
        
        return new Proxy(this, {
            set: (obj, prop, value) => {
                if (obj[prop] !== undefined) obj[prop] = value;
                else {
                    obj.data[prop] = value;
                    Object.defineProperty(obj, prop, { 
                        get: () => obj.data[prop], 
                        set: val => obj.data[prop] = val, 
                        enumerable: true 
                    });
                }
                
                return true;
            }
        });
    }
    
    atomic(fn) {
        let collector = dop.collect();
        if (fn) {
            fn(this.data);
            return collector.emit();
        }
        else return () => collector.emit();
    }
    
    compute(key, fn) {
        this.data[key] = dop.computed(fn);
        Object.defineProperty(obj, key, { 
            get: () => obj.data[key], 
            set: val => obj.data[key] = val, 
            enumerable: true 
        });
    }
    
    host() {
        dop.onSubscribe(() => this.distributableState);
    }
    
    each(fn) {
        Object.keys(this.aggregateState).forEach((e, i) => fn(this.data[e], e, i));
    }
    
    map(fn) {
        Object.keys(this.aggregateState).map(e => fn(this.data[e], e));
    }
    
    cancel() {
        this.data.streaming = false;
        
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
    
    toJSON() {
        return this.aggregateState;
    }
    
    toString() {
        return `${this.constructor.name}`;
    }
    
}

module.exports = Subscription;