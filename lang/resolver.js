const eval = require("./eval"),
      contract = require("../model/contract");

export default class Resolver {
    
    constructor(service, scope) {
        Object.defineProperty(this, "service", { value: service, enumerable: false });
        Object.defineProperty(this, "scope", { value: scope, enumerable: false });
        Object.defineProperty(this, "filters", { value: [ ], enumerable: false });
    }
    
    async resolve(name) {
        this.filters.forEach(filter => {
            if (Object.isFunction(filter)) {
                let result = await filter(name);
                if (result) return result;
            }
            else throw new Error("Resolver filter " + filter.toString() + " is not a function.");
        });
        
        return contract.first(this.service, name);
    }
    
    async eval(src) {
        eval(name => this.resolve(name), this.scope, src);
    }
    
}