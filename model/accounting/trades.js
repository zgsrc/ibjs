"use strict";

const Base = require("../base");

class Trades extends Base {
    
    constructor(session, options) {
        super(session);

        options = options || { };
        
        this.filter = { };
        this._exclude.push("filter");
        
        if (options.account) this.filter.acctCode = options.account;
        if (options.client) this.filter.clientId = options.client;
        if (options.exchange) this.filter.exchange = options.exchange;
        if (options.secType) this.filter.secType = options.secType;
        if (options.side) this.filter.side = options.side;
        if (options.symbol) this.filter.symbol = options.symbol;
        if (options.time) this.filter.time = options.time;
        
        let trades = this.service.executions(this.filter).on("data", data => {
            if (!this[data.exec.permId]) this[data.exec.permId] = { };
            this[data.exec.permId][data.exec.execId] = data;
            this.emit("update", data);
        }).on("error", err => {
            this.emit("error", err);
        }).on("end", () => {
            this.emit("load");
        }).send();
        
        this.cancel = () => trades.cancel();
    }
    
}

module.exports = Trades;