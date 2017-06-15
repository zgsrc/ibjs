"use strict";

var Events = require("events"),
    Accounts = require("./accounting/accounts"),
    Positions = require("./accounting/positions"),
    Orders = require("./accounting/orders"),
    Trades = require("./accounting/trades"),
    Account = require("./accounting/account"),
    lookup = require("./marketdata");

class Session extends Events {
    
    constructor(service) {
        super();
        
        Object.defineProperty(this, 'service', { value: service });
        this.connectivity = { };
        this.bulletins = [ ];
        this.state = "initializing";
        
        this.service.socket.once("managedAccounts", data => {
            this.managedAccounts = Array.isArray(data) ? data : [ data ];
            this.state = "ready";
            this.emit("ready");
        });
        
        this.service.socket.on("connected", () => {
            this.service.system().on("data", data => {
                if (data.code >= 2103 || data.code <= 2106) {
                    let name = data.message.from(data.message.indexOf(" is ") + 4).trim();
                    name = name.split(":");

                    let status = name[0];
                    name = name[1];

                    this.connectivity[name] = { status: status, time: new Date() };   
                }
                
                this.emit("connectivity", data);
            });
            
            this.service.newsBulletins(true).on("data", data => {
                this.bulletins.push(data);
                this.emit("bulletin", data);
            }).on("error", err => {
                this.emit("error", err);
            }).send();
            
            this.emit("connected");
            this.state = "connected";
        }).on("disconnected", () => {
            this.state = "disconnected";
            this.emit("disconnected");
        });
    }
    
    close() {
        this.service.socket.disconnect();
    }
    
    accounts() {
        return new Accounts(this);
    }
    
    positions() {
        return new Positions(this);
    }
    
    orders() {
        return new Orders(this);
    }
    
    autoOpenOrders(autoBind) {
        this.service.autoOpenOrders(autoBind);
    }
    
    cancelAllOrders() {
        this.service.globalCancel();
    }

    trades() {
        return new Trades(this);
    }
    
    account(id) {
        return new Account(this, id);
    }
    
    securities(description, cb) {
        lookup(this, description, cb);
    }

}

module.exports = Session;