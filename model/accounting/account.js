"use strict";

const RealTime = require("../realtime");

class Account extends RealTime {
    
    constructor(session, id) {
        super(session);
        this.id = id;
        this.positions = { };
    }
    
    /* string id, object/boolean orders, object/boolean trades */
    stream(options) {
        if (Object.isNumber(options)) {
            options = { 
                id: options 
            };
        }
        
        if (options.id) {
            this.id = options.id;
        }
        
        let account = this.service.accountUpdates(this.id).on("data", data => {
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
                this.emit("warning", "Unrecognized account update " + JSON.stringify(data));
            }
        }).on("error", err => {
            this.emit("error", err);
        }).send();
        
        let orders = null;
        if (options.orders) {
            this.orders = this.session.orders();
            this.orders.stream(options.orders);
        }
        
        let trades = null;
        if (options.trades) {
            this.trades = this.session.trades();
            this.trades.stream(options.trades);
        }
        
        this.cancel = () => {
            account.cancel();
            if (orders) orders.cancel();
            if (trades) trades.cancel();
            
            return true;
        }
    }
    
}

module.exports = Account;