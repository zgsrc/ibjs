"use strict";

const Subscription = require("./subscription"),
      constants = require("./constants"),
      contract = require("./contract"),
      Curve = require("./curve"),
      OptionChain = require("./optionchain"),
      DisplayGroups = require("./displaygroups"),
      Orders = require("./orders"),
      Account = require("./accounting/account"),
      Accounts = require("./accounting/accounts"),
      Positions = require("./accounting/positions"),
      Trades = require("./accounting/trades");

class Session extends Subscription {
    
    constructor(service, options) {
        super({ service: service });
        
        this.connectivity = { };
        this.bulletins = [ ];
        this.state = "disconnected";
        
        this.service.system().on("data", data => {
            if (data.orderId) {
                if (this.orders) {
                    this.orders.nextOrderId = data.orderId;
                }
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
            else if (data.code >= 2103 && data.code <= 2106 || data.code == 2119) {
                let name = data.message.from(data.message.indexOf(" is ") + 4).trim();
                name = name.split(":");

                let status = name[0];
                name = name.from(1).join(":");

                this.connectivity[name] = { name: name, status: status, time: Date.create() };   
                this.emit("connectivity", this.connectivity[name]);
            }
            else if (data.code >= 2107 && data.code <= 2108) {
                let name = data.message.trim();
                name = name.split(".");

                let status = name[0];
                name = name.from(1).join(".");

                this.connectivity[name] = { name: name, status: status, time: Date.create() };   
                this.emit("connectivity", this.connectivity[name]);
            }
            else if (data.code == 2148) {
                this.bulletins.push(data);
                this.emit("bulletin", data);
            }
            else if (data.code >= 2000 && data.code < 3000) {
                this.emit("warning", data);
            }
            else {
                this.emit("error", data);
            }
        });
        
        this.service.socket.on("connected", () => {
            this.state = "connected";
            this.emit("connected", this.service.socket);
            
            if (options.orders) {
                this.orders = new Orders(this);
                if (this.clientId === 0 && options.orders != "local") {
                    this.service.autoOpenOrders(true);
                    this.interactiveOrders = true;
                }

                if (options.orders === true || options.orders == "stream") {
                    this.orders.stream();    
                }
            }
            
            if (options.frozen) {
                this.useFrozenMarketData = true;
            }
            
            this.subscriptions.push(this.service.newsBulletins(true).on("data", data => {
                this.bulletins.push(data);
                this.emit("bulletin", data);
            }).on("error", err => this.emit("error", err)).send());
        }).on("disconnected", () => {
            this.state = "disconnected";
            this.emit("disconnected");
        }).once("managedAccounts", data => {
            this.managedAccounts = Array.isArray(data) ? data : [ data ];
            this.emit("ready", this);
        });
    }
    
    close(exit) {
        this.service.socket.disconnect();
        if (exit) process.exit();
    }
    
    get clientId() {
        return this.service.socket._controller.options.clientId;
    }
    
    get useFrozenMarketData() {
        return this.service.lastMktDataType == constants.MARKET_DATA_TYPE.frozen;
    }
    
    set useFrozenMarketData(value) {
        this.service.mktDataType(value ? constants.MARKET_DATA_TYPE.frozen : constants.MARKET_DATA_TYPE.live);
    }
    
    async displayGroups() {
        return new Promise((yes, no) => (new DisplayGroups(this)).once("load", yes).once("error", no));
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
    
    async contract(description) {
        let summary = contract.parse(description);
        return await contract.first(this, summary);
    }
    
    async contracts(description) {
        let summary = contract.parse(description);
        return await contract.all(this, summary);
    }
    
    async combo(description) {
        let legs = await Promise.all(description.split(",").map("trim").map(async leg => {
            let ratio = parseInt(leg.to(leg.indexOf(" ")));
            leg = leg.from(leg.indexOf(" ")).trim();

            let summary = await this.contract(leg);
            if (summary) {
                summary = summary.summary;
                return {
                    symbol: summary.symbol,
                    conId: summary.conId,
                    exchange: summary.exchange,
                    ratio: Math.abs(ratio),
                    action: Math.sign(ratio) == -1 ? "SELL" : "BUY",
                    currency: summary.currency
                };
            }
            else {
                throw new Error("No contract for " + leg);
            }
        }));

        let name = legs.map("symbol").unique().join(',');
        legs.forEach(leg => delete leg.symbol);

        return new contract.Contract(this, { 
            summary: {
                symbol: name,
                secType: "BAG",
                currency: legs.first().currency,
                exchange: legs.first().exchange,
                comboLegs: legs
            }
        });
    }
    
    async curve(description) {
        return new Curve(this, this.contracts(description));
    }
    
    async optionChain(description) {
        return new OptionChain(this, this.contracts(description));
    }
    
}

module.exports = Session;