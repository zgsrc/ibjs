"use strict";

const Events = require("events");

class System extends Events {
    
    constructor(service) {
        super();
        
        this.service = service;
        
        this.marketDataConnections = { };
    }
    
    stream() {
        this.service.system().on("data", data => {
            if (data.code >= 2103 || data.code <= 2106) {
                let name = data.message.from(data.message.indexOf(" is ") + 4).trim();
                name = name.split(":");
                
                let status = name[0];
                name = name[1];
                
                this.marketDataConnections[name] = status;
                this.emit("marketDataConnectionChange", name, status);
            }
            
            this.emit("update", data);
        });
        
        let req = this.service.newsBulletins(true);
        this.cancel = () => {
            req.cancel();
            return true;
        };
        
        req.on("data", data => {
            console.log(data);
            this.emit("update", data);
        }).on("error", err => {
            this.emit("error", err);
        });
    }
    
    cancel() {
        return false;
    }
    
}

module.exports = System;