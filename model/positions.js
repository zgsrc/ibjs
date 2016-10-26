"use strict";

const Events = require("events");

class Positions extends Events {
    
    constructor(service) {
        super();
        
        this.service = service;
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
    
    cancel() {
        return false;
    }
    
}

module.exports = Positions;