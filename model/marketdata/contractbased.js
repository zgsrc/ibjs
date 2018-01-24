"use strict";

const Base = require("../base");

class ContractBased extends Base {
    
    constructor(session, contract) {
        super(session);
        Object.defineProperty(this, 'contract', { value: contract });
    }
    
}

module.exports = ContractBased;