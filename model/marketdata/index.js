"use strict";

require("sugar");

const RealTime = require("../realtime"),
      Fundamentals = require("./fundamentals"),
      Quote = require("./quote"),
      OrderBook = require("./orderbook"),
      Charts = require("./charts"),
      flags = require("../flags");

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
                if (side.startsWith("put") || side.startsWith("call")) {
                    definition.right = side.toUpperCase();
                }
                else {
                    throw new Error("Must specify 'put' or 'call' for option contracts.");
                }
            }
            
            if (date) {
                let month = date.to(3),
                    year = date.from(3).trim();

                if (year.startsWith("'") || year.startsWith("`") || year.startsWith("-") || year.startsWith("/")) {
                    year = year.from(1);
                }
                
                if (year.length == 2) {
                    year = "20" + year;
                }
                
                if (year == "") {
                    year = Date.create().fullYear();
                }

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
            else {
                tokens = tokens.from(1);
            }
            
        }
        
        tokens.inGroupsOf(2).each(field => {
            if (field.length == 2 && field.all(a => a != null)) {
                if (field[0].toLowerCase() == "in") {
                    definition.currency = field[1].toUpperCase();
                    if (flags.CURRENCIES.indexOf(definition.currency) < 0) {
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
        if (definition.symbol == null && definition.conId == null) {
            throw new Error("Definition must have symbol or conId.");
        }

        if (definition.conId == null) {
            if (!definition.secType && flags.CURRENCIES.indexOf(definition.symbol) >= 0) {
                definition.secType = "CASH";
            }
            else {
                definition.secType = definition.secType || "STK";
            }

            if (definition.secType == "CASH") {
                definition.exchange = "IDEALPRO";
            }
            else if (definition.secType == "STK" || definition.secType == "OPT") {
                definition.exchange = definition.exchange || "SMART";
            }

            definition.currency = definition.currency || "USD";
        }
        
        return definition;
    }
    else {
        throw new Error("Unrecognized security definition '" + definition + "'");
    }
}

class Security extends RealTime {
    
    constructor(session, contract) {
        super(session);
        Object.defineProperty(this, 'contract', { value: contract });
        
        if (this.contract.secType == "STOCK") {
            this.fundamentals = new Fundamentals(this);
        }
        
        this.quote = new Quote(this);
        this.level2 = new OrderBook(this);
        this.charts = new Charts(this);
    }
    
    load(options, cb) {
        let errors = [ ],
            errorHandler = err => {
                if (this.loaded) this.emit("error", err);
                else errors.push(err);
            };
        
        if (options.fundamentals && this.fundamentals) {
            this.fundamentals.on("error", errorHandler).on("warning", msg => this.emit("warning", msg));
        }   
        
        if (options.quote) {
            this.quote.on("error", errorHandler).on("warning", msg => this.emit("warning", msg));
        }
        
        if (options.level2) {
            this.level2.on("error", errorHandler).on("warning", msg => this.emit("warning", msg));
        }
        
        if (options.charts) {
            this.charts.on("error", errorHandler).on("warning", msg => this.emit("warning", msg));
        }

        async.series([
            cb => {
                if (this.fundamentals) {
                    if (options.fundamentals == "all") this.fundamentals.loadAll(cb);
                    else if (Array.isArray(options.fundamentals)) this.fundamentals.loadSome(options.fundamentals, cb);
                    else if (Object.isString(options.fundamentals)) this.fundamentals.load(options.fundamentals, cb);
                    else cb();
                }
                else cb();
            },
            cb => {
                if (this.quote) {
                    if (Array.isArray(options.quote)) this.quote.fields = options.quote;
                    this.quote.refresh(cb);
                    if (options.quote != "snapshot") this.quote.stream();
                }
                else cb();
            },
            cb => {
                if (this.level2) {
                    if (options.level2.markets == "all") this.level2.streamAllValidExchanges(options.level2.rows || 10);
                    else this.level2.stream(options.level2.markets, options.level2.rows || 10);
                    this.level2.once("load", cb);
                }
                else cb();
            },
            cb => {
                if (this.charts) {
                    let sizes = Object.keys(options.charts).filter(k => options.charts[k]);
                    async.forEachSeries(sizes, (size, cb) => {
                        let periods = options.charts[k];
                        this.charts[size].history(err => {
                            if (!err && periods > 1) {
                                async.forEach(
                                    (1).upto(periods).exclude(1), 
                                    (i, cb) => this.charts[size].history(cb), 
                                    cb
                                );
                            }
                            else cb(err);
                        });
                        
                        this.charts[size].stream();
                    }, cb);
                }
                else cb();
            }
        ], err => {
            this.loaded = true;
            if (err) {
                err = new Error("Errors encountered during " + this.name + " symbol load.");
                err.errors = errors;
            }
            
            this.emit("load", err);
            if (cb) cb(err);
        });
    }
    
    close() {
        if (this.fundamentals) this.fundamentals.close();
        if (this.quote) this.quote.close();
        if (this.depth) this.depth.close();
        if (this.charts) this.charts.close();
    }
    
}

function contracts(session, description, cb) {
    let summary = description;
    try { summary = parse(description); }
    catch (ex) { cb(ex); return; }

    console.log(description + " = " + JSON.stringify(summary));
    
    let list = [ ];
    session.service.contractDetails(summary).on("data", contract => {
        list.push(new Security(session, contract));
    }).on("error", err => cb(err, list)).on("end", () => cb(null, list)).send();
}

module.exports = contracts;