"use strict";

const Base = require("../base"),
      Order = require("../marketdata/order");

class Orders extends Base {
    
    constructor(session) {
        super(session);
        
        this.nextOrderId = null;
        
        this._subscription = this.service.allOpenOrders().on("data", data => {
            let id = data.orderId;
            if (id == 0) {
                if (data.state) id = data.state.permId;
                if (data.ticket) id = data.ticket.permId;
                id = id + "_readonly";
            }
            
            if (this[id] == null) {
                this[id] = new Order(session, data.contract, data);
            }
            else {
                if (data.ticket) this[id].ticket = data.ticket;
                Object.merge(this[id].state, data.state);
                this[id].emit("update");
            }
            
            if (data.orderId == 0) {
                this[id].readOnly = true;
            }
            
            this.emit("update", data);
        }).on("end", () => {
            this.loaded = true;
            this.emit("load");
        }).on("error", err => {
            this.emit("error", err);
        });
        
        this._exclude.push("_subscription");
        
        this.cancel = () => subscription.cancel();
    }
    
    stream() {
        this._subscription.send();
        return this;
    }
    
    assign(order) {
        if (order.orderId == null) {
            order.orderId = this.nextOrderId;
            this[order.orderId] = order;
        }
    }
    
    cancel() {
        this._subscription.cancel();
    }
    
    cancelAllOrders() {
        this.service.globalCancel();
    }
    
}

module.exports = Orders;