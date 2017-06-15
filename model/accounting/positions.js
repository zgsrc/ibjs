"use strict";

const RealTime = require("../realtime");

class Positions extends RealTime {
    
    constructor(session) {
        super(session);
    }
    
    stream(options) {
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
        
        this.cancel = () => {
            positions.cancel();
            return true;
        };
    }
    
}

module.exports = Positions;