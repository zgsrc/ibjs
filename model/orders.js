"use strict";

const Events = require("events");

class Orders extends Events {
    
    constructor(service, all) {
        super();
        
        let request = all ? service.allOpenOrders() : service.openOrders();
        
        this.service = service;
        
        this.cancel = () => request.cancel();
        
        this.all = { };
        
        let me = this;
        request.on("data", data => {
            me.all[data.orderId] = data;
        }).on("end", () => {
            me.emit("updated");
        }).on("error", err => {
            me.emit("error", err);
        }).send();
    }
    
    autoOpenOrders(autoBind) {
        this.service.autoOpenOrders(autoBind);
    }
    
    cancelAllOrders() {
        this.service.globalCancel();
    }
    
}

module.exports = Orders;