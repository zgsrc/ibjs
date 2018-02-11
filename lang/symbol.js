"use strict";

const constants = require("../constants"),
      contract = require("../model/contract");

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

function contract(definition) {
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
            if (constants.wellKnownSymbols[definition.trim().toUpperCase()]) {
                definition = constants.wellKnownSymbols[definition.trim().toUpperCase()];
            }
            
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

exports.contract = contract;

async function order(service, script) {
    if (script && Object.isString(script) && script.length) {
        let tokens = script.toUpperCase().split(" ").map("trim").compact(true);
        
        let action = tokens.shift().toLowerCase(),
            qty = parseInt(tokens.shift()),
            unit = tokens.shift();
        
        if (unit != "SHARE" && unit != "SHARES" && unit != "CONTRACT" && unit != "CONTRACTS") {
            tokens.unshift(unit);
        }
        
        let symbol = tokens.to(tokens.lastIndexOf("AT")),
            summary = contract(symbol.join(" ")),
            order = await contract.first(service, summary).order();
        
        tokens = tokens.from(symbol.length);
        
        if (tokens.length == 0) return order;
        else {
            let price = tokens.shift();

            if (price == "THE") price = tokens.shift();

            if (price == "MARKET") {
                price = tokens.shift();

                if (price == "ON") {
                    price = tokens.shift();
                    if (price == "THE") price = tokens.shift();
                    if (price == "OPEN") order.marketOnOpen();
                    else if (price == "CLOSE") order.marketOnClose();
                }
                else if (price == "WHEN") {
                    price = tokens.shift();
                    if (!price[0].test(/[0-9]/)) price = price.from(1);
                    price = parseFloat(price);

                    // stop of if-touched order depending on position and price
                }
                else {
                    order.market();
                    tokens.unshift(price);
                }
            }
            else if (price == "MARKET-PROTECT") order.marketProtect();
            else if (price == "MARKET-TO-LIMIT") order.marketToLimit();
            else {
                if (!price[0].test(/[0-9]/)) price = price.from(1);
                let limit = parseFloat(price);

                price = tokens.shift();

                if (price == "ON") {
                    price = tokens.shift();
                    if (price == "THE") price = tokens.shift();
                    if (price == "OPEN") order.limitOnOpen(limit);
                    else if (price == "CLOSE") order.limitOnClose(limit);
                }
                else if (price == "WHEN") {
                    price = tokens.shift();
                    if (!price[0].test(/[0-9]/)) price = price.from(1);
                    price = parseFloat(price);

                    // stop of if-touched order depending on position and price
                }
                else {
                    order.limit(price);
                    tokens.unshift(price);
                }
            }
        }
        
        return order;
    }
}

exports.order = order;