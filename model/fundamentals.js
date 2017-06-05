"use strict";

const async = require("async"),
      MarketData = require("./marketdata");

const REPORT = {
    snapshot: "ReportSnapshot",
    financials: "ReportsFinSummary",
    ratios: "ReportRatios",
    statements: "ReportsFinStatements",
    consensus: "RESC",
    calendar: "CalendarReport"
};

class Fundamentals extends MarketData {
    
    constructor(security) {
        super(security);
        this.REPORT_TYPES = REPORT;
    }
    
    loadSnapshot(cb) {
        this.load("snapshot", cb);
    }
    
    loadFinancials(cb) {
        this.load("financials", cb);
    }
    
    loadRatios(cb) {
        this.load("ratios", cb);
    }
    
    loadStatements(cb) {
        this.load("statements", cb);
    }
    
    loadConsensus(cb) {
        this.load("consensus", cb);
    }
    
    loadCalendar(cb) {
        this.load("calendar", cb);
    }
    
    load(type, cb) {
        this.security.service.fundamentalData(this.security.summary, REPORT[type])
            .on("data", (data, cancel) => {
                this[type] = data;
                if (cb) {
                    cb(null, data);
                }
            
                this.emit("update");
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
            err => {
                cb ? cb(err) : null;
                this.emit("load");
            }
        );
    }
    
    loadAll(cb) {
        let msg = "";
        async.forEachSeries(
            Object.keys(REPORT).exclude("ratios"), /* Ratios not working */
            (type, cb) => this.load(type, err => {
                if (err) msg += err.message + " ";
                cb();
            }), 
            err => {
                cb ? cb(msg.length ? new Error(msg.trim()) : null) : null;
                this.emit("load");
            }
        );
    }
    
}

module.exports = Fundamentals;