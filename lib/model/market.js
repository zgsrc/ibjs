const Events = require("events"),
      { DateTime } = require('luxon'),
      timer = require('node-schedule');

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
        
        liquidHours = (liquidHours || "").split(';').compact(true).map(d => d.split(':'));

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
        
        let sod = this.nextStartOfDay,
            eod = this.nextEndOfDay,
            open = this.nextOpen,
            close = this.nextClose;
        
        if (sod) {
            timer.scheduleJob(sod, () => this.emit("startOfDay"));
            timer.scheduleJob(sod.clone().addSeconds(-15), () => this.emit("beforeStartOfDay", sod));
        }
            
        if (eod) {
            timer.scheduleJob(eod, () => this.emit("endOfDay"));
            timer.scheduleJob(eod.clone().addSeconds(-15), () => this.emit("beforeEndOfDay", eod));
        }
            
        if (open) {
            timer.scheduleJob(open, () => this.emit("open"));
            timer.scheduleJob(open.clone().addSeconds(-15), () => this.emit("beforeOpen", open));
        }
            
        if (close) {
            timer.scheduleJob(close, () => this.emit("close"));
            timer.scheduleJob(close.addSeconds(-15), () => this.emit("beforeClose", close));
        }
    }
    
    get today() {
        let now = Date.create(),
            today = this.schedule[now.format("{Mon}{dd}")];

        if (today && today.end.every(end => end.isBefore(now))) {
            now.addDays(1);
            today = this.schedule[now.format("{Mon}{dd}")];
        }

        return today;
    }
    
    get tomorrow() {
        if (this.today) {
            let now = this.today.addDays(1);
            return this.schedule[now.format("{Mon}{dd}")];
        }
        else return null;
    }
    
    get next() {
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
    
    get marketsOpen() {
        let now = Date.create(), hours = this.today;
        if (hours && hours.start && hours.end) {
            for (let i = 0; i < hours.start.length; i++) {
                if (now.isBetween(hours.start[i], hours.end[i])) return true;
            }
        }
        
        return false;
    }
    
    get marketsLiquid() {
        let now = Date.create(), hours = this.today;
        if (hours && hours.open && hours.close) {
            for (let i = 0; i < hours.open.length; i++) {
                if (now.isBetween(hours.open[i], hours.close[i])) return true;
            }
        }
        
        return false;
    }
    
    get nextStartOfDay() {
        return this.next ? this.next.start.find(start => start.isFuture()) : null;
    }
    
    get nextOpen() {
        return this.next ? this.next.open.find(open => open.isFuture()) : null;
    }
    
    get nextClose() {
        return this.next ? this.next.close.find(close => close.isFuture()) : null;
    }
    
    get nextEndOfDay() {
        return this.next ? this.next.end.find(end => end.isFuture()) : null;
    }
    
}

exports.getMarket = function(primaryExch, secType, timeZoneId, tradingHours, liquidHours) {
    let hash = Array.create(arguments).join("|");
    if (markets[hash]) return markets[hash];
    else return markets[hash] = new Market(primaryExch, secType, tz[timeZoneId] || timeZoneId, tradingHours, liquidHours);
};