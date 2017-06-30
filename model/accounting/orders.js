"use strict";

const RealTime = require("../realtime");

class Orders extends RealTime {
    
    constructor(session, options) {
        super(session);

        if (options == null) {
            options = { all: true };
        }
        
        if (options.autoOpen) {
            this.service.autoOpenOrders(options.autoOpen ? true : false);
        }
        
        let orders = options.all ? this.service.allOpenOrders() : this.service.openOrders();
        this.cancel = () => orders.cancel();
        
        orders.on("data", data => {
            this[data.orderId] = data;
        }).on("end", () => {
            this.emit("load");
        }).on("error", err => {
            this.emit("error", err);
        }).send();
    }
    
    cancelAllOrders() {
        this.service.globalCancel();
    }
    
}

module.exports = Orders;