"use strict";

const RealTime = require("../realtime");

class Positions extends RealTime {
    
    constructor(session, options) {
        super(session);

        let positions = this.service.positions().on("data", data => {
            if (!this[data.contract.conId]) {
                this[data.contract.conId] = { };    
            }
            
            this[data.contract.conId][data.accountName] = data;
            this.emit("update", data);
        }).on("end", cancel => {
            this.emit("load");
        }).on("error", err => {
            this.emit("error", err);
        }).send();
        
        this.close = () => positions.cancel();
    }
    
}

module.exports = Positions;