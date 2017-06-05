"use strict";

const RealTime = require("./realtime");

class System extends RealTime {
    
    constructor(service) {
        super(service);
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
            this.emit("update", data);
        }).on("error", err => {
            this.emit("error", err);
        });
    }
    
}

module.exports = System;