"use strict";

const flags = require("../flags"),
      ContractBased = require("./contractbased"),
      contract = require("./contract"),
      Quote = require("./quote"),
      Depth = require("./depth"),
      Charts = require("./charts"),
      Order = require("./order");

class Security extends ContractBased {
    
    constructor(session, contract) {
        super(session, contract);
        
        this.quote = new Quote(session, contract);
        this.quote.on("update", data => this.emit("update", data));
        
        this.depth = new Depth(session, contract);
        this.depth.on("update", data => this.emit("update", data));
        
        this.charts = new Charts(session, contract, flags.HISTORICAL.trades);
        this.charts.on("update", data => this.emit("update", data));
        
        this.reports = { };
    }
    
    async fundamentals(type) {
        return new Promise((resolve, reject) => {
            this.service.fundamentalData(this.contract.summary, flags.FUNDAMENTALS_REPORTS[type] || type)
                .once("data", data => {
                    let keys = Object.keys(data);
                    if (keys.length == 1) this.reports[type] = data[keys.first()];
                    else this.reports[type] = data;
                    resolve(this.reports[type]);
                })
                .once("end", () => reject(new Error("Could not load " + type + " fundamental data for " + this.contract.symbol + ". " + err.message)))
                .once("error", err => reject(new Error("Could not load " + type + " fundamental data for " + this.contract.symbol + ". " + err.message)))
                .send();
        });
    }
    
    order() {
        return new Order(this.session, this.contract);
    }
    
    cancel() {
        if (this.quote) this.quote.cancel();
        if (this.depth) this.depth.cancel();
        if (this.charts) this.charts.cancel();
    }
    
}

module.exports = Security;