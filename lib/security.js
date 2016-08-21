"use strict";

require("sugar");

var async = require("async"),
    Events = require("events"),
    quote = require("./quote"),
    Quote = quote.Quote,
    Offers = quote.Offers,
    Order = require("./order").Order,
    constants = require("./constants");

class Security extends Events {
    
    constructor(cxn, contract) {
        super();
        
        var me = this;
        me.connection = cxn;
        me.contract = contract;
    }
    
    details(cb) {
        this.connection.details(this.contract, cb);
    }
    
    report(type, cb) {
        this.connection.fundamentals(this.contract, type, cb);        
    }
    
    fundamentals(cb) {
        var results = { },
            me = this;
        
        async.forEachSeries(Object.values(constants.REPORT), function(type, cb) {
            me.connection.fundamentals(me.contract, type, function(err, data) {
                if (data) {
                    results[type] = data;
                }
                
                cb();
            });
        }, function(err) {
            cb(err, results);
        });
    }
    
    quote(cb) {
        var result = new Quote(),
            error = false;
        
        this.connection.snapshot(this.contract, function(err, data) {
            if (err) {
                error = true;
                cb(err);
            }
            else if (!error) {
                if (data.complete) cb(null, result);
                else result.add(data);
            }
        });
    }
    
    chart(options, cb) {
        /*
        endTime = Date.create(), duration = "1 D", timeframe = "5 mins", regularTradingHours = false
        field = "TRADES", dateFormat = 1, locale = IB.TIME_ZONE, realtime = false
        */
        
        if (!cb && Object.isFunction(options)) {
            cb = options;
            options = { };
        }
        else options = options || { };
        
        var me = this;
        if (options.duration) {
            me.connection.historicals(me.contract, options, function(err, data) {
                if (err) cb(err);
                else {
                    data = data.map(function(record) {
                        record.date = Date.create(record.date);
                        record.timestamp = record.date.getTime();
                        return record;
                    }).sortBy("timestamp");

                    cb(null, data);

                    if (options.realtime) {
                        me.connection.bar(me.contract, options, function(err, data, cancel) {
                            if (data) {
                                data.date = Date.create(data.date * 1000);
                                data.timestamp = data.date.getTime();
                            }

                            cb(err, data, cancel);
                        });
                    }
                }
            });
        }
        else if (options.realtime) {
            me.connection.bar(me.contract, options, function(err, data, cancel) {
                if (data) {
                    data.date = Date.create(data.date * 1000);
                    data.timestamp = data.date.getTime();
                }

                cb(err, data, cancel);
            });
        }
    }
    
    ticker(ticks, cb) {
        if (!cb && Object.isFunction(ticks)) {
            cb = ticks;
            ticks = null;
        }
        
        var result = new Quote();
        this.connection.ticker(contract, ticks, function(err, data, cancel) {
            if (cancel) result.setCancel(cancel);
            if (err) result.error(err);
            if (data) result.add(data);
            
            if (cb) {
                cb(err, result);
                cb = null;
            }
        });
    }
    
    offers(exchange, cb) {
        var copy = Object.clone(this.contract);
        copy.exchange = exchange;
        
        var result = new Offers();
        this.connection.marketDepth(copy, function(err, data, cancel) {
            if (cancel) result.setCancel(cancel);
            if (err) result.error(err);
            if (data) result.add(data);
        });
        
        cb(null, result);
    }
    
    order() {
        return new Order(this.connection, this.contract);
    }
    
    trade(qty, limit, cb) {
        var order = this.order().quantity(qty);
        if (limit && cb && Object.isFunction(cb)) {
            order.type("LMT").limitPrice(limit).execute(cb);
        }
        else {
            if (cb == null) cb == limit;
            order.type("MKT").execute(cb);
        }
    }
    
    buy(qty, limit, cb) {
        this.trade(qty, limit, cb);
    }
    
    sell(qty, limit, cb) {
        this.trade(-qty, limit, cb);
    }
    
}

module.exports = Security;