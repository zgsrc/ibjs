"use strict";

const Events = require("events");

class Order extends Events {
    
    constructor(service, contract, defaults) {
        super();
        this.service = service;
        this.contract = contract;
        this.ticket = defaults || { tif: "Day" };
    }
    
    ////////////////////////////////////////
    // QUANTITY
    ////////////////////////////////////////
    trade(qty, show) {
        this.ticket.totalQuantity = Math.abs(qty);
        this.ticket.action = qty > 0 ? "BUY" : "SELL";
        
        if (show != null) {
            if (show == 0) this.hidden = true;
            this.displaySize = Math.abs(show);
        }
        
        return this;
    }
    
    buy(qty, show) {
        this.ticket.totalQuantity = qty;
        this.ticket.action = "BUY";
        
        if (show != null) {
            if (show == 0) this.hidden = true;
            this.displaySize = Math.abs(show);
        }
        
        return this;
    }
    
    sell(qty, show) {
        this.ticket.totalQuantity = qty;
        this.ticket.action = "SELL";
        
        if (show != null) {
            if (show == 0) this.hidden = true;
            this.displaySize = Math.abs(show);
        }
        
        return this;
    }
    
    show(qty) {
        if (show != null) {
            if (show == 0) this.hidden = true;
            this.displaySize = Math.abs(show);
        }

        return this;
    }
    
    ////////////////////////////////////////
    // PRICE
    ////////////////////////////////////////
    market() {
        this.ticket.type = "MKT";
        return this;
    }
    
    marketWithProtection() {
        this.ticket.type = "MKT PRT";
        return this;
    }
    
    marketThenLimit() {
        this.ticket.type = "MTL";
        return this;
    }
    
    limit(price) {
        this.ticket.type = "LMT";
        this.ticket.lmtPrice = price;
        return this;
    }
    
    stop(trigger, limit) {
        if (limit) {
            this.ticket.type = "STP LMT";
            this.ticket.auxPrice = trigger;
            this.ticket.lmtPrice = limit;
        }
        else {
            this.ticket.type = "STP";
            this.ticket.auxPrice = trigger;
        }
            
        return this;
    }
    
    stopWithProtection(trigger) {
        this.ticket.type = "STP PRT";
        this.ticket.auxPrice = trigger;
        return this;
    }
    
    ////////////////////////////////////////
    // TIMEFRAME
    ////////////////////////////////////////
    goodToday() {
        this.ticket.tif = "Day";
        return this;
    }
    
    goodUntilCancelled() {
        this.ticket.tif = "GTC";
        return this;
    }
    
    immediateOrCancel() {
        this.ticket.tif = "IOC";
        return this;
    }
    
    outsideRegularTradingHours() { 
        this.ticket.outsideRth = true; 
        return this; 
    }
    
    ////////////////////////////////////////
    // EXECUTION
    ////////////////////////////////////////
    overridePercentageConstraints() {
        this.ticket.overridePercentageConstraints = true;
        return this;
    }
    
    open() {
        let me = this, 
            nextId = this.service.nextValidId(1);
        
        nextId.on("data", id => {
            nextId.cancel();
            
            let request = this.service.placeOrder(this.contract, this.ticket);
            me.cancel = () => request.cancel();
            
            request.on("data", data => {
                Object.merge(me, data, { resolve: true });
            }).on("error", err => {
                me.error = err;
                me.emit("error", err);
            }).send();
        }).on("error", err => cb(err)).send();
    }
    
    transmit() {
        this.ticket.trasmit = true;
        this.open();
    }
    
    cancel() {
        
    }
    
}

Order.SIDE = {
    buy: "BUY",
    sell: "SELL",
    short: "SSHORT"
};

Order.ORDER_TYPE = {
    limit: "LMT",
    marketToLimit: "MTL",
    marketWithProtection: "MKT PRT",
    requestForQuote: "QUOTE",
    stop: "STP",
    stopLimit: "STP LMT",
    trailingLimitIfTouched: "TRAIL LIT",
    trailingMarketIfTouched: "TRAIL MIT",
    trailingStop: "TRAIL",
    trailingStopLimit: "TRAIL LIMIT",
    market: "MKT",
    marketIfTouched: "MIT",
    marketOnClose: "MOC",
    marketOnOpen: "MOO",
    peggedToMarket: "PEG MKT",
    relative: "REL",
    boxTop: "BOX TOP",
    limitOnClose: "LOC",
    limitOnOpen: "LOO",
    limitIfTouched: "LIT",
    peggedToMidpoint: "PEG MID",
    VWAP: "VWAP",
    goodAfter: "GAT",
    goodUntil: "GTD",
    goodUntilCancelled: "GTC",
    immediateOrCancel: "IOC",
    oneCancelsAll: "OCA",
    volatility: "VOL"
};

Order.RULE80A = { 
    individual: "I",
    agency: "A",
    agentOtherMember: "W",
    individualPTIA: "J",
    agencyPTIA: "U",
    agentOtherMemberPTIA: "M",
    individualPT: "K",
    agencyPT: "Y",
    agentOtherMemberPT: "N"
};

Order.TIME_IN_FORCE = {
    day: "DAY",
    goodUntilCancelled: "GTC",
    immediateOrCancel: "IOC",
    goodUntil: "GTD"
};

module.exports = Order;