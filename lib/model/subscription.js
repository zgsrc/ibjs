const Events = require("events");
const dop = require("dop");
const { observe } = require('hyperactiv');

class Subscription extends Events {
    
    constructor(base) {
        super();
        
        Object.defineProperty(this, "domain", { value: this.domain, enumerable: false });
        Object.defineProperty(this, "_events", { value: this._events, enumerable: false });
        Object.defineProperty(this, "_eventsCount", { value: this._eventsCount, enumerable: false });
        Object.defineProperty(this, "_maxListeners", { value: this._maxListeners, enumerable: false });
        
        Object.defineProperty(this, "updateHandler", { 
            value: (data) => {
                if (!data.hierarchy) data.hierarchy = [ name ];
                else data.hierarchy.shift(name);
                this.emit("update", data);
            },
            enumerable: false
        });
        
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
        
        Object.defineProperty(this, "state", { value: { }, enumerable: false });
        Object.defineProperty(this, "distributableState", { value: dop.register(this.state), enumerable: false });
        Object.defineProperty(this, "reactiveModel", { value: observe(this.distributableState || this.state, { deep: true, batch: true }), enumerable: false });
        Object.defineProperty(this, "data", { value: this.reactiveModel || this.distributableState || this.state, enumerable: false });
        
        let proxy = new Proxy(this, { 
            has: (obj, name) => name in obj.data,
            get: (obj, name) => {
                if (name == "raw") return this;
                else return obj.data[name] || obj[name];
            },
            set: (obj, name, value) => {
                if (value instanceof Subscription) {
                    obj[name] = value;
                    obj.data[name] = value.data;
                    value.on("update", this.updateHandler);
                }
                else {
                    obj.data[name] = value;
                }

                return true;
            },
            deleteProperty: (obj, name) => {
                if (obj[name] && obj[name].removeListener) {
                    obj[name].removeListener("update", this.updateHandler);
                }
                
                delete obj[name];
                delete obj.data[name];
                return true;
            },
            ownKeys: obj => Object.keys(this.data),
            enumerate: obj => Object.keys(this.data)[Symbol.iterator]()
        });
        
        return observe(proxy, { deep: true, batch: true });
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
    
    host(options) {
        dop.listen(options).onSubscribe(() => this._distributableState);
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

module.exports = Subscription;