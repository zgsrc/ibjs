"use strict";

const CURRENCIES = [
    'KRW', 'EUR', 'GBP', 'AUD',
    'USD', 'TRY', 'ZAR', 'CAD', 
    'CHF', 'MXN', 'HKD', 'JPY', 
    'INR', 'NOK', 'SEK', 'RUB'
];

const SECURITY_TYPE = {
    stock: "STK",
    equity: "STK",
    option: "OPT",
    put: "OPT",
    puts: "OPT",
    call: "OPT",
    calls: "OPT",
    future: "FUT",
    futures: "FUT",
    index: "IND",
    forward: "FOP",
    forwards: "FOP",
    cash: "CASH",
    bag: "BAG",
    news: "NEWS"
};

function parse(definition) {
    
    if (Object.isString(definition)) {
        let tokens = definition.split(' ').map("trim").compact(true);
        definition = { };
        
        let date = tokens[0],
            symbol = tokens[1],
            side = tokens[2] ? tokens[2].toLowerCase() : null,
            type = SECURITY_TYPE[side];
        
        if (type) {
            if (type == "OPT") {
                if (side.startsWith("put") || side.startsWith("call")) {
                    definition.right = side.toUpperCase();
                }
                else {
                    throw new Error("Must specify 'put' or 'call' for option contracts.");
                }
            }
            
            definition.secType = type;
            definition.expiry = date;
            definition.symbol = symbol;
            
            tokens = tokens.from(3);
        }
        else {
            definition.symbol = tokens[0].toUpperCase();
            
            if (tokens[1]) {
                definition.type = SECURITY_TYPE[tokens[1].toLowerCase()];
            }
            
            tokens = tokens.from(2);
        }
        
        tokens.inGroupsOf(2).each(field => {
            if (field.length == 2 && field.all(a => a != null)) {
                if (field[0].toLowerCase() == "in") {
                    definition.currency = field[1].toUppercase();
                    if (CURRENCIES.indexOf(definition.currency) < 0) {
                        throw new Error("Invalid currency " + definition.currency);
                    }
                }
                else if (field[0].toLowerCase() == "on") {
                    definition.exchange = field[1].toUpperCase();
                }
                else if (field[0].toLowerCase() == "at") {
                    definition.strike = parseFloat(field[1]);
                }
                else {
                    throw new Error("Unrecognized field " + field.join(' '));
                }
            }
            else {
                throw new Error("Unrecognized field " + field.join(' '));
            }
        });
    }

    if (Object.isObject(definition)) {
        if (definition.symbol == null) 
            cb(new Error("Definition must have symbol."));

        definition.secType = definition.secType || "STK";
        definition.currency = definition.currency || "USD";
        definition.exchange = definition.exchange || "SMART";

        if (definition.secType == "CASH") {
            definition.exchange = "IDEALPRO";
        }
        
        return definition;
    }
    else {
        throw new Error("Unrecognized security definition '" + definition + "'");
    }
}        

module.exports = parse;