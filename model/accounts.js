"use strict";

const Subscription = require("./subscription"),
      constants = require("../constants"),
      Currency = require("./currency");

class Accounts extends Subscription {
    
    /* string group, array tags, boolean positions */
    constructor(service, options) {
        super(service);
        
        options = options || { };
        
        this.subscriptions.push(this.service.accountSummary(
            options.group || "All", 
            options.tags || Object.values(constants.ACCOUNT_TAGS).join(',')
        ).on("data", datum => {
            if (datum.account && datum.tag) {
                let id = datum.account;
                if (this[id] == null) this[id] = { };
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
                    this[id][key] = value;
                    this.emit("update", { account: id, type: "balance", field: key, value: value });
                }
            }
        }).on("end", cancel => {
            this.loaded = true;
            this.emit("load");
        }).on("error", err => {
            this.emit("error", err);
        }).send());
    }
    
}

module.exports = Accounts;