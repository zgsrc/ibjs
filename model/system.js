"use strict";

const Events = require("events");

class System extends Events {
    
    constructor(service) {
        super();
        
        this.service = service;
        
        this.service.system().on("data", data => {
            this.emit("message", data);
        });
    }
    
}

module.exports = System;