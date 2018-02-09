"use strict";

const Subscription = require("../subscription"),
      constants = require("../constants"),
      Currency = require("./currency");

class Accounts extends Subscription {
    
    /* string group, array tags, boolean positions */
    constructor(session, options) {
        super(session);
        
        if (options == null) {
            options = { 
                positions: true,
                trades: true
            };
        }
        
        this.orders = session.orders.stream();
        this.orders.on("update", data => this.emit("update", data));
        
        this.subscriptions.push(this.service.accountSummary(
            options.group || "All", 
            options.tags || Object.values(constants.ACCOUNT_TAGS).join(',')
        ).on("data", datum => {
            if (datum.account && datum.tag) {
                let id = datum.account;
                if (this[id] == null) this[id] = { balances: { }, positions: { } };
                if (datum.tag) {
                    var value = datum.value;
                    if (/^\-?[0-9]+(\.[0-9]+)?$/.test(value)) value = parseFloat(value);
                    else if (value == "true") value = true;
                    else if (value == "false") value = false;

                    
                    if (datum.currency && datum.currency != "") {
                        if (datum.currency != value) {
                            value = new Currency(datum.currency, value);
                        }
                    }

                    var key = datum.tag.camelize(false);
                    this[id].balances[key] = value;
                    this.emit("update", { account: id, type: "balance", field: key, value: value });
                }
            }
        }).on("end", cancel => {
            if (options.positions) {
                this.subscriptions.push(this.service.positions().on("data", data => {
                    this[data.accountName].positions[data.contract.conId] = data;
                    this.emit("update", { account: data.accountName, type: "position", field: data.contract.conId, value: data });
                }).on("end", cancel => {
                    if (options.trades) {
                        this.session.trades().then(trades => {
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
                }).send());
            }
            else {
                if (options.trades) {
                    this.session.trades().then(trades => {
                        this.trades = trades;
                        this.trades.on("update", data => this.emit("update", data));
                        if (this.orders.loaded) this.emit("load");
                        else this.orders.on("load", () => this.emit("load"));
                    });
                }
                else {
                    if (this.orders.loaded) this.emit("load");
                    else this.orders.on("load", () => this.emit("load"));
                }
            }
        }).on("error", err => {
            this.emit("error", err);
        }).send());
        
        this.on("load", () => this.loaded = true);
    }
    
}

module.exports = Accounts;