const Subscription = require("./subscription");

class Curve extends Subscription {
    
    constructor(contracts) {
        super(contract[0]);
        
        contracts = contracts.sortBy(c => c.expiry);
        
        contracts.forEach(c => {
            this[c.symbol.localName] = c.quote();
        });
    }
    
    async stream() {
        return Promise.all(Object.values(this).stream());
    }
    
}

module.exports = Curve;