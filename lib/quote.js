"use strict";

require("sugar");

const Events = require("events");

function parseQuotePart(datum) {
    var key = datum.name, value = datum.value;
    
    if (!key || key == "") throw new Error("Tick key not found.");
    if (value === null || value === "") throw new Error("No tick data value found.");
    if (key == "LAST_TIMESTAMP") value = Date.create(parseInt(value) * 1000);
    
    return { key: key.camelize(true), value: value };
}

class Quote extends Events {
    
    constructor(cxn, contract) {
        super();
        
        this.connection = cxn;
        this.contract = contract;
    }
    
    refresh(cb) {
        var error = false,
            me = this;
        
        me.connection.snapshot(me.contract, function(err, data) {
            if (err) {
                error = true;
                if (cb) cb(err);
            }
            else if (!error) {
                if (data.complete) cb(null, me);
                else {
                    datum = parseQuotePart(datum);
                    me[datum.key] = datum.value;
                }
            }
        });
        
        return me;
    }
    
    stream(ticks) {
        if (!cb && Object.isFunction(ticks)) {
            cb = ticks;
            ticks = null;
        }
        
        var me = this;
        me.connection.ticker(me.contract, ticks, function(err, data, cancel) {
            if (cancel) me.cancelFunction = fn;
            if (err) me.emit("error", err);
            if (datum) {
                datum = parseQuotePart(datum);
                
                var oldValue = me[datum.key];
                me.emit("beforeUpdate", { key: datum.key, newValue: datum.value, oldValue: oldValue });
                me[datum.key] = datum.value;
                me.emit("update", { key: datum.key, newValue: datum.value, oldValue: oldValue });
            }
        });
        
        return me;
    }
    
    cancel() {
        if (this.cancelFunction && Object.isFunction(this.cancelFunction)) {
            this.cancelFunction();
            this.emit("cancelled");
        }
        
        return me;
    }
    
}

module.exports = Quote;