"use strict";

const Events = require("events");

class Positions extends Events {
    
    constructor(service) {
        super();
        
        let request = service.positions();
        
        this.service = service;
        
        this.cancel = () => request.cancel();
        
        request.on("data", data => {
            
        }).on("end", () => {
            
        }).on("error", err => {
            this.emit("error", err);
        }).send();
    }
    
}

module.exports = Positions;