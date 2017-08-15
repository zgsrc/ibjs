"use strict";

const RealTime = require("../realtime");

class Account extends RealTime {
    
    /* string id, boolean orders, boolean trades */
    constructor(session, options) {
        super(session);
        
        if (typeof options == "string") {
            options = { 
                id: options
            };
        }
        
        if (typeof options.id != "string") {
            throw new Error("Account id is required.");
        }
        
        this._exclude.push("positions", "orders", "trades");
        
        this.positions = new RealTime(session);
        
        let account = this.service.accountUpdates(options.id).on("data", data => {
            if (data.key) {
                var value = data.value;
                if (/^\-?[0-9]+(\.[0-9]+)?$/.test(value)) value = parseFloat(value);
                else if (value == "true") value = true;
                else if (value == "false") value = false;

                if (data.currency && data.currency != "") {
                    value = { currency: data.currency, value: value };
                }

                var key = data.key.camelize(false);
                this[key] = value;
                this.emit("update", { type: "account", field: key, value: value });
            }
            else if (data.timestamp) {
                var date = Date.create(data.timestamp);
                this.timestamp = date;
                this.emit("update", { type: "account", field: "timestamp", value: date });
            }
            else if (data.contract) {
                this.positions[data.contract.conId] = data;
                this.emit("update", { type: "position", field: data.contract.conId, value: data });
            }
            else {
                this.emit("error", "Unrecognized account update " + JSON.stringify(data));
            }
        }).on("error", err => {
            this.emit("error", err);
        }).send();
        
        this.cancel = () => account.cancel();
        
        setTimeout(() => this.emit("load"), 500);
    }
    
}

module.exports = Account;