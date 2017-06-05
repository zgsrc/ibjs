"use strict";

const RealTime = require("./realtime");

class Orders extends RealTime {
    
    constructor(service, all) {
        super(service);
        this.all = { };
    }
    
    stream(all) {
        let request = all ? this.service.allOpenOrders() : this.service.openOrders();
        
        this.cancel = () => request.cancel();
        
        let me = this;
        request.on("data", data => {
            me.all[data.orderId] = data;
        }).on("end", () => {
            me.emit("load");
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