"use strict";

const Subscription = require("./subscription"),
      constants = require("./constants");

class Order extends Subscription {
    
    constructor(session, contract, data) {
        super(session, contract);
        
        this.ticket = (data ? data.ticket : null) || { 
            tif: constants.TIME_IN_FORCE.day,
            outsideRth: true,
            totalQuantity: 1,
            action: constants.SIDE.buy,
            orderType: constants.ORDER_TYPE.market,
            transmit: false
        };
        
        this.state = data ? data.state : { };
        
        this.orderId = data ? data.orderId : null;
    }
    
    save() {
        return this.session.orders.placeOrder(this);
    }
    
    transmit() {
        this.ticket.transmit = true;
        this.save();
    }
    
    cancel() {
        this.session.orders.cancelOrder(this);
    }
    
    or(cb) {
        if (this.ocaGroup == null) {
            let group = Math.floor(Math.random * 1000000).toString();
            this.ocaGroup = group;
            this.oraType = constants.OCA_TYPE.cancel;
        }
        
        let siblingOrder = new Order(this.orders, this.contract);
        siblingOrder.ocaGroup = this.ocaGroup;
        siblingOrder.ocaType = constants.OCA_TYPE.cancel;
        
        if (cb && typeof cb == "function") {
            cb(siblingOrder);
            return this;
        }
        else {
            return siblingOrder;
        }
    }
    
    then(cb) {
        if (!this.children) {
            Object.defineProperty(this, "children", { value: [ ] });
        }
        
        let childOrder = new Order(this.orders, this.contract);
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
            this.ticket.action = qty > 0 ? constants.SIDE.buy : constants.SIDE.sell;
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
            this.ticket.action = constants.SIDE.buy;    
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
            this.ticket.action = constants.SIDE.sell;
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
        this.ticket.tif = constants.TIME_IN_FORCE.day;
        return this;
    }
    
    goodUntilCancelled() {
        this.ticket.tif = constants.TIME_IN_FORCE.goodUntilCancelled;
        return this;
    }
    
    immediateOrCancel() {
        this.ticket.tif = constants.TIME_IN_FORCE.immediateOrCancel;
        return this;
    }
    
    fillOrKill() {
        this.ticket.tif = constants.TIME_IN_FORCE.fillOrKill;
        return this;
    }
    
    atTheOpen() {
        this.ticket.tif = constants.TIME_IN_FORCE.open;
    }
    
    auction() {
        this.ticket.tif = constants.TIME_IN_FORCE.auction;
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
        this.ticket.orderType = constants.ORDER_TYPE.market;
        return this;
    }
    
    marketProtect() {
        this.ticket.orderType = constants.ORDER_TYPE.marketProtect;
        return this;
    }
    
    marketToLimit() {
        this.ticket.orderType = constants.ORDER_TYPE.marketToLimit;
        return this;
    }
    
    auction() {
        this.ticket.orderType = constants.ORDER_TYPE.marketToLimit;
        this.ticket.tif = constants.TIME_IN_FORCE.auction;
    }
    
    marketIfTouched(price) {
        this.ticket.orderType = constants.ORDER_TYPE.marketIfTouched;
        this.ticket.auxPrice = price;
        return this;
    }
    
    marketOnClose() {
        this.ticket.orderType = constants.ORDER_TYPE.marketOnClose;
        return this;
    }
    
    marketOnOpen() {
        this.ticket.orderType = constants.ORDER_TYPE.market;
        this.ticket.tif = constants.TIME_IN_FORCE.open;
        return this;
    }
    
    limit(price, discretionaryAmount) {
        this.ticket.orderType = constants.ORDER_TYPE.limit;
        this.ticket.lmtPrice = price;
        if (discretionaryAmount) {
            this.ticket.discretionaryAmt = discretionaryAmount;
        }

        return this;
    }
    
    limitIfTouched(trigger, limit) {
        this.ticket.orderType = constants.ORDER_TYPE.limitIfTouched;
        this.ticket.auxPrice = trigger;
        this.ticket.lmtPrice = limit;
        return this;
    }
    
    limitOnClose(price) {
        this.ticket.orderType = constants.ORDER_TYPE.limitOnClose;
        this.ticket.lmtPrice = price;
        return this;
    }
    
    limitOnOpen(price) {
        this.ticket.orderType = constants.ORDER_TYPE.limit;
        this.ticket.tif = constants.TIME_IN_FORCE.open;
        this.ticket.lmtPrice = price;
        return this;
    }
    
    stop(trigger) {
        this.ticket.orderType = constants.ORDER_TYPE.stop;
        this.ticket.auxPrice = trigger;
        return this;
    }
    
    stopProtect(trigger) {
        this.ticket.orderType = constants.ORDER_TYPE.stopProtect;
        this.ticket.auxPrice = trigger;
        return this;
    }
    
    stopLimit(trigger, limit) {
        this.ticket.orderType = constants.ORDER_TYPE.stopLimit;
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
    // CONDITIONS
    ////////////////////////////////////////
    overridePercentageConstraints() {
        this.ticket.overridePercentageConstraints = true;
        return this;
    }
    
    whatIf() {
        this.ticket.whatIf = true;
        return this;
    }
    
}

module.exports = Order;