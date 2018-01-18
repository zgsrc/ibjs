"use strict";

class Currency {
    
    constructor(currency, amount) {
        this.abbreviation = currency;
        this.amount = amount;
    }
    
    toString() {
        return this.abbreviation + " " + this.amount.format(2);
    }
    
}

module.exports = Currency;