"use strict";

require("sugar");

var Events = require("events"),
    Security = require("./security").Security;

class Interface extends Events {
    
    constructor(cxn) {
        super();
        
        var me = this;
        me.connection = cxn;
        me.accounts = { };
        
        cxn.summary(function(err, data, cancel) {
            if (err) {
                me.emit("error", err);
            }
            else if (data && data.length) {
                data.forEach(function(datum) {
                    if (datum.account && datum.tag) {
                        var id = datum.account;
                        if (!me.accounts[id]) {
                            me.accounts[id] = { 
                                summary: { },
                                details: { },
                                positions: { }
                            };

                            cxn.account(id, function(err, data, cancel) {
                                if (err) {
                                    me.emit("error", err);
                                }
                                else {
                                    if (data.key) {
                                        var value = data.value;
                                        if (/^\-?[0-9]+(\.[0-9]+)?$/.test(value)) value = parseFloat(value);
                                        else if (value == "true") value = true;
                                        else if (value == "false") value = false;

                                        if (data.currency && data.currency != "") {
                                            value = { currency: data.currency, value: value };
                                        }

                                        var key = data.key.camelize(false);
                                        me.accounts[id].details[key] = value;
                                        me.emit("update", { type: "details", field: key, value: value });
                                    }
                                    else if (data.timestamp) {
                                        var date = Date.create(data.timestamp);
                                        me.accounts[id].details.timestamp = date;
                                        me.emit("update", { type: "details", field: "timestamp", value: date });
                                    }
                                    else if (data.contract) {
                                        me.accounts[id].positions[data.contract.conId] = data;
                                        me.emit("update", { type: "position", field: data.contract.conId, value: data });
                                    }
                                    else {
                                        me.emit("warning", "Unrecognized account update " + JSON.stringify(data));
                                    }
                                }
                            });
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
                            me.accounts[id].summary[key] = value;
                            me.emit("update", { type: "summary", field: key, value: value });
                        }
                    }
                });
            }
            else {
                me.emit("warning", "No accounts found.");
            }
        });

        cxn.executions(function(err, data, cancel) {

        });

        cxn.orders(function(err, data, cancel) {
            if (err) console.log(err);
            else if (data) console.log(data);
        });        
    }
    
    stock(symbol, exchange, currency) {
        return new Security(this.connection, this.connection.contract.stock(symbol, exchange, currency));
    }

    option(symbol, expiry, strike, right, exchange, currency) {
        return new Security(this.connection, this.connection.contract.option(symbol, expiry, strike, right, exchange, currency));
    }

    currency(symbol, currency) {
        return new Security(this.connection, this.connection.contract.forex(symbol, currency));
    }

    future(symbol, expiry, currency, exchange) {
        return new Security(this.connection, this.connection.contract.future(symbol, expiry, currency, exchange));
    }
    
    cancelAll() {
        this.connection.globalCancel();
    }
    
}

module.exports = Interface;