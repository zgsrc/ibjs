"use strict";

require("sugar");

const Events = require("events");

class Bars extends Events {
    
    constructor(cxn, contract, options) {
        super();
        
        this.connection = cxn;
        this.contract = contract;
        
        options = options || { };
        
        var me = this;
        if (options.duration) {
            me.connection.historicals(me.contract, options, function(err, data) {
                if (err) me.emit("error", err);
                else {
                    me.series = data.map(function(record) {
                        record.date = Date.create(record.date);
                        record.timestamp = record.date.getTime();
                        return record;
                    }).sortBy("timestamp");
                    me.emit("load", me.series);

                    if (options.realtime) {
                        me.connection.bar(me.contract, options, function(err, data, cancel) {
                            if (cancel) me.cancelFunction = cancel;
                            if (err) me.emit("error", err);
                            else if (data) {
                                data.date = Date.create(data.date * 1000);
                                data.timestamp = data.date.getTime();
                                me.series.push(data);
                                me.emit("update", data);
                            }
                        });
                    }
                }
            });
        }
        else if (options.realtime) {
            me.series = [ ];
            me.connection.bar(me.contract, options, function(err, data, cancel) {
                if (cancel) me.cancelFunction = cancel;
                if (err) me.emit("error", err);
                else if (data) {
                    data.date = Date.create(data.date * 1000);
                    data.timestamp = data.date.getTime();
                    me.series.push(data);
                    me.emit("update", data);
                }
            });
        }
    }
    
    cancel() {
        if (this.cancelFunction && Object.isFunction(this.cancelFunction)) {
            this.cancelFunction();
            this.emit("cancelled");
        }
        
        return me;
    }
    
}

module.exports = Bars;