"use strict";

require('sugar');

var Events = require("events"),
    Accounts = require("./accounting/accounts"),
    Positions = require("./accounting/positions"),
    Orders = require("./accounting/orders"),
    Trades = require("./accounting/trades"),
    Account = require("./accounting/account"),
    securities = require("./marketdata/security");

class Session extends Events {
    
    constructor(service) {
        super();
        
        Object.defineProperty(this, 'service', { value: service });
        
        this.connectivity = { };
        this.bulletins = [ ];
        this.state = "initializing";
        this.displayGroups = [ ];
        
        this.service.socket.once("managedAccounts", data => {
            this.managedAccounts = Array.isArray(data) ? data : [ data ];
            this.state = "ready";
            this.emit("ready", this);
        });
        
        this.service.socket.on("connected", () => {
            this.service.system().on("data", data => {
                if (data.code >= 2103 || data.code <= 2106) {
                    let name = data.message.from(data.message.indexOf(" is ") + 4).trim();
                    name = name.split(":");

                    let status = name[0];
                    name = name[1];

                    this.connectivity[name] = { status: status, time: new Date() };   
                    this.emit("connectivity", this.connectivity[name]);
                }
                else {
                    this.emit("connectivity", data);    
                }
            });
            
            this.service.newsBulletins(true).on("data", data => {
                this.bulletins.push(data);
                this.emit("bulletin", data);
            }).on("error", err => {
                this.emit("error", err);
            }).send();
            
            this.service.queryDisplayGroups().on("data", groups => {
                groups.forEach((group, index) => {
                    let displayGroup = this.service.subscribeToGroupEvents(group);
                    displayGroup.group = group;
                    displayGroup.index = index;
                    displayGroup.on("data", contract => displayGroup.contract = contract);
                    displayGroup.update = contract => this.service.updateDisplayGroup(displayGroup.id, contract);
                    
                    this.displayGroups.push(displayGroup);
                    
                    displayGroup.send();
                });
            }).send();
            
            this.emit("connected", this.service.socket);
            this.state = "connected";
        }).on("disconnected", () => {
            this.state = "disconnected";
            this.emit("disconnected");
        });
    }
    
    get clientId() {
        return this.service.socket.clientId;
    }
    
    close() {
        this.service.socket.disconnect();
    }
    
    account(options) {
        if (options && !options.id) {
            options.id = this.managedAccounts.first();
        }
        
        return new Account(this, options || this.managedAccounts.first());
    }

    accountSummary(options) {
        return new Accounts(this, options);
    }
    
    positions(options) {
        return new Positions(this, options);
    }
    
    orders(options) {
        return new Orders(this, options);
    }

    trades(options) {
        return new Trades(this, options);
    }

    securities(description, cb) {
        securities(this, description, cb);
    }
    
}

module.exports = Session;