

const Subscription = require("./subscription"),
      Currency = require("./currency");

class Account extends Subscription {
    
    constructor(service, options) {
        super(service);
        
        if (typeof options == "string") options = { id: options };
        if (typeof options.id != "string") throw new Error("Account id is required.");
        
        this.balances = { };
        this.positions = { };
        
        this.subscriptions.push(this.service.accountUpdates(options.id).on("data", data => {
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
                this.emit("update", { account: options.id, type: "balances", field: key, value: value });
            }
            else if (data.timestamp) {
                let date = Date.create(data.timestamp);
                this.timestamp = date;
                this.emit("update", { account: options.id, type: "timestamp", field: "timestamp", value: date });
            }
            else if (data.contract) {
                this.positions[data.contract.conId] = data;
                this.emit("update", { account: options.id, type: "position", field: data.contract.conId, value: data });
            }
            else {
                this.emit("error", new Error("Unrecognized account update " + JSON.stringify(data)));
            }
        }).on("end", () => {
            this.loaded = true;
            this.emit("load");
        }).on("error", err => {
            this.emit("error", err);
        }).send());
    }
    
}

module.exports = Account;