"use strict";

const RealTime = require("./realtime");

class Positions extends RealTime {
    
    constructor(service) {
        super(service);
        this.accounts = { };
    }
    
    stream() {
        let request = this.service.positions();
        
        this.cancel = () => {
            request.cancel();
            return true;
        }
        
        request.on("data", data => {
            if (!this.accounts[data.account]) {
                this.accounts[data.account] = { };    
            }
            
            this.accounts[data.account][data.contract.conId] = data;
            this.emit("update", data);
        }).on("end", cancel => {
            this.emit("load");
        }).on("error", err => {
            this.emit("error", err);
        }).send();
    }
    
}

module.exports = Positions;