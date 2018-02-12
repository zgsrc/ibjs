const symbol = require("./symbol"),
      contract = require("../model/contract");

module.exports = class Resolver {
    
    constructor(service) {
        Object.defineProperty(this, "filters", { value: [ ], enumerable: false });
        Object.defineProperty(this, "resolveContract", { value: name => contract.first(service, symbol.contract(name)), enumerable: false });
    }
    
    async resolve(name) {
        for (let i = 0; i < this.filters.length; i++) {
            let filter = this.filters[i];
            if (Object.isFunction(filter)) {
                let result = await filter(name);
                if (result) return result;
            }
            else throw new Error("Resolver filter " + filter.toString() + " is not a function.");
        }
        
        return this.resolveContract(name);
    }
    
}