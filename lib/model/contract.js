const Events = require("events"),
      { DateTime } = require('luxon'),
      constants = require("../constants"),
      market = require("./market"),
      Order = require("./order"),
      Quote = require("./quote"),
      Depth = require("./depth"),
      Candlesticks = require("./candlesticks");

class Contract {
    
    constructor(service, data) {
        Object.defineProperty(this, "service", { value: service, enumerable: false });
        Object.merge(this, data);
        
        this.symbol = this.summary.localSymbol.compact().parameterize().underscore().toUpperCase();
        
        Object.defineProperty(this, "orderTypes", { value: this.orderTypes.split(",").compact(), enumerable: false });
        Object.defineProperty(this, "validExchanges", { value: this.validExchanges.split(",").compact(), enumerable: false });
        
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
        
        if (this.summary.secType == constants.SECURITY_TYPE.stock) {
            Object.defineProperty(this, "fundamentals", { value: { } });
            Object.defineProperty(this, "fetchReport", {
                value: async function(type) {
                    return new Promise((resolve, reject) => {
                        this.service.fundamentalData(this.summary, constants.FUNDAMENTALS_REPORTS[type] || type)
                            .once("data", data => {
                                let keys = Object.keys(data),
                                    report = keys.length == 1 ? data[keys.first()] : data;

                                resolve(this.fundamentals[type] = report);
                            })
                            .once("end", () => reject(new Error("Could not load " + type + " fundamental data for " + contract.symbol + ". " + err.message)))
                            .once("error", err => reject(new Error("Could not load " + type + " fundamental data for " + contract.symbol + ". " + err.message)))
                            .send();
                    });
                }
            })
        }
    }
    
    quote() {
        return new Quote(this);
    }
    
    order(data) {
        return new Order(this, data);
    }
    
    async history(minDate, retry) {
        return new Promise((yes, no) => {
            series = series || [ ];
            this.service.historicalData(
                this.contract.summary, 
                minDate ? minDate.format("{yyyy}{MM}{dd} {HH}:{mm}:{ss}") : "",
                this.barSize.duration, 
                this.barSize.text, 
                this.charts.field, 
                this.options.regularTradingHours ? 1 : 0,
                this.options.dateFormat,
                false
            ).on("data", record => {
                record.date = Date.create(record.date);
                record.timestamp = record.date.getTime();
                series.push(record);
            }).once("error", err => {
                if (!retry && err.timeout) this.history(series, true).then(yes).catch(no);
                else no(err);
            }).once("end", () => {
                yes(series.sortBy("timestamp"));
            }).send();
        });
    }
    
    toString() {
        return this.summary.localSymbol;
    }
    
}

exports.Contract = Contract;

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

exports.all = all;

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

exports.first = first;