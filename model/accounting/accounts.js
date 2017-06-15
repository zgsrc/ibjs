"use strict";

const RealTime = require("../realtime"),
      flags = require("../flags");

class Accounts extends RealTime {
    
    /* string group, array tags, boolean positions */
    constructor(session, options) {
        super(session);

        if (options == null) {
            options = { positions: true };
        }
        
        let positions = null, summary = this.service.accountSummary(
            options.group || "All", 
            options.tags || Object.values(flags.ACCOUNT_TAGS).join(',')
        ).on("data", datum => {
            if (datum.account && datum.tag) {
                let id = datum.account;
                if (this[id] == null) {
                    this[id] = { positions: { } };
                }

                if (datum.tag) {
                    var value = datum.value;
                    if (/^\-?[0-9]+(\.[0-9]+)?$/.test(value)) value = parseFloat(value);
                    else if (value == "true") value = true;
                    else if (value == "false") value = false;

                    if (datum.currency && datum.currency != "") {
                        value = { currency: datum.currency, value: value };
                    }

                    var key = datum.tag.camelize(false);
                    this[id][key] = value;
                    this.emit("update", { field: key, value: value });
                }
            }
        }).on("end", cancel => {
            if (options.positions) {
                positions = this.service.positions();
                positions.on("data", data => {
                    this[data.accountName].positions[data.contract.conId] = data;
                    this.emit("update", { type: "position", field: data.contract.conId, value: data });
                }).on("end", cancel => {
                    this.emit("load");
                }).on("error", err => {
                    this.emit("error", err);
                }).send();
            }
            else {
                this.emit("load");
            }
        }).on("error", err => {
            this.emit("error", err);
        }).send();
        
        this.close = () => {
            summary.cancel();
            if (positions) positions.cancel();
        };
    }
    
}

module.exports = Accounts;