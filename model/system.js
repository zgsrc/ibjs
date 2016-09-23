"use strict";

const Events = require("events");

class System extends Events {
    
    constructor(service) {
        super();
        
        this.service = service;
        
        this.marketDataConnections = { };
        
        this.service.system().on("data", data => {
            if (data.code >= 2103 || data.code <= 2106) {
                let name = data.message.from(data.message.indexOf(" is ") + 4).trim();
                name = name.split(":");
                
                let status = name[0];
                name = name[1];
                
                this.marketDataConnections[name] = status;
                this.emit("marketDataConnectionChange", name, status);
            }
            
            this.emit("message", data);
        });
    }
    
}

module.exports = System;