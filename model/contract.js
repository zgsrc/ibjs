const Events = require("events"),
      { DateTime } = require('luxon'),
      constants = require("../constants"),
      Order = require("./order"),
      Quote = require("./quote"),
      Depth = require("./depth"),
      Charts = require("./charts");

const tz = {
    // USA
    EST5EDT: "America/New_York",
    EST: "America/New_York",
    EDT: "America/New_York",
    CST6CDT: "America/Chicago",
    CST: "America/Chicago",
    CDT: "America/Chicago",
    MST7MDT: "America/Denver",
    MST: "America/Denver",
    MDT: "America/Denver",
    PST8PDT: "America/Los_Angeles",
    PST: "America/Los_Angeles",
    PDT: "America/Los_Angeles",
    
    // SOUTH AMERICA
    ART: "America/Buenos_Aires",
    BRST: "America/Sao_Paolo",
    VET: "America/Caracas",
    
    // EUROPE
    WET: "Europe/Lisbon",
    GMT: "Europe/London",
    CET: "Europe/Paris",
    MET: "Europe/Paris",
    EET: "Europe/Helsinki",
    MSK: "Europe/Moscow",
    
    // MIDDLE EAST
    IST: "Asia/Tel_Aviv",
    AST: "Asia/Dubai",
    
    // AFRICA
    SAST: "Africa/Johannesburg",
    
    // ASIA
    IST: "Asia/Kolkata",
    HKT: "Asia/Hong_Kong",
    CST: "Asia/Shanghai",
    KST: "Asia/Seoul",
    JST: "Asia/Tokyo",
    AEDT: "Australia/Sydney"
};

const markets = exports.markets = { };

class Market extends Events {
    
    constructor(primaryExch, secType, timeZoneId, tradingHours, liquidHours) {
        super();
        
        Object.defineProperty(this, "domain", { value: this.domain, enumerable: false });
        Object.defineProperty(this, "_events", { value: this._events, enumerable: false });
        Object.defineProperty(this, "_eventsCount", { value: this._eventsCount, enumerable: false });
        Object.defineProperty(this, "_maxListeners", { value: this._maxListeners, enumerable: false });
        
        Object.defineProperty(this, 'name', { value: primaryExch });
        Object.defineProperty(this, 'type', { value: secType });
        Object.defineProperty(this, 'timeZoneId', { value: timeZoneId });
        Object.defineProperty(this, 'schedule', { value: { } });
        
        tradingHours = (tradingHours || "").split(';').compact(true).map(d => d.split(':'));
        liquidHours = (liquidHours || "").split(';').compact(true).map(d => d.split(':'));
        
        tradingHours.forEach(arr => {
            if (arr[1] == "CLOSED") return;
            
            let date = Date.create(arr[0], { future: true });
            
            let label = date.format("{Mon}{dd}");
            if (!this.schedule[label]) this.schedule[label] = { };
            
            let times = arr[1].split(',').map(d => d.split('-').map(t => t.to(2) + ":" + t.from(2)));
            
            this.schedule[label].start = [ ];
            this.schedule[label].end = [ ];
            
            times.forEach(time => {
                let start = Date.create(DateTime.fromISO(date.format(`{yyyy}-{MM}-{dd}T${time[0]}:00`), { zone: this.timeZoneId }).toJSDate()),
                    end = Date.create(DateTime.fromISO(date.format(`{yyyy}-{MM}-{dd}T${time[1]}:00`), { zone: this.timeZoneId }).toJSDate());

                if (end.isBefore(start)) start.addDays(-1);

                this.schedule[label].start.push(start);
                this.schedule[label].end.push(end);
            });
            
            if (this.schedule[label].start.length != this.schedule[label].end.length) {
                throw new Error("Bad trading hours.");
            }
        });

        liquidHours.forEach(arr => {
            if (arr[1] == "CLOSED") return;
            
            let date = Date.create(arr[0], { future: true });
            
            let label = date.format("{Mon}{dd}");
            if (!this.schedule[label]) this.schedule[label] = { };
            
            let times = arr[1].split(',').map(d => d.split('-').map(t => t.to(2) + ":" + t.from(2)));
            
            this.schedule[label].open = [ ];
            this.schedule[label].close = [ ];
            
            times.forEach(time => {
                let start = Date.create(DateTime.fromISO(date.format(`{yyyy}-{MM}-{dd}T${time[0]}:00`), { zone: this.timeZoneId }).toJSDate()),
                    end = Date.create(DateTime.fromISO(date.format(`{yyyy}-{MM}-{dd}T${time[1]}:00`), { zone: this.timeZoneId }).toJSDate());

                if (end.isBefore(start)) start.addDays(-1);

                this.schedule[label].open.push(start);
                this.schedule[label].close.push(end);
            });
            
            if (this.schedule[label].open.length != this.schedule[label].close.length) {
                throw new Error("Bad liquid hours.");
            }
        });
        
        Object.defineProperty(this.schedule, 'today', {
            get: function() {
                let now = Date.create(),
                    today = this.schedule[now.format("{Mon}{dd}")];
                
                if (today && today.end.every(end => end.isBefore(now))) {
                    now.addDays(1);
                    today = this.schedule[now.format("{Mon}{dd}")];
                }
                
                return today;
            }
        });
        
        Object.defineProperty(this.schedule, 'tomorrow', {
            get: function() {
                if (this.today) {
                    let now = this.today.addDays(1);
                    return this.schedule[now.format("{Mon}{dd}")];
                }
                else return null;
            }
        });
        
        Object.defineProperty(this.schedule, 'next', {
            get: function() {
                let now = Date.create(),
                    today = this.schedule[now.format("{Mon}{dd}")],
                    advances = 0;
                
                while (today == null && advances < 7) {
                    advances++;
                    now.addDays(1);
                    today = this.schedule[now.format("{Mon}{dd}")];
                    if (today && today.end.every(end => end.isPast())) {
                        today = null;
                    }
                }
                
                return today;
            }
        });
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
    
}

function getMarket(primaryExch, secType, timeZoneId, tradingHours, liquidHours) {
    let hash = Array.create(arguments).join("|");
    if (markets[hash]) return markets[hash];
    else return markets[hash] = new Market(primaryExch, secType, tz[timeZoneId] || timeZoneId, tradingHours, liquidHours);
}

class Contract {
    
    constructor(service, data) {
        Object.defineProperty(this, "service", { value: service, enumerable: false });
        Object.merge(this, data);
        
        this.symbol = this.summary.localSymbol.compact().parameterize().underscore().toUpperCase();
        
        Object.defineProperty(this, "orderTypes", { value: this.orderTypes.split(",").compact(), enumerable: false });
        Object.defineProperty(this, "validExchanges", { value: this.validExchanges.split(",").compact(), enumerable: false });
        
        Object.defineProperty(this, "market", { 
            value: getMarket(
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
    
    order(data) {
        return new Order(this, data);
    }
    
    toString() {
        return this.summary.localSymbol;
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