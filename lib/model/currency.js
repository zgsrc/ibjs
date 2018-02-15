const getSymbolFromCurrency = require('currency-symbol-map')

class Currency {
    
    constructor(currency, amount) {
        this.abbreviation = currency;
        this.amount = amount;
    }
    
    toString() {
        return getSymbolFromCurrency(this.abbreviation) + this.amount.format(2);
    }
    
}

module.exports = Currency;