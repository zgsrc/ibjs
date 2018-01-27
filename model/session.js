"use strict";

const Events = require("events"),
      flags = require("./flags"),
      Accounts = require("./accounting/accounts"),
      Positions = require("./accounting/positions"),
      Orders = require("./accounting/orders"),
      Trades = require("./accounting/trades"),
      Account = require("./accounting/account"),
      Curve = require("./marketdata/curve"),
      Chain = require("./marketdata/chain"),
      contract = require("./marketdata/contract");

class Session extends Events {
    
    constructor(service) {
        super();
        
        Object.defineProperty(this, 'service', { value: service });
        
        this.connectivity = { };
        this.bulletins = [ ];
        this.state = "disconnected";
        this.displayGroups = [ ];
        
        this.service.socket.once("managedAccounts", data => {
            this.managedAccounts = Array.isArray(data) ? data : [ data ];
            this.emit("ready", this);
        });
        
        this.service.socket.on("connected", () => {
            this.service.system().on("data", data => {
                if (data.orderId && this.orders) {
                    this.orders.nextOrderId = data.orderId;
                }
                else if (data.code == 321) {
                    if (!this.readOnly && data.message.indexOf("Read-Only") > 0) {
                        this.readOnly = true;
                        this.emit("connectivity", "API is in read-only mode. Orders cannot be placed.");
                    }
                }
                else if (data.code == 1100 || data.code == 2110) {
                    this.state = "disconnected";
                    this.emit("connectivity", data.message);
                }
                else if (data.code == 1101 || data.code == 1102) {
                    this.state = "connected";
                    this.emit("connectivity", data.message);
                }
                else if (data.code == 1300) {
                    this.state = "disconnected";
                    this.emit("disconnected");
                }
                else if (data.code >= 2103 && data.code <= 2106) {
                    let name = data.message.from(data.message.indexOf(" is ") + 4).trim();
                    name = name.split(":");

                    let status = name[0];
                    name = name.from(1).join(":");

                    this.connectivity[name] = { status: status, time: Date.create() };   
                    this.emit("connectivity", this.connectivity[name]);
                }
                else if (data.code >= 2107 && data.code <= 2108) {
                    let name = data.message.trim();
                    name = name.split(".");

                    let status = name[0];
                    name = name.from(1).join(".");

                    this.connectivity[name] = { status: status, time: Date.create() };   
                    this.emit("connectivity", this.connectivity[name]);
                }
                else if (data.code == 2148) {
                    this.bulletins.push(data);
                    this.emit("bulletin", data);
                }
                else {
                    this.emit("error", data);
                }
            });
            
            this.service.orderIds(1);
            
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
                    displayGroup.update = sec => {
                        if (sec.summary) this.service.updateDisplayGroup(displayGroup.id, sec.summary.conId.toString() + "@" + sec.summary.exchange);
                        else if (sec.contract) this.service.updateDisplayGroup(displayGroup.id, sec.contract.summary.conId.toString() + "@" + sec.contract.summary.exchange);
                        else if (sec) this.service.updateDisplayGroup(displayGroup.id, sec.toString());
                        else throw new Error("No security supplied.");
                    }
                    
                    displayGroup.on("data", async contract => {
                        if (contract && contract != "none") {
                            try {
                                displayGroup.security = await this.security(contract);
                                this.emit("displayGroupUpdated", displayGroup);
                            }
                            catch (ex) {
                                this.emit("error", ex);
                            }
                        }
                        else {
                            displayGroup.security = null;
                        }
                    }).send();
                });
            }).send();
            
            this.service.autoOpenOrders(true);
            Object.defineProperty(this, 'orders', { value: new Orders(this) });
            
            this.state = "connected";
            this.emit("connected", this.service.socket);
        }).on("disconnected", () => {
            this.state = "disconnected";
            this.emit("disconnected");
        });
    }
    
    async system() {
        return new Promise((yes, no) => {
            let count = 0, timer = setInterval(() => {
                if (count > 20) no(new Error("Timeout waiting for system features to load in session."));
                else if (this.displayGroups.length && Object.keys(this.connectivity).length) {
                    clearInterval(timer);
                    yes();
                }
                else {
                    count++;
                }
            }, 250);
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
    
    async account(options) {
        let account = new Account(this, options || this.managedAccounts.first());
        return new Promise((resolve, reject) => {
            let errHandler = err => reject(err);
            account.once("error", errHandler).once("load", () => {
                account.removeListener("error", errHandler);
                resolve(account);
            });
        });
    }

    async accounts(options) {
        let accounts = new Accounts(this, options);
        return new Promise((resolve, reject) => {
            let errHandler = err => reject(err);
            accounts.once("error", errHandler).once("load", () => {
                accounts.removeListener("error", errHandler);
                resolve(accounts);
            });
        });
    }
    
    async positions() {
        let positions = new Positions(this);
        return new Promise((resolve, reject) => {
            let errHandler = err => reject(err);
            positions.once("error", errHandler).once("load", () => {
                positions.removeListener("error", errHandler);
                resolve(positions);
            });
        });
    }

    async trades(options) {
        let trades = new Trades(this, options);
        return new Promise((resolve, reject) => {
            let errHandler = err => reject(err);
            trades.once("error", errHandler).once("load", () => {
                trades.removeListener("error", errHandler);
                resolve(trades);
            });
        });
    }

    async lookup(description) {
        return new Promise((resolve, reject) => {
            contract.lookup(this, description, (err, contracts) => {
                if (err) reject(err);
                else resolve(contracts);
            });
        });
    }
    
    async securities(description) {
        return new Promise((resolve, reject) => {
            contract.securities(this, description, (err, secs) => {
                if (err) reject(err);
                else resolve(secs);
            });
        });
    }
    
    async security(description) {
        return (await this.securities(description))[0];
    }
    
    async combo(description) {
        return contract.combo(this, description);
    }
    
    async curve(description) {
        return new Promise((resolve, reject) => {
            contract.securities(this, description, (err, securities) => {
                if (err) reject(err);
                else resolve(new Curve(this, secs));
            });
        });
    }
    
    async options(description) {
        return new Promise((resolve, reject) => {
            contract.securities(this, description, (err, secs) => {
                if (err) reject(err);
                else resolve(new Chain(this, secs));
            });
        });
    }
    
}

module.exports = Session;