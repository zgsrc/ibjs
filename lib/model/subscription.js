const Events = require("events");
const { observe } = require('hyperactiv');
const dop = require("dop");

class Subscription extends Events {
    
    constructor(base, plain) {
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
        
        Object.defineProperty(this, "data", { value: dop.register({ }), enumerable: false });
        
        let proxy = new Proxy(this, { 
            has: (obj, name) => name in obj.data,
            get: (obj, name) => obj[name] || obj.data[name],
            set: (obj, name, value) => {
                if (value instanceof Subscription) {
                    obj[name] = value;
                    obj.data[name] = value.data;
                }
                else {
                    obj.data[name] = value;
                }

                return true;
            },
            deleteProperty: (obj, name) => {
                delete obj[name];
                delete obj.data[name];
                return true;
            },
            ownKeys: obj => Object.keys(this.data),
            enumerate: obj => Object.keys(this.data)[Symbol.iterator]()
        });
        
        if (plain) return proxy;
        else return observe(proxy, { deep: true, batch: true });
    }
    
    set(key, value) {
        return this[key] = value;
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
    }
    
    each(fn) {
        Object.keys(this.data).forEach((e, i) => fn(this.data[e], e, i));
    }
    
    map(fn) {
        Object.keys(this.data).map(e => fn(this.data[e], e));
    }
    
    cancel() {
        this.data.streaming = false;
        
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

Subscription.observable = obj => dop.register(obj || { });

Subscription.observe = observe;

module.exports = Subscription;