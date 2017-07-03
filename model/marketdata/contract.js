"use strict";

require("sugar").extend();

const flags = require("../flags");

function details(session, summary, cb) {
    let list = [ ];
    session.service.contractDetails(summary)
        .on("data", contract => list.push(parseContract(contract)))
        .once("error", err => cb(err, list))
        .once("end", () => cb(null, list))
        .send();
}

function parseContract(contract) {
    contract.orderTypes = contract.orderTypes.split(",").compact();
    contract.validExchanges = contract.validExchanges.split(",").compact();
    
    
    let timeZoneId = contract.timeZoneId,
        tradingHours = (contract.tradingHours || "").split(';').map(d => d.split(':')),
        liquidHours = (contract.liquidHours || "").split(';').map(d => d.split(':'));

    let schedule = { };
    tradingHours.forEach(arr => {
        let date = Date.create(arr.first()).format("{Mon}-{dd}");
        if (!schedule[date]) schedule[date] = { tz: timeZoneId };
        schedule[date].trading = arr[1];
    });

    liquidHours.forEach(arr => {
        let date = Date.create(arr.first()).format("{Mon}-{dd}");
        if (!schedule[date]) schedule[date] = { tz: timeZoneId };
        schedule[date].liquid = arr[1];
    });

    contract.tradingHours = schedule;
    delete contract.liquidHours;
    delete contract.timeZoneId;
    
    return contract;
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