const Subscription = require("./subscription");

class Positions extends Subscription {
    
    constructor(service) {
        super(service);
    }
    
    async stream() {
        return new Promise((yes, no) => {
            this.subscriptions.push(this.service.positions().on("data", data => {
                if (!this[data.contract.conId]) this[data.contract.conId] = { };
                this[data.contract.conId][data.accountName] = data;
            }).on("end", cancel => {
                this.loaded = true;
                yes(this);
            }).on("error", err => {
                this.error = err;
                no(err);
            }).send());
        }); 
    }
    
}

module.exports = Positions;