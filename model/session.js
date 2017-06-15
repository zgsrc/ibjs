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
        
        this.service = service;
        this.connectivity = { };
        this.state = "initializing";
        
        this.service.socket.on("connected", () => {
            let handler = data => {
                if (data.code >= 2103 || data.code <= 2106) {
                    let name = data.message.from(data.message.indexOf(" is ") + 4).trim();
                    name = name.split(":");

                    let status = name[0];
                    name = name[1];

                    this.connectivity[name] = status;   
                }
                
                this.emit("system", data);
            };
            
            let system = this.service.system().on("data", handler).send(),
                bulletins = this.service.newsBulletins(true).on("data", data => this.emit("system", data)).on("error", err => this.emit("error", err)).send();
            
            this.cancel = () => {
                system.off("data", handler);
                bulletins.cancel();
                return true;
            };
            
            this.emit("connected");
            this.state = "connected";
            
            this.service.managedAccounts().once("data", data => {
                this.managedAccounts = data;
                this.state = "ready";
                this.emit("ready");
            }).once("error", err => {                
                this.state = "bad";
                this.emit("error", err.timeout ? new Error("IB API unresponsive. Try restarting IB software and reconnecting.") : err);
            });
            
        }).on("disconnected", () => {
            this.state = "disconnected";
            this.emit("disconnected");
        });
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