"use strict";

const Events = require("events");

class Executions extends Events {
    
    constructor(service, options) {
        super();
        
        options = options || { };
        
        this.service = service;
        
        this.filter = { };
        if (options.account) filter.acctCode = options.account;
        if (options.client) filter.clientId = options.client;
        if (options.exchange) filter.exchange = options.exchange;
        if (options.secType) filter.secType = options.secType;
        if (options.side) filter.side = options.side;
        if (options.symbol) filter.symbol = options.symbol;
        if (options.time) filter.time = options.time;
        
        this.trades = { };
        
        let request = service.executions(this.filter);
        request.on("data", data => {
            if (!this.trades[data.exec.permId]) {
                this.trades[data.exec.permId] = { };
            }

            this.trades[data.exec.permId][data.exec.execId] = data;
            this.emit("update");
        }).on("error", err => {
            this.emit("error", err);
        }).on("end", () => {
            this.emit("updated");
        }).send();
        
        this.cancel = () => request.cancel();
    }
    
}

module.exports = Executions;