"use strict";

require("sugar");

const Events = require("events");

class Pricing extends Events {
    
    constructor(security) {
        super();
        
        this.security = security;
        
        security.ticker((err, ticker) => {
            if (err) this.emit("error", err);
            else this.ticker = ticker;
        });
        
        security.depth((err, book) => {
            if (err) this.emit("error", err);
            else this.depth = book;
        });
        
        security.bars((err, bars, cancel) => {
            if (err) this.emit("error", err);
            else {
                
            }
        });
    }
    
    close() {
        
    }
    
    
}