"use strict";

const Base = require("../base");

class Trades extends Base {
    
    constructor(session, options) {
        super(session);

        this._exclude.append([ "loaded" ])
        
        options = options || { };
        
        let filter = { };
        if (options.account) filter.acctCode = options.account;
        if (options.client) filter.clientId = options.client;
        if (options.exchange) filter.exchange = options.exchange;
        if (options.secType) filter.secType = options.secType;
        if (options.side) filter.side = options.side;
        if (options.symbol) filter.symbol = options.symbol;
        if (options.time) filter.time = options.time;
        
        let trades = this.service.executions(filter).on("data", data => {
            if (!this[data.exec.permId]) this[data.exec.permId] = { };
            this[data.exec.permId][data.exec.execId] = data;
            this.emit("update", data);
        }).on("error", err => {
            this.emit("error", err);
        }).on("end", () => {
            this.loaded = true;
            this.emit("load");
        }).send();
        
        this.cancel = () => trades.cancel();
    }
    
}

module.exports = Trades;