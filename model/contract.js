

const { DateTime } = require('luxon'),
      constants = require("../constants"),
      Order = require("./order"),
      Quote = require("./quote"),
      Depth = require("./depth"),
      Charts = require("./charts");

class Contract {
    
    constructor(service, data) {
        Object.defineProperty(this, "service", { value: service, enumerable: false });
        Object.merge(this, data);
        
        this.symbol = this.summary.localSymbol.compact().parameterize().underscore().toUpperCase();
        
        Object.defineProperty(this, "orderTypes", { value: this.orderTypes.split(",").compact(), enumerable: false });
        Object.defineProperty(this, "validExchanges", { value: this.validExchanges.split(",").compact(), enumerable: false });
        
        this.timeZoneId = constants.tz[this.timeZoneId] || this.timeZoneId;
        
        if (this.summary.expiry) {
            this.expiry = Date.create(DateTime.fromISO(this.summary.expiry, { zone: this.timeZoneId }).toJSDate());
        }
        
        let tradingHours = (this.tradingHours || "").split(';').compact(true).map(d => d.split(':')),
            liquidHours = (this.liquidHours || "").split(';').compact(true).map(d => d.split(':'));
        
        let schedule = { };
        tradingHours.forEach(arr => {
            if (arr[1] == "CLOSED") return;
            
            let date = Date.create(arr[0], { future: true });
            
            let label = date.format("{Mon}{dd}");
            if (!schedule[label]) schedule[label] = { };
            
            let times = arr[1].split(',').map(d => d.split('-').map(t => t.to(2) + ":" + t.from(2)));
            
            schedule[label].start = [ ];
            schedule[label].end = [ ];
            
            times.forEach(time => {
                let start = Date.create(DateTime.fromISO(date.format(`{yyyy}-{MM}-{dd}T${time[0]}:00`), { zone: this.timeZoneId }).toJSDate()),
                    end = Date.create(DateTime.fromISO(date.format(`{yyyy}-{MM}-{dd}T${time[1]}:00`), { zone: this.timeZoneId }).toJSDate());

                if (end.isBefore(start)) start.addDays(-1);

                schedule[label].start.push(start);
                schedule[label].end.push(end);
            });
            
            if (schedule[label].start.length != schedule[label].end.length) {
                throw new Error("Bad trading hours.");
            }
        });

        liquidHours.forEach(arr => {
            if (arr[1] == "CLOSED") return;
            
            let date = Date.create(arr[0], { future: true });
            
            let label = date.format("{Mon}{dd}");
            if (!schedule[label]) schedule[label] = { };
            
            let times = arr[1].split(',').map(d => d.split('-').map(t => t.to(2) + ":" + t.from(2)));
            
            schedule[label].open = [ ];
            schedule[label].close = [ ];
            
            times.forEach(time => {
                let start = Date.create(DateTime.fromISO(date.format(`{yyyy}-{MM}-{dd}T${time[0]}:00`), { zone: this.timeZoneId }).toJSDate()),
                    end = Date.create(DateTime.fromISO(date.format(`{yyyy}-{MM}-{dd}T${time[1]}:00`), { zone: this.timeZoneId }).toJSDate());

                if (end.isBefore(start)) start.addDays(-1);

                schedule[label].open.push(start);
                schedule[label].close.push(end);
            });
            
            if (schedule[label].open.length != schedule[label].close.length) {
                throw new Error("Bad liquid hours.");
            }
        });
        
        Object.defineProperty(schedule, 'today', {
            get: function() {
                let now = Date.create(),
                    today = schedule[now.format("{Mon}{dd}")];
                
                if (today && today.end.every(end => end.isBefore(now))) {
                    now.addDays(1);
                    today = schedule[now.format("{Mon}{dd}")];
                }
                
                return today;
            }
        });
        
        Object.defineProperty(schedule, 'tomorrow', {
            get: function() {
                if (this.today) {
                    let now = this.today.addDays(1);
                    return schedule[now.format("{Mon}{dd}")];
                }
                else return null;
            }
        });
        
        Object.defineProperty(schedule, 'next', {
            get: function() {
                let now = Date.create(),
                    today = schedule[now.format("{Mon}{dd}")],
                    advances = 0;
                
                while (today == null && advances < 7) {
                    advances++;
                    now.addDays(1);
                    today = schedule[now.format("{Mon}{dd}")];
                    if (today && today.end.every(end => end.isPast())) {
                        today = null;
                    }
                }
                
                return today;
            }
        });
        
        Object.defineProperty(this, 'schedule', { value: schedule });
        
        delete this.tradingHours;
        delete this.liquidHours;
        
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
    
    order(data) {
        return new Order(this, data);
    }
    
    toString() {
        return this.summary.localSymbol;
    }
    
    get marketsOpen() {
        let now = Date.create(), hours = this.schedule.today;
        if (hours && hours.start && hours.end) {
            for (let i = 0; i < hours.start.length; i++) {
                if (now.isBetween(hours.start[i], hours.end[i])) return true;
            }
        }
        
        return false;
    }
    
    get marketsLiquid() {
        let now = Date.create(), hours = this.schedule.today;
        if (hours && hours.open && hours.close) {
            for (let i = 0; i < hours.open.length; i++) {
                if (now.isBetween(hours.open[i], hours.close[i])) return true;
            }
        }
        
        return false;
    }
    
    get nextStartOfDay() {
        return this.schedule.next.start.find(start => start.isFuture());
    }
    
    get nextOpen() {
        return this.schedule.next.open.find(open => open.isFuture());
    }
    
    get nextClose() {
        return this.schedule.next.close.find(close => close.isFuture());
    }
    
    get nextEndOfDay() {
        return this.schedule.next.end.find(end => end.isFuture());
    }
    
    get quote() {
        if (!this._quote) {
            Object.defineProperty(this, "_quote", { value: new Quote(this), enumerable: false });
        }
        
        return this._quote;
    }
    
    get depth() {
        if (!this._depth) {
            Object.defineProperty(this, "_depth", { value: new Depth(this), enumerable: false });
        }
        
        return this._depth;
    }
    
    get charts() {
        if (!this._charts) {
            Object.defineProperty(this, "_charts", { value: new Charts(this), enumerable: false });
        }
        
        return this._charts;
    }
    
    createQuoteSubscription() {
        return new Quote(this);
    }
    
    createDepthSubscription() {
        return new Depth(this);
    }

    createChartsSubscription() {
        return new Charts(this);
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