"use strict";

const Events = require("events");

class Positions extends Events {
    
    constructor(service) {
        super();
        
        let request = service.positions();
        
        this.service = service;
        
        this.cancel = () => request.cancel();
        
        this.accounts = { };
        
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