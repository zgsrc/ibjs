const { DateTime } = require('luxon'),
      constants = require("../constants"),
      market = require("./market"),
      Order = require("./order"),
      Quote = require("./quote"),
      Depth = require("./depth"),
      Candlesticks = require("./candlesticks"),
      memoize = require('p-memoize');

exports.cache = null;

class Contract {
    
    constructor(service, data) {
        Object.defineProperty(this, "service", { value: service, enumerable: false });
        Object.merge(this, data);
        
        this.symbol = this.summary.localSymbol;
        if (this.symbol) {
            this.symbol = this.symbol.compact().parameterize().underscore().toUpperCase();
        }
        
        if (this.orderTypes) {
            Object.defineProperty(this, "orderTypes", { value: this.orderTypes.split(",").compact(), enumerable: false });
        }
        
        if (this.validExchanges) {
            Object.defineProperty(this, "validExchanges", { value: this.validExchanges.split(",").compact(), enumerable: false });
        }
        
        Object.defineProperty(this, "market", { 
            value: market.getMarket(
                this.summary.primaryExch, 
                this.summary.secType, 
                this.timeZoneId,
                this.tradingHours,
                this.liquidHours
            ),
            enumerable: false 
        });
        
        delete this.timeZoneId;
        delete this.tradingHours;
        delete this.liquidHours;
        
        if (this.summary.expiry) {
            this.expiry = Date.create(DateTime.fromISO(this.summary.expiry, { zone: this.market.timeZoneId }).toJSDate());
        }
        
        const summary = this.summary;
        if (this.summary.secType == constants.SECURITY_TYPE.stock) {
            let fn = async function(type) {
                return new Promise((yes, no) => {
                    service.fundamentalData(summary, constants.FUNDAMENTALS_REPORTS[type] || type)
                        .once("data", data => {
                            let keys = Object.keys(data),
                                report = keys.length == 1 ? data[keys.first()] : data;

                            yes(report);
                        })
                        .once("end", () => no(new Error("Could not load " + type + " fundamental data for " + symbol + ". " + err.message)))
                        .once("error", err => no(new Error("Could not load " + type + " fundamental data for " + symbol + ". " + err.message)))
                        .send();
                });
            };
            
            Object.defineProperty(this, "getFundamentalsReport", { 
                value: memoize(fn, { maxAge: 1000 * 60 }), /* 1 minute */
                configurable: true
            });
            
            if (exports.cache) {
                exports.cache.fn(this.getFundamentalsReport, { 
                    maxAge: 1000 * 60 * 60 * 24 * 7, /* 1 week */
                    salt: summary.conId.toString()
                }).then(fn => Object.defineProperty(this, "getFundamentalsReport", { value: fn }));
            }
        }
        
        Object.defineProperty(this, "getRecentHistory", { 
            /* 5 second cache */
            value: memoize(
                (barSize, field, rth) => history(service, summary, undefined, barSize, field, rth), 
                { maxAge: 1000 * 5 }
            )
        });
        
        let historyBefore = (date, barSize, field, rth) => history(service, summary, date, barSize, field, rth);
        historyBefore = memoize(historyBefore, { maxAge: 1000 * 60 });
        
        let quantHistoryBefore = (date, barSize, field, rth) => historyBefore(date.reset('day'), barSize, field, rth);
        
        Object.defineProperty(this, "getHistoryBefore", { 
            value: quantHistoryBefore,
            configurable: true
        });
        
        if (exports.cache) {
            exports.cache.fn(quantHistoryBefore, {
                maxAge: 1000 * 60 * 60 * 24 * 7, /* 1 week */
                salt: summary.conId.toString()
            }).then(fn => Object.defineProperty(this, "getHistoryBefore", { value: fn }))
        }
    }
    
    quote() {
        return new Quote(this);
    }
    
    order(data) {
        return new Order(this, data);
    }
    
    toString() {
        return `${this.summary.localSymbol}@${this.summary.primaryExchange} ${this.summary.secType}`;
    }
    
}

exports.Contract = Contract;

async function history(service, summary, lastDate, barSize, field, rth, dateFormat, retry) {
    return new Promise((yes, no) => {
        let series = [ ];
        service.historicalData(
            summary, 
            lastDate ? lastDate.format("{yyyy}{MM}{dd} {HH}:{mm}:{ss}") : "",
            barSize.duration, barSize.text, 
            field, 
            rth ? 1 : 0, dateFormat || 1, 
            false
        ).on("data", record => {
            record.date = Date.create(record.date);
            record.timestamp = record.date.getTime();
            series.push(record);
        }).once("error", err => {
            if (!retry && err.timeout) history(service, summary, lastDate, barSize, field, rth, dateFormat, true).then(yes).catch(no);
            else no(err);
        }).once("end", () => {
            yes(series.sortBy("timestamp"));
        }).send();
    });
}

exports.history = history;

async function all(service, summary) {
    let list = [ ];
    return new Promise((yes, no) => {
        service.contractDetails(summary)
            .on("data", contract => list.push(new Contract(service, contract)))
            .once("error", err => no(err))
            .once("end", () => yes(list))
            .send();
    }); 
}

exports.all = memoize(all, {
    maxAge: 1000 * 60, /* 1 minute */
    cacheKey: (service, summary) => JSON.stringify(summary)
});

async function first(service, summary) {
    let list = [ ];
    return new Promise((yes, no) => {
        service.contractDetails(summary)
            .on("data", contract => yes(new Contract(service, contract)))
            .once("error", err => no(err))
            .once("end", () => null)
            .send();
    }); 
}

exports.first = memoize(first, {
    maxAge: 1000 * 60, /* 1 minute */
    cacheKey: (service, summary) => JSON.stringify(summary)
});