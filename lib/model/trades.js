const Subscription = require("./subscription");

class Trades extends Subscription {
    
    constructor(service, options) {
        super(service);
        
        options = options || { };
        
        let filter = { };
        if (options.account) filter.acctCode = options.account;
        if (options.client) filter.clientId = options.client;
        if (options.exchange) filter.exchange = options.exchange;
        if (options.secType) filter.secType = options.secType;
        if (options.side) filter.side = options.side;
        if (options.symbol) filter.symbol = options.symbol;
        if (options.time) filter.time = options.time;
        
        this.subscriptions.push(this.service.executions(filter));
    }
    
    async stream() {
        return new Promise((yes, no) => {
            this.subscriptions[0].on("data", data => {
                if (!this[data.exec.permId]) this[data.exec.permId] = { };
                this[data.exec.permId][data.exec.execId] = data;
            }).on("error", err => {
                this.error = err;
                no(err);
            }).on("end", () => {
                this.loaded = true;
                yes(this);
            }).send();
        });
    }
    
}

module.exports = Trades;