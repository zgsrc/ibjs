"use strict";

require("sugar");

const RealTime = require("../realtime");

class MarketData extends RealTime {
    
    constructor(security) {
        super(security);
        Object.defineProperty(this, 'security', { value: security });
    }
    
}

module.exports = MarketData;