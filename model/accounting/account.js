"use strict";

const RealTime = require("../realtime"),
      Currency = require("../currency");

class Account extends RealTime {
    
    /* string id, boolean trades */
    constructor(session, options) {
        super(session);
        
        if (typeof options == "string") options = { id: options, orders: true, trades: true };
        if (typeof options.id != "string") throw new Error("Account id is required.");
        
        this.balances = new RealTime(session);
        this.positions = new RealTime(session);
        this.orders = session.orders.stream();
        
        let account = this.service.accountUpdates(options.id).on("data", data => {
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
                this.emit("update", { type: "balances", field: key, value: value });
            }
            else if (data.timestamp) {
                let date = Date.create(data.timestamp);
                this.timestamp = date;
                this.emit("update", { type: "timestamp", field: "timestamp", value: date });
            }
            else if (data.contract) {
                this.positions[data.contract.conId] = data;
                this.emit("update", { type: "position", field: data.contract.conId, value: data });
            }
            else {
                this.emit("error", "Unrecognized account update " + JSON.stringify(data));
            }
        }).on("end", () => {
            if (options.trades) {
                session.trades({ account: options.id }).then(trades => {
                    this.trades = trades;
                    if (this.orders.loaded) this.emit("load");
                    else this.orders.on("load", () => this.emit("load"));
                });
            }
            else {
                if (this.orders.loaded) this.emit("load");
                else this.orders.on("load", () => this.emit("load"));
            }
        }).on("error", err => {
            this.emit("error", err);
        }).send();
        
        this.cancel = () => {
            account.cancel();
            if (this.trades) {
                this.trades.cancel();
            }
        }
    }
    
}

module.exports = Account;