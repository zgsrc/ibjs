"use strict";

const ContractBased = require("./contractbased"),
      flags = require("../flags");

class Order extends ContractBased {
    
    constructor(session, contract, data) {
        super(session, contract);
        
        Object.defineProperty(this, "children", { value: [ ] });
        
        this.ticket = (data ? data.ticket : null) || { 
            tif: flags.TIME_IN_FORCE.day,
            outsideRth: true,
            totalQuantity: 1,
            action: flags.SIDE.buy,
            orderType: flags.ORDER_TYPE.market,
            transmit: false
        };
        
        this.state = data ? data.state : { };
        this.orderId = data ? data.orderId : null;
    }
    
    or(cb) {
        if (this.ocaGroup == null) {
            let group = Math.floor(Math.random * 1000000).toString();
            this.ocaGroup = group;
            this.oraType = flags.OCA_TYPE.cancel;
        }
        
        let siblingOrder = new Order(this.session, this.contract);
        siblingOrder.ocaGroup = this.ocaGroup;
        siblingOrder.ocaType = flags.OCA_TYPE.cancel;
        
        if (cb && typeof cb == "function") {
            cb(siblingOrder);
            return this;
        }
        else {
            return siblingOrder;
        }
    }
    
    then(cb) {
        let childOrder = new Order(this.session, this.contract);
        childOrder.parent = this;
        this.children.push(childOrder);
        
        if (cb && typeof cb == "function") {
            cb(childOrder);
            return this;
        }
        else {
            return childOrder;
        }
    }
    
    ////////////////////////////////////////
    // QUANTITY
    ////////////////////////////////////////
    trade(qty, show) {
        if (qty != null) {
            this.ticket.totalQuantity = Math.abs(qty);
            this.ticket.action = qty > 0 ? flags.SIDE.buy : flags.SIDE.sell;
        }
        
        if (show != null) {
            if (show == 0) this.hidden = true;
            this.displaySize = Math.abs(show);
        }
        
        return this;
    }
    
    buy(qty, show) {
        if (qty != null) {
            this.ticket.totalQuantity = qty;
            this.ticket.action = flags.SIDE.buy;    
        }
        
        if (show != null) {
            if (show == 0) this.hidden = true;
            this.displaySize = Math.abs(show);
        }
        
        return this;
    }
    
    sell(qty, show) {
        if (qty != null) {
            this.ticket.totalQuantity = qty;
            this.ticket.action = flags.SIDE.sell;
        }
        
        if (show != null) {
            if (show == 0) this.hidden = true;
            this.displaySize = Math.abs(show);
        }
        
        return this;
    }
    
    show(qty) {
        if (qty != null) {
            if (qty == 0) this.hidden = true;
            this.displaySize = Math.abs(qty);
        }

        return this;
    }
    
    ////////////////////////////////////////
    // TIMEFRAME
    ////////////////////////////////////////
    goodToday() {
        this.ticket.tif = flags.TIME_IN_FORCE.day;
        return this;
    }
    
    goodUntilCancelled() {
        this.ticket.tif = flags.TIME_IN_FORCE.goodUntilCancelled;
        return this;
    }
    
    immediateOrCancel() {
        this.ticket.tif = flags.TIME_IN_FORCE.immediateOrCancel;
        return this;
    }
    
    fillOrKill() {
        this.ticket.tif = flags.TIME_IN_FORCE.fillOrKill;
        return this;
    }
    
    atTheOpen() {
        this.ticket.tif = flags.TIME_IN_FORCE.open;
    }
    
    auction() {
        this.ticket.tif = flags.TIME_IN_FORCE.auction;
    }
    
    regularTradingHours() {
        this.ticket.outsideRth = false; 
        return this; 
    }
    
    ////////////////////////////////////////
    // PRICE
    ////////////////////////////////////////
    type(orderType) {
        this.ticket.orderType = orderType;
    }
    
    market() {
        this.ticket.orderType = flags.ORDER_TYPE.market;
        return this;
    }
    
    marketProtect() {
        this.ticket.orderType = flags.ORDER_TYPE.marketProtect;
        return this;
    }
    
    marketToLimit() {
        this.ticket.orderType = flags.ORDER_TYPE.marketToLimit;
        return this;
    }
    
    auction() {
        this.ticket.orderType = flags.ORDER_TYPE.marketToLimit;
        this.ticket.tif = flags.TIME_IN_FORCE.auction;
    }
    
    marketIfTouched(price) {
        this.ticket.orderType = flags.ORDER_TYPE.marketIfTouched;
        this.ticket.auxPrice = price;
        return this;
    }
    
    marketOnClose() {
        this.ticket.orderType = flags.ORDER_TYPE.marketOnClose;
        return this;
    }
    
    marketOnOpen() {
        this.ticket.orderType = flags.ORDER_TYPE.market;
        this.ticket.tif = flags.TIME_IN_FORCE.open;
        return this;
    }
    
    limit(price, discretionaryAmount) {
        this.ticket.orderType = flags.ORDER_TYPE.limit;
        this.ticket.lmtPrice = price;
        if (discretionaryAmount) {
            this.ticket.discretionaryAmt = discretionaryAmount;
        }

        return this;
    }
    
    limitIfTouched(trigger, limit) {
        this.ticket.orderType = flags.ORDER_TYPE.limitIfTouched;
        this.ticket.auxPrice = trigger;
        this.ticket.lmtPrice = limit;
        return this;
    }
    
    limitOnClose(price) {
        this.ticket.orderType = flags.ORDER_TYPE.limitOnClose;
        this.ticket.lmtPrice = price;
        return this;
    }
    
    limitOnOpen(price) {
        this.ticket.orderType = flags.ORDER_TYPE.limit;
        this.ticket.tif = flags.TIME_IN_FORCE.open;
        this.ticket.lmtPrice = price;
        return this;
    }
    
    stop(trigger) {
        this.ticket.orderType = flags.ORDER_TYPE.stop;
        this.ticket.auxPrice = trigger;
        return this;
    }
    
    stopProtect(trigger) {
        this.ticket.orderType = flags.ORDER_TYPE.stopProtect;
        this.ticket.auxPrice = trigger;
        return this;
    }
    
    stopLimit(trigger, limit) {
        this.ticket.orderType = flags.ORDER_TYPE.stopLimit;
        this.ticket.auxPrice = trigger;
        this.ticket.lmtPrice = limit;            
        return this;
    }
    
    trail(trigger, offset) {
        this.ticket.orderType = "TRAIL";
        this.ticket.trailStopPrice = trigger;
        this.ticket.auxPrice = offset;
        return this;
    }
    
    trailPercent(trigger, pct) {
        this.ticket.orderType = "TRAIL";
        this.ticket.trailStopPrice = trigger;
        this.ticket.trailingPercent = pct;
        return this;
    }
    
    trailLimit(trigger, offset, limit) {
        this.ticket.orderType = "TRAIL LIMIT";
        this.ticket.trailStopPrice = trigger;
        this.ticket.auxPrice = offset;
        this.ticket.lmtPriceOffset = limit;
        return this;
    }
    
    trailLimitPercent(trigger, pct, limit) {
        this.ticket.orderType = "TRAIL LIMIT";
        this.ticket.trailStopPrice = trigger;
        this.ticket.trailingPercent = pct;
        this.ticket.lmtPriceOffset = limit;
        return this;
    }
    
    ////////////////////////////////////////
    // EXECUTION
    ////////////////////////////////////////
    overridePercentageConstraints() {
        this.ticket.overridePercentageConstraints = true;
        return this;
    }
    
    whatIf() {
        this.ticket.whatIf = true;
        return this;
    }
    
    save() {
        if (this.readOnly) {
            throw new Error("Cannot modify read-only trade.");
        }
        
        if (this.orderId == null) {
            this.session.orders.assign(this);
        }
        
        if (this.children.length) {
            this.children.forEach(child => {
                child.parentId = this.orderId;
                delete child.parent;
            });
        }
        
        this.service.placeOrder(this.orderId, this.contract.summary, this.ticket).send();
        return this;
    }
    
    transmit() {
        this.ticket.transmit = true;
        this.save();
        return this;
    }
    
    cancel() {
        if (!this.readOnly) this.service.cancelOrder(this.orderId);
        else throw new Error("Cannot cancel read-only trade.");
        return this;
    }
    
}

module.exports = Order;