"use strict";

require("sugar");

const flags = require("../flags"),
      MarketData = require("./marketdata"),
      Quote = require("./quote"),
      Depth = require("./depth"),
      Charts = require("./charts"),
      Order = require("./order");

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
        
        tokens.inGroupsOf(2).each(field => {
            if (field.length == 2 && field.all(a => a != null)) {
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

class Security extends MarketData {
    
    constructor(session, contract) {
        super(session, contract);
        this.quote = new Quote(session, contract);
        this.depth = new Depth(session, contract);
        this.charts = new Charts(session, contract);
    }
    
    fundamentals(type, cb) {
        this.service.fundamentalData(this.contract.summary, flags.FUNDAMENTALS_REPORTS[type])
            .on("data", data => cb(null, data))
            .on("end", () => cb(new Error("Could not load " + type + " fundamental data for " + this.contract.localSymbol + ". " + err.message)))
            .on("error", err => cb(new Error("Could not load " + type + " fundamental data for " + this.contract.localSymbol + ". " + err.message)))
            .send();
    }
    
    order() {
        return new Order(this.session, this.contract);
    }
    
    cancel() {
        if (this.quote) this.quote.cancel();
        if (this.depth) this.depth.cancel();
        if (this.charts) this.charts.cancel();
    }
    
}

function securities(session, description, cb) {
    let summary = description;
    try { summary = parse(description); }
    catch (ex) { cb(ex); return; }
    
    let list = [ ];
    session.service.contractDetails(summary)
        .on("data", contract => list.push(new Security(session, contract)))
        .on("error", err => cb(err, list))
        .on("end", () => cb(null, list))
        .send();
}

module.exports = securities;