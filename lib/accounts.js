require("sugar");

var Order = require("./order").Order;

var Accounts = exports.Accounts = function(cxn) {
    
    var me = this,
        events = { };
    
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
    
    this.newOrder = function(contract) {
        return new Order(contract);
    };
    
    this.cancelAll = function() {
        cxn.globalCancel();
        return me;
    };
    
    me.accounts = { };
    cxn.managedAccounts(function(err, data, unsubscribe) {
        me.ids = data;
        if (!Array.isArray(me.ids)) {
            me.ids = [ me.ids ];
        }
        
        me.ids.forEach(function(id) {
            cxn.account(id, function(err, data, cancel) {
                if (err) {
                    console.log(err);
                }
                else {
                    if (!me.accounts[id]) {
                        me.accounts[id] = { };
                    }
                    
                    if (data.key) {
                        var value = data.value;
                        if (/^\-?[0-9]+(\.[0-9]+)?$/.test(value)) value = parseFloat(value);
                        else if (value == "true") value = true;
                        else if (value == "false") value = false;
                        
                        if (data.currency && data.currency != "") {
                            value = { currency: data.currency, value: value };
                        }
                        
                        var key = data.key.camelize(false);
                        me.accounts[id][key] = value;
                        me.fire("account", { accounts: me.accounts, account: id, key: key, value: value });
                    }
                    else if (data.timestamp) {
                        me.accounts[id].timestamp = Date.create(data.timestamp);
                        me.fire("account", { accounts: me.accounts, account: id, key: "timestamp", value: me.accounts[id].timestamp });
                    }
                }
            });
            
            cxn.executions(id, null, null, null, null, null, null, function(err, data, cancel) {
                me.fire("executions");
            });
        });
    });
    
    me.summary = { };
    cxn.summary(function(err, data, cancel) {
        if (err) console.log(err);
        else {
            data.forEach(function(datum) {
                if (datum.account && datum.tag) {
                    if (!me.summary[datum.account]) {
                        me.summary[datum.account] = { };
                    }
                    
                    if (datum.tag) {
                        var value = datum.value;
                        if (/^\-?[0-9]+(\.[0-9]+)?$/.test(value)) value = parseFloat(value);
                        else if (value == "true") value = true;
                        else if (value == "false") value = false;
                        
                        if (datum.currency && datum.currency != "") {
                            value = { currency: datum.currency, value: value };
                        }
                        
                        var key = datum.tag.camelize(false);
                        me.summary[datum.account][key] = value;
                        me.fire("summary", { summary: me.summary, account: datum.account, key: key, value: value });
                    }
                }
            });
        }
    });
    
    me.positions = { };
    cxn.positions(function(err, data, cancel) {
        me.fire("position");
    });

    me.orders = { };
    cxn.orders(function(err, data, cancel) {
        me.fire("order");
    });
    
};