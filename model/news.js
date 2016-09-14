"use strict";

const Events = require("events");

class News extends Events {
    
    constructor(service, flags) {
        super();
        
        this.service = service;
        
        let req = this.services.news(flags);
        this.cancel = () => req.cancel();
        
        req.on("data", data => {
            console.log(data);
        }).on("error", err => {
            this.emit("error", err);
        });
    }
    
}