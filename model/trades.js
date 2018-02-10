"use strict";

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
        
        this.subscriptions.push(this.service.executions(filter).on("data", data => {
            if (!this[data.exec.permId]) this[data.exec.permId] = { };
            this[data.exec.permId][data.exec.execId] = data;
            this.emit("update", { account: data.exec.acctNumber, type: "trade", field: data.exec.permId, value: data.exec });
        }).on("error", err => {
            this.emit("error", err);
        }).on("end", () => {
            this.loaded = true;
            this.emit("load");
        }).send());
    }
    
}

module.exports = Trades;