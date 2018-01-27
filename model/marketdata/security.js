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
        this.depth = new Depth(session, contract);
        this.charts = new Charts(session, contract, flags.HISTORICAL.trades);
        this.reports = { };
    }
    
    async fundamentals(type) {
        return new Promise((resolve, reject) => {
            this.service.fundamentalData(this.contract.summary, flags.FUNDAMENTALS_REPORTS[type] || type)
                .once("data", data => {
                    let keys = Object.keys(data);
                    if (keys.length == 1) this.reports[type] = processFundamentals(data[keys.first()]);
                    else this.reports[type] = processFundamentals(data);
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

function processFundamentals(obj) {
    if (Array.isArray(obj)) {
        if (obj.every(o => o._ && o.$.Type)) {
            let o = { };
            obj.forEach(i => {
                let key = i.$.Type.camelize(true);
                if (Object.keys(i.$).length == 1) o[key] = i._;
                else o[key] = Object.merge({ text: i._ }, Object.reject(i.$, "Type"));
            });
            return o;
        }
        else {
            return obj.map(processFundamentals);
        }
    }
    else if (Object.isObject(obj)) {
        Object.keys(obj).forEach(key => {
            if (key == "$") {
                Object.merge(obj, obj[key]);
                delete obj.$;
            }
            else if (key == "_") {
                if (obj.text == null) {
                    obj.text = obj._;
                    delete obj._;
                }
                else if (obj.value == null) {
                    obj.value = obj._;
                    delete obj._;
                }
            }
            else if (Array.isArray(obj[key]) || Object.isObject(obj[key])) {
                obj[key] = processFundamentals(obj[key]);
                if (key == "Industry" && Array.isArray(obj[key])) {
                    obj[key] = obj[key].groupBy("type");
                }
            }
        });
    }
    
    return obj;
}

module.exports = Security;