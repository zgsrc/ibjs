"use strict";

const Subscription = require("./subscription");

class Positions extends Subscription {
    
    constructor(session) {
        super(session);

        this.subscriptions.push(this.service.positions().on("data", data => {
            if (!this[data.contract.conId]) this[data.contract.conId] = { };
            this[data.contract.conId][data.accountName] = data;
            this.emit("update", { account: data.accountName, type: "position", field: data.contract.conId, value: data });
        }).on("end", cancel => {
            this.loaded = true;
            this.emit("load");
        }).on("error", err => {
            this.emit("error", err);
        }).send());
    }
    
}

module.exports = Positions;