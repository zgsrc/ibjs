"use strict";

const MarketData = require("./marketdata"),
      flags = require("../flags");

class Order extends MarketData {
    
    constructor(session, contract) {
        super(session, contract);
        this.ticket = { tif: "Day" };
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
    
    stop(trigger) {
        this.ticket.type = "STP";
        this.ticket.auxPrice = trigger;
            
        return this;
    }
    
    stopLimit(trigger, limit) {
        this.ticket.type = "STP LMT";
        this.ticket.auxPrice = trigger;
        this.ticket.lmtPrice = limit;
            
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
        this.ticket.transmit = true;
        this.open();
    }
    
}

module.exports = Order;