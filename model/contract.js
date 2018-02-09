"use strict";

const { DateTime } = require('luxon'),
      constants = require("./constants"),
      Order = require("./order"),
      Quote = require("./marketdata/quote"),
      Depth = require("./marketdata/depth"),
      Charts = require("./marketdata/charts");

function frontMonth(cutOffDay, offset) {
    let date = Date.create();
    
    if (date.getDate() >= cutOffDay) {
        date.addMonths(1);
    }
    
    if (offset) {
        date.addMonths(offset);
    }

    return date;
}

exports.frontMonth = frontMonth;

function parse(definition) {
    if (typeof definition == "number") {
        definition = { conId: definition };
    }
    else if (typeof definition == "string") {
        if (/[0-9]+@[A-Z]+/.test(definition)) {
            definition = definition.split("@");
            definition = {
                conId: parseInt(definition[0]),
                exchange: definition[1]
            };
        }
        else {
            let tokens = definition.split(' ').map("trim").compact(true);
            definition = { };

            let date = tokens[0],
                symbol = tokens[1],
                side = tokens[2] ? tokens[2].toLowerCase() : null,
                type = constants.SECURITY_TYPE[side];

            if (type) {
                definition.secType = type;
                definition.symbol = symbol;

                if (type == "OPT") {
                    if (side.startsWith("put") || side.startsWith("call")) definition.right = side.toUpperCase();
                    else throw new Error("Must specify 'put' or 'call' for option contracts.");
                }

                if (date) {
                    if (date.toLowerCase().startsWith("front") || date.toLowerCase().startsWith("first")) {
                        date = date.from(5);
                        date = date.split('+');

                        if (date[0] == "") date[0] = "15";

                        let cutOff = parseInt(date[0]),
                            offset = date[1] ? parseInt(date[1]) : 0;

                        date = frontMonth(cutOff, offset);
                        if (type == "FUT") date.addMonths(1);
                    }
                    else {
                        let month = date.to(3),
                            year = date.from(3).trim();

                        if (year.startsWith("'") || year.startsWith("`") || year.startsWith("-") || year.startsWith("/")) year = year.from(1);

                        if (year.length == 2) year = "20" + year;
                        if (year == "") year = Date.create().fullYear();

                        try {
                            date = Date.create(month + " " + year);
                        }
                        catch (ex) {
                            throw new Error("Invalid date " + month + " " + year + " in " + definition);
                        }
                    }

                    date = date.format("{yyyy}{MM}");
                    definition.expiry = date;
                }

                tokens = tokens.from(3);
            }
            else {
                definition.symbol = tokens[0].toUpperCase();

                if (tokens[1] && constants.SECURITY_TYPE[tokens[1].toLowerCase()]) {
                    definition.secType = constants.SECURITY_TYPE[tokens[1].toLowerCase()];
                    tokens = tokens.from(2);
                }
                else tokens = tokens.from(1);
            }

            tokens.inGroupsOf(2).forEach(field => {
                if (field.length == 2 && field.every(a => a != null)) {
                    if (field[0].toLowerCase() == "in") {
                        definition.currency = field[1].toUpperCase();
                        if (constants.CURRENCIES.indexOf(definition.currency) < 0) throw new Error("Invalid currency " + definition.currency);
                    }
                    else if (field[0].toLowerCase() == "on") definition.exchange = field[1].toUpperCase();
                    else if (field[0].toLowerCase() == "at") definition.strike = parseFloat(field[1]);
                    else throw new Error("Unrecognized field " + field.join(' '));
                }
                else {
                    throw new Error("Unrecognized field " + field.join(' '));
                }
            });
        }
    }

    if (typeof definition == "object") {
        if (definition.symbol == null && definition.conId == null) {
            throw new Error("Definition must have symbol or conId.");
        }

        if (definition.conId == null) {
            if (!definition.secType && constants.CURRENCIES.indexOf(definition.symbol) >= 0) definition.secType = "CASH";
            else definition.secType = definition.secType || "STK";

            if (definition.secType == "CASH") {
                definition.exchange = "IDEALPRO";
                definition.currency = definition.symbol.from(4);
                definition.symbol = definition.symbol.to(3);
            }
            else {
                if (definition.secType == "STK" || definition.secType == "OPT") definition.exchange = definition.exchange || "SMART";
                definition.currency = definition.currency || "USD";
            }
        }
        
        return definition;
    }
    else {
        throw new Error("Unrecognized security definition '" + definition + "'");
    }
}

exports.parse = parse;

class Contract {
    
    constructor(session, data) {
        Object.defineProperty(this, "session", { value: session, enumerable: false });
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
    
    order(data) {
        return new Order(this.session, this, data);
    }
    
    quote() {
        return new Quote(this.session, this);
    }
    
    depth() {
        return new Depth(this.session, this);
    }

    charts() {
        return new Charts(this.session, this);
    }
    
    async fundamentals(type) {
        return new Promise((resolve, reject) => {
            this.session.service.fundamentalData(this.summary, constants.FUNDAMENTALS_REPORTS[type] || type)
                .once("data", data => {
                    let keys = Object.keys(data);
                    resolve(keys.length == 1 ? data[keys.first()] : data);
                })
                .once("end", () => reject(new Error("Could not load " + type + " fundamental data for " + contract.symbol + ". " + err.message)))
                .once("error", err => reject(new Error("Could not load " + type + " fundamental data for " + contract.symbol + ". " + err.message)))
                .send();
        });
    }
    
    toString() {
        return this.summary.localSymbol;
    }
    
}

exports.Contract = Contract;

async function all(session, summary) {
    let list = [ ];
    return new Promise((yes, no) => {
        session.service.contractDetails(summary)
            .on("data", contract => list.push(new Contract(session, contract)))
            .once("error", err => no(err))
            .once("end", () => yes(list))
            .send();
    }); 
}

exports.all = all;

async function first(session, summary) {
    let list = [ ];
    return new Promise((yes, no) => {
        session.service.contractDetails(summary)
            .on("data", contract => yes(new Contract(session, contract)))
            .once("error", err => no(err))
            .once("end", () => null)
            .send();
    }); 
}

exports.first = first;