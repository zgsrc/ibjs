const getSymbolFromCurrency = require('currency-symbol-map')

class Currency {
    
    constructor(currency, amount) {
        this.abbreviation = currency;
        this.amount = amount;
    }
    
    get formatted() {
        return getSymbolFromCurrency(this.abbreviation) + this.amount.format(2);
    }
    
    toString() {
        return this.formatted;
    }
    
}

module.exports = Currency;