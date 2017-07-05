"use strict";

require("sugar").extend();

const flags = require("../flags"),
      RealTime = require("../realtime");

function details(session, summary, cb) {
    let list = [ ];
    session.service.contractDetails(summary)
        .on("data", contract => list.push(new Contract(session, contract)))
        .once("error", err => cb(err, list))
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
        
        this.orderTypes = this.orderTypes.split(",").compact();
        this.validExchanges = this.validExchanges.split(",").compact();

        let timeZoneId = this.timeZoneId,
            tradingHours = (this.tradingHours || "").split(';').map(d => d.split(':')),
            liquidHours = (this.liquidHours || "").split(';').map(d => d.split(':'));

        let schedule = { };
        tradingHours.forEach(arr => {
            if (arr[1] == "CLOSED") return;
            
            let date = Date.create(arr[0], { future: true }),
                times = arr[1].split('-').map(t => t.to(2) + ":" + t.from(2));

            let start = Date.create(date.format("{Month} {dd}, {yyyy}") + " " + times[0] + ":00 " + timeZoneId, { future: true }),
                end = Date.create(date.format("{Month} {dd}, {yyyy}") + " " + times[1] + ":00 " + timeZoneId, { future: true });

            if (end.isBefore(start)) start.addDays(-1);

            let label = date.format("{Mon}{dd}");
            if (!schedule[label]) schedule[label] = { };
            schedule[label].start = start;
            schedule[label].end = end;
        });

        liquidHours.forEach(arr => {
            if (arr[1] == "CLOSED") return;
            
            let date = Date.create(arr[0], { future: true }),
                times = arr[1].split('-').map(t => t.to(2) + ":" + t.from(2));

            let start = Date.create(date.format("{Month} {dd}, {yyyy}") + " " + times[0] + ":00 " + timeZoneId, { future: true }),
                end = Date.create(date.format("{Month} {dd}, {yyyy}") + " " + times[1] + ":00 " + timeZoneId, { future: true });

            if (end.isBefore(start)) start.addDays(-1);

            let label = date.format("{Mon}{dd}");
            if (!schedule[label]) schedule[label] = { };
            schedule[label].open = start;
            schedule[label].close = end;
        });

        Object.defineProperty(schedule, 'today', {
            get: function() {
                let now = Date.create();
                return schedule[now.format("{Mon}{dd}")];
            }
        });
        
        Object.defineProperty(schedule, 'tomorrow', {
            get: function() {
                let now = Date.create("tomorrow");
                return schedule[now.format("{Mon}{dd}")];
            }
        });
        
        Object.defineProperty(this, 'schedule', { value: schedule });
        
        delete this.tradingHours;
        delete this.liquidHours;
    }
    
    get marketsOpen() {
        let now = Date.create(), hours = this.schedule.today;
        return (hours && hours.start && hours.end) && now.isBetween(hours.start, hours.end);
    }
    
    get marketsLiquid() {
        let now = Date.create(), hours = this.schedule.today;
        return (hours && hours.start && hours.end) && now.isBetween(hours.open, hours.close);
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

function parse(definition) {
    if (Object.isNumber(definition)) {
        definition = { conId: definition };
    }
    else if (Object.isString(definition)) {
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
                let month = date.to(3),
                    year = date.from(3).trim();

                if (year.startsWith("'") || year.startsWith("`") || year.startsWith("-") || year.startsWith("/")) year = year.from(1);
                if (year.length == 2) year = "20" + year;
                if (year == "") year = Date.create().fullYear();

                date = Date.create(month + " " + year).format("{yyyy}{MM}");
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
            else throw new Error("Unrecognized field " + field.join(' '));
        });
    }

    if (Object.isObject(definition)) {
        if (definition.symbol == null && definition.conId == null) {
            throw new Error("Definition must have symbol or conId.");
        }

        if (definition.conId == null) {
            if (!definition.secType && flags.CURRENCIES.indexOf(definition.symbol) >= 0) definition.secType = "CASH";
            else definition.secType = definition.secType || "STK";

            if (definition.secType == "CASH") definition.exchange = "IDEALPRO";
            else if (definition.secType == "STK" || definition.secType == "OPT") definition.exchange = definition.exchange || "SMART";

            definition.currency = definition.currency || "USD";
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