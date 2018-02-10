"use strict";

const Subscription = require("./subscription"),
      Bars = require("./bars"),
      constants = require("./constants");

Date.getLocale('en').addFormat('{yyyy}{MM}{dd}  {hh}:{mm}:{ss}');

class Charts extends Subscription {
    
    constructor(contract, field) {
        super(contract);
        this.setMaxListeners(50);
        
        Object.defineProperty(this, 'field', { value: field, enumerable: false });
        this.series = [ ];

        return new Proxy(this, {
            get: function(obj, prop) {
                if (obj[prop]) return obj[prop];
                else {
                    if (constants.BAR_SIZES[prop]) return obj[prop] = new Bars(this.session, contract, this, constants.BAR_SIZES[prop]);
                    else return null;
                }
            }
        });
    }
    
    async stream(retry) {
        this.service.headTimestamp(this.contract.summary, this.field, 0, 1).once("data", data => {
            this.earliestDataTimestamp = Date.create(data);
        }).send();
        
        let req = this.service.realTimeBars(this.contract.summary, 5, this.field, false);
        this.subscriptions.push(req);
        
        return new Promise((yes, no) => {
            let errHandler = err => {
                if (!retry && err.timeout) this.stream(true).then(yes).catch(no);
                else {
                    this.streaming = false;
                    no(err);
                }
            }
            
            req.once("error", errHandler).once("data", () => {
                req.removeListener("error", errHandler);
                req.on("error", err => {
                    this.streaming = false;
                    this.emit("error", `Real time streaming bars request for ${this.contract.summary.localSymbol} timed out.`);
                });
                
                this.streaming = true;
                yes(this);
            }).on("data", data => {
                data.date = Date.create(data.date * 1000);
                data.timestamp = data.date.getTime();
                this.series.push(data);
                this.emit("update", { contract: this.contract.summary.conId, type: "chart", field: "realtime", value: data });
            }).send();
        });
    }
    
}

module.exports = Charts;