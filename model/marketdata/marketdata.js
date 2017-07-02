"use strict";

require("sugar").extend();

const RealTime = require("../realtime");

class MarketData extends RealTime {
    
    constructor(session, contract) {
        super(session);
        Object.defineProperty(this, 'contract', { value: contract });
    }
    
}

module.exports = MarketData;