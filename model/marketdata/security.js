"use strict";

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
        this.depth = new Depth(session, contract);
        this.charts = new Charts(session, contract, flags.HISTORICAL.trades);
        this.reports = { };
        
        this._pending = [ ];
        this._exclude.append("pending");
    }
    
    fundamentals(type, cb) {
        this.service.fundamentalData(this.contract.summary, flags.FUNDAMENTALS_REPORTS[type] || type)
            .once("data", data => {
                let keys = Object.keys(data);
                if (keys.length == 1) this.reports[type] = data[keys.first()];
                else this.reports[type] = data;
                
                if (cb) cb(null, this.reports[type]);
            })
            .once("end", () => {
                if (cb) cb(new Error("Could not load " + type + " fundamental data for " + this.contract.symbol + ". " + err.message))
            })
            .once("error", err => {
                if (cb) cb(new Error("Could not load " + type + " fundamental data for " + this.contract.symbol + ". " + err.message))
            })
            .send();
    }
    
    order() {
        return new Order(this.session, this.contract);
    }
    
    delay(call, millis) {
        this._pending.append(setTimeout(call, millis));
    }
    
    cancel() {
        this._pending.forEach(t => clearTimeout(t));
        this._pending = [ ];
        
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