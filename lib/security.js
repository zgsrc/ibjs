"use strict";

require("sugar");

var async = require("async"),
    constants = require("./constants"),
    Events = require("events"),
    Quote = require("./quote"),
    OrderBook = require("./orderbook"),
    Bars = require("./bars"),
    Order = require("./order");

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
    
    quote() {
        return new Quote(this.connection, this.contract);
    }
    
    depth() {
        return new OrderBook(this.connection, this.contract);
    }
    
    bars(options) {
        return new Bars(this.connection, this.contract, options);
    }
    
    order() {
        return new Order(this.connection, this.contract);
    }
    
}

module.exports = Security;