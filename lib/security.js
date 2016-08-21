require("sugar");

var async = require("async");

var quote = require("./quote"),
    Quote = quote.Quote,
    Offers = quote.Offers,
    Order = require("./order").Order,
    constants = require("./constants");

var Security = exports.Security = function(cxn, contract) {
    
    var me = this;
    
    this.connection = function() {
        return cxn;
    };
    
    this.contract = function() {
        return contract;
    };
    
    this.details = function(cb) {
        cxn.details(contract, cb);
        return me;
    };
    
    this.report = function(type, cb) {
        cxn.fundamentals(contract, type, cb);        
        return me;
    };
    
    this.fundamentals = function(cb) {
        var results = { };
        async.forEachSeries(Object.values(constants.REPORT), function(type, cb) {
            cxn.fundamentals(contract, type, function(err, data) {
                if (data) {
                    results[type] = data;
                }
                
                cb();
            });
        }, function(err) {
            cb(err, results);
        });
        
        return me;
    };
    
    this.chart = function(options, cb) {
        /*
        endTime = Date.create(), duration = "1 D", timeframe = "5 mins", regularTradingHours = false
        field = "TRADES", dateFormat = 1, locale = IB.TIME_ZONE, realtime = false
        */
        
        if (!cb && Object.isFunction(options)) {
            cb = options;
            options = { };
        }
        else options = options || { };
        
        if (options.duration) {
            cxn.historicals(contract, options, function(err, data) {
                if (err) cb(err);
                else {
                    data = data.map(function(record) {
                        record.date = Date.create(record.date);
                        record.timestamp = record.date.getTime();
                        return record;
                    }).sortBy("timestamp");

                    cb(null, data);

                    if (options.realtime) {
                        cxn.bar(contract, options, function(err, data, cancel) {
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
            cxn.bar(contract, options, function(err, data, cancel) {
                if (data) {
                    data.date = Date.create(data.date * 1000);
                    data.timestamp = data.date.getTime();
                }

                cb(err, data, cancel);
            });
        }   
        
        return me;
    };
    
    this.quote = function(cb) {
        var result = new Quote(),
            error = false;
        
        cxn.snapshot(contract, function(err, data) {
            if (err) {
                error = true;
                cb(err);
            }
            else if (!error) {
                if (data.complete) cb(null, result);
                else result.add(data);
            }
        });
        
        return me;
    };
    
    this.ticker = function(ticks, cb) {
        if (!cb && Object.isFunction(ticks)) {
            cb = ticks;
            ticks = null;
        }
        
        var result = new Quote();
        cxn.ticker(contract, ticks, function(err, data, cancel) {
            if (cancel) result.setCancel(cancel);
            if (err) result.error(err);
            if (data) result.add(data);
            
            if (cb) {
                cb(err, result);
                cb = null;
            }
        });
        
        return me;
    };
    
    this.offers = function(exchange, cb) {
        var copy = Object.clone(contract);
        copy.exchange = exchange;
        
        var result = new Offers();
        cxn.marketDepth(copy, function(err, data, cancel) {
            if (cancel) result.setCancel(cancel);
            if (err) result.error(err);
            if (data) result.add(data);
        });
        
        cb(null, result);
        return me;
    };
    
};