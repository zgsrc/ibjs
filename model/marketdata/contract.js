"use strict";

const flags = require("../flags"),
      RealTime = require("../realtime");

function details(session, summary, cb) {
    let list = [ ];
    session.service.contractDetails(summary)
        .on("data", contract => list.push(new Contract(session, contract)))
        .once("error", err => cb(err, list.sortBy("contract.expiry")))
        .once("end", () => cb(null, list))
        .send();
}

class Contract extends RealTime {
    
    constructor(session, data) {
        super(session);
        this.merge(data);
    } 
    
    merge(data) {
        Object.merge(this, data);
        
        this.symbol = this.summary.localSymbol.compact().parameterize().underscore().toUpperCase();
        this.orderTypes = this.orderTypes.split(",").compact();
        this.validExchanges = this.validExchanges.split(",").compact();

        if (this.summary.expiry) {
            this.expiry = Date.create(Date.create(this.summary.expiry).format("{Month} {dd}, {yyyy}") + " 00:00:00 " + this.timeZoneId);
        }
        
        let timeZoneId = this.timeZoneId,
            tradingHours = (this.tradingHours || "").split(';').compact(true).map(d => d.split(':')),
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
                let start = Date.create(date.format("{Month} {dd}, {yyyy}") + " " + time[0] + ":00 " + timeZoneId, { future: true }),
                    end = Date.create(date.format("{Month} {dd}, {yyyy}") + " " + time[1] + ":00 " + timeZoneId, { future: true });

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
                let start = Date.create(date.format("{Month} {dd}, {yyyy}") + " " + time[0] + ":00 " + timeZoneId, { future: true }),
                    end = Date.create(date.format("{Month} {dd}, {yyyy}") + " " + time[1] + ":00 " + timeZoneId, { future: true });

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
    
    get nextOpen() {
        if (this.marketsOpen) return Date.create();
        else return this.schedule.next.start.find(start => start.isFuture());
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
    
    refresh(cb) {
        this.session.service.contractDetails(this.summary)
            .once("data", contract => merge(data))
            .once("error", err => cb(err, list))
            .once("end", () => cb(null, list))
            .send();
    } 
    
}

exports.details = details;

let frontMonth = exports.frontMonth = function(cutOffDay, offset) {
    let date = Date.create();
    
    if (date.getDate() >= cutOffDay) {
        date.addMonths(1);
    }
    
    if (offset) {
        date.addMonths(offset);
    }

    return date;
};

function parse(definition) {
    if (typeof definition == "number") {
        definition = { conId: definition };
    }
    else if (typeof definition == "string") {
        let tokens = definition.split(' ').map("trim").compact(true);
        definition = { };
        
        let date = tokens[0],
            symbol = tokens[1],
            side = tokens[2] ? tokens[2].toLowerCase() : null,
            type = flags.SECURITY_TYPE[side];
        
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

                    date = Date.create(month + " " + year);
                }
                
                date = date.format("{yyyy}{MM}");
                definition.expiry = date;
            }

            tokens = tokens.from(3);
        }
        else {
            definition.symbol = tokens[0].toUpperCase();
            
            if (tokens[1] && flags.SECURITY_TYPE[tokens[1].toLowerCase()]) {
                definition.secType = flags.SECURITY_TYPE[tokens[1].toLowerCase()];
                tokens = tokens.from(2);
            }
            else tokens = tokens.from(1);
        }
        
        tokens.inGroupsOf(2).forEach(field => {
            if (field.length == 2 && field.every(a => a != null)) {
                if (field[0].toLowerCase() == "in") {
                    definition.currency = field[1].toUpperCase();
                    if (flags.CURRENCIES.indexOf(definition.currency) < 0) throw new Error("Invalid currency " + definition.currency);
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

    if (typeof definition == "object") {
        if (definition.symbol == null && definition.conId == null) {
            throw new Error("Definition must have symbol or conId.");
        }

        if (definition.conId == null) {
            if (!definition.secType && flags.CURRENCIES.indexOf(definition.symbol) >= 0) definition.secType = "CASH";
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

function lookup(session, description, cb) {
    let summary = description;
    try { summary = parse(description); }
    catch (ex) { cb(ex); return; }
    
    details(session, summary, cb);
}

exports.lookup = lookup;