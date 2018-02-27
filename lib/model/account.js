const Subscription = require("./subscription"),
      Currency = require("./currency");

class Account extends Subscription {
    
    constructor(service, options) {
        super(service);
        
        if (typeof options == "string") options = { id: options };
        if (typeof options.id != "string") throw new Error("Account id is required.");
        
        this.id = options.id;
        this.balances = { };
        this.positions = { };
    }
    
    async stream() {
        return new Promise((yes, no) => {
            this.subscriptions.push(this.service.accountUpdates(this.id).on("data", data => {
                if (data.key) {
                    let value = data.value;
                    if (/^\-?[0-9]+(\.[0-9]+)?$/.test(value)) value = parseFloat(value);
                    else if (value == "true") value = true;
                    else if (value == "false") value = false;

                    if (data.currency && data.currency != "") {
                        if (data.currency != value) {
                            value = new Currency(data.currency, value);
                        }
                    }

                    let key = data.key.camelize(false);
                    this.balances[key] = value;
                }
                else if (data.timestamp) {
                    this.timestamp = Date.create(data.timestamp);
                }
                else if (data.contract) {
                    this.positions[data.contract.conId] = data;
                }
            }).once("end", () => {
                this.loaded = true;
                yes(this);
            }).on("error", err => {
                this.error = err;
                no(err);
            }).send());
        })
    }
    
}

module.exports = Account;