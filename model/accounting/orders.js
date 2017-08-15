"use strict";

const RealTime = require("../realtime"),
      Order = require("../marketdata/order");

class Orders extends RealTime {
    
    constructor(session) {
        super(session);
        
        this.nextOrderId = null;
        
        this.subscription = this.service.allOpenOrders().on("data", data => {
            if (this[data.orderId] == null) {
                this[data.orderId] = new Order(session, data.contract, data);
            }
            else {
                this[data.orderId].ticket = data.ticket;
                this[data.orderId].state = data.state;
                this[data.orderId].emit("update");
            }
            
            this.emit("update", data);
        }).on("end", () => this.emit("load")).on("error", err => this.emit("error", err));
        
        this.cancel = () => subscription.cancel();
    }
    
    stream() {
        this.subscription.send();
    }
    
    add(order) {
        if (order.orderId == null) {
            order.orderId = this.nextOrderId;
            this[order.orderId] = order;
        }
    }
    
    cancelAllOrders() {
        this.service.globalCancel();
    }
    
}

module.exports = Orders;