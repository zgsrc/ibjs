"use strict";

const Events = require("events"),
      Accounts = require("./accounting/accounts"),
      Positions = require("./accounting/positions"),
      Orders = require("./accounting/orders"),
      Trades = require("./accounting/trades"),
      Account = require("./accounting/account"),
      Curve = require("./marketdata/curve"),
      Chain = require("./marketdata/chain"),
      contract = require("./marketdata/contract"),
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

                    this.connectivity[name] = { status: status, time: Date.create() };   
                    this.emit("connectivity", this.connectivity[name]);
                }
                else {
                    this.emit("error", data);    
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
                    this.displayGroups.push(displayGroup);
                    
                    displayGroup.group = group;
                    displayGroup.index = index;
                    displayGroup.update = contract => this.service.updateDisplayGroup(displayGroup.id, contract);
                    
                    displayGroup.on("data", contract => {
                        displayGroup.contract = contract;
                        this.emit("displayGroupUpdated", displayGroup);
                    }).send();
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
    
    get frozen() {
        return this.service.lastMktDataType == flags.MARKET_DATA_TYPE.frozen;
    }
    
    set frozen(value) {
        this.service.mktDataType(value ? flags.MARKET_DATA_TYPE.frozen : flags.MARKET_DATA_TYPE.live);
    }
    
    close(exit) {
        this.service.socket.disconnect();
        if (exit) process.exit();
    }
    
    account(options) {
        if (options === true) options = { };
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

    details(description, cb) {
        contract.lookup(this, description, cb);
    }
    
    securities(description, cb) {
        securities(this, description, cb);
    }
    
    curve(description, cb) {
        securities(this, description, (err, securities) => {
            if (err) cb(err);
            else cb(null, new Curve(this, securities));
        });
    }
    
    chain(description, cb) {
        securities(this, description, (err, securities) => {
            if (err) cb(err);
            else cb(null, new Chain(this, securities));
        });
    }
    
}

module.exports = Session;