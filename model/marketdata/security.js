"use strict";

require("sugar").extend();

const flags = require("../flags"),
      MarketData = require("./marketdata"),
      Quote = require("./quote"),
      Depth = require("./depth"),
      Charts = require("./charts"),
      Order = require("./order");

class Security extends MarketData {
    
    constructor(session, contract) {
        super(session, contract);
        
        this.quote = new Quote(session, contract);
        this.quote.on("error", err => this.emit("error", err));
        
        this.depth = new Depth(session, contract);
        this.depth.on("error", err => this.emit("error", err));
        
        this.charts = new Charts(session, contract);
        this.charts.on("error", err => this.emit("error", err));
    }
    
    fundamentals(type, cb) {
        this.service.fundamentalData(this.contract.summary, flags.FUNDAMENTALS_REPORTS[type])
            .on("data", data => cb(null, data))
            .on("end", () => cb(new Error("Could not load " + type + " fundamental data for " + this.contract.localSymbol + ". " + err.message)))
            .on("error", err => cb(new Error("Could not load " + type + " fundamental data for " + this.contract.localSymbol + ". " + err.message)))
            .send();
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

function securities(session, description, cb) {
    session.details(description, (err, contracts) => {
        if (err) cb(err);
        else cb(null, contracts.map(contract => new Security(session, contract)));
    });
}

module.exports = securities;