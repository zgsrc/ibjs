"use strict";

const RealTime = require("./realtime");

class Executions extends RealTime {
    
    constructor(service, options) {
        super(service);
        this.filter = { };
        this.trades = { };
    }
    
    stream(options) {
        options = options || { };
        
        if (options.account) this.filter.acctCode = options.account;
        if (options.client) this.filter.clientId = options.client;
        if (options.exchange) this.filter.exchange = options.exchange;
        if (options.secType) this.filter.secType = options.secType;
        if (options.side) this.filter.side = options.side;
        if (options.symbol) this.filter.symbol = options.symbol;
        if (options.time) this.filter.time = options.time;
        
        let request = this.service.executions(this.filter);
        request.on("data", data => {
            if (!this.trades[data.exec.permId]) {
                this.trades[data.exec.permId] = { };
            }

            this.trades[data.exec.permId][data.exec.execId] = data;
            this.emit("update");
        }).on("error", err => {
            this.emit("error", err);
        }).on("end", () => {
            this.emit("load");
        }).send();
        
        this.cancel = () => {
            request.cancel();
            return true;
        };
    }
    
}

module.exports = Executions;