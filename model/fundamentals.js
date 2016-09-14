"use strict";

const async = require("async");

class Fundamentals {
    
    constructor(security) {
        this.security = security;
    }
    
    load(type, cb) {
        this.security.service.fundamentalData(this.security.summary, Fundamentals.REPORT[type])
            .on("data", (data, cancel) => {
                this[type] = data;
                if (cb) {
                    cb(null, data);
                }
            
                cancel();
            }).on("end", cancel => {
                if (cb) {
                    cb(new Error("Could not load " + type + " fundamental data for " + this.security.summary.localSymbol + ". " + err.message));
                }
            
                cancel();
            }).on("error", (err, cancel) => {
                if (cb) {
                    cb(new Error("Could not load " + type + " fundamental data for " + this.security.summary.localSymbol + ". " + err.message));
                }

                cancel();
            }).send();
    }
    
    loadSome(types, cb) {
        async.forEachSeries(
            types,
            (type, cb) => this.load(type, cb), 
            err => cb ? cb(err) : null
        );
    }
    
    loadAll(cb) {
        let msg = "";
        async.forEachSeries(
            Object.keys(Fundamentals.REPORT).exclude("ratios"), /* Ratios not working */
            (type, cb) => this.load(type, err => {
                if (err) msg += err.message + " ";
                cb();
            }), 
            err => cb ? cb(msg.length ? new Error(msg.trim()) : null) : null
        );
    }
    
}

Fundamentals.REPORT = {
    snapshot: "ReportSnapshot",
    financials: "ReportsFinSummary",
    ratios: "ReportRatios",
    statements: "ReportsFinStatements",
    consensus: "RESC",
    calendar: "CalendarReport"
};

module.exports = Fundamentals;