require("sugar");

var Quote = exports.Quote = function() {
    
    var me = this,
        events = { },
        track = 0;
    
    this.trackChanges = function(maxHistory) {
        track = maxHistory;
        return me;
    };
    
    this.on = function(event, cb) {
        if (!events[event]) events[event] = [ ];
        events[event].push(cb);
        return me;
    };
    
    this.fire = function(event, data) {
        if (events[event]) {
            events[event].map(function(cb) { cb(data); });
        }
        
        return me;
    };
    
    this.add = function(datum) {
        var key = datum.name,
            value = datum.value;

        if (key == "LAST_TIMESTAMP") {
            value = Date.create(parseInt(value) * 1000);
        }
        
        if (!key || key == "") {
            console.log("Tick key not found.");
            console.log(datum);
            return;
        }
        
        if (value === null || value === "") {
            console.log("No tick data value found.");
            console.log(datum);
            return;
        }
        
        var oldValue = me[key];
        me.fire("beforeUpdate", { key: key, newValue: value, oldValue: oldValue });
        
        me[key] = value;
        if (track) {
            if (!me.history) me.history = { };
            if (!me.history[key]) me.history[key] = [ ];
            me.history[key].push(value);
            while (track > 0 && me.history[key].length > track) {
                me.history[key].shift();
            }
        }
        else me.history = null;
        
        me.fire("afterUpdate", { key: key, newValue: value, oldValue: oldValue });
        
        return me;
    };
    
    this.error = function(err) {
        me.fire("error", err);
        return me;
    };
    
    this.setCancel = function(fn) {
        me.cancelFunction = fn;
        return me;
    };
    
    this.cancel = function() {
        if (me.cancelFunction && Object.isFunction(me.cancelFunction)) {
            me.cancelFunction();
            me.fire("cancelled");
        }
        
        return me;
    };
    
};

var Offers = exports.Offers = function() {
    
    var me = this,
        events = { },
        track = false;
    
    this.bids = { };
    
    this.offers = { };
    
    this.trackChanges = function(flag) {
        track = flag;
        return me;
    };
    
    this.on = function(event, cb) {
        if (!events[event]) events[event] = [ ];
        events[event].push(cb);
        return me;
    };
    
    this.fire = function(event, data) {
        if (events[event]) {
            events[event].map(function(cb) { cb(data); });
        }
        
        return me;
    };
    
    this.add = function(datum) {
        me.fire("beforeUpdate", datum);
        
        if (datum.side == 1) me.bids[datum.position] = datum;
        else me.offers[datum.position] = datum;
        
        me.fire("afterUpdate", datum);
        
        return me;
    };
    
    this.error = function(err) {
        me.fire("error", err);
        return me;
    };
    
    this.setCancel = function(fn) {
        me.cancelFunction = fn;
        return me;
    };
    
    this.cancel = function() {
        if (me.cancelFunction && Object.isFunction(me.cancelFunction)) {
            me.cancelFunction();
            me.fire("cancelled");
        }
        
        return me;
    };
    
};