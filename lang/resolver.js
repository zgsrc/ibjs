class Resolver {
    
    constructor(session, dictionary) {
        Object.defineProperty(this, "lookup", { value: { }, enumerable: false });
        
    }
    
    async reify(name) {
        let description = dictionary[name] || name;
        
        // parse(description) = summary
        // contract.all(summary) = results
        
        if (this.lookup[name]) return this[this.lookup[name]];
        else {
            
            
            let contract = await this.session.contract();

            contract = new Proxy(contract, {
                get: function(contract, prop) { 
                    if (prop == "quote") return contract._quote ? contract._quote : contract._quote = contract.quote();
                    else if (prop == "depth") return contract._depth ? contract._depth : contract._depth = contract.depth();
                    else if (prop == "charts") return contract._charts ? contract._charts : contract._charts = contract.charts();
                    else return contract[prop];
                }
            });

            this[contract.summary.localSymbol] = contract;
        }
    }
    
}