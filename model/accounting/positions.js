"use strict";

const Base = require("../base");

class Positions extends Base {
    
    constructor(session) {
        super(session);

        this._exclude.append([ "loaded" ])
        
        let positions = this.service.positions().on("data", data => {
            if (!this[data.contract.conId]) {
                this[data.contract.conId] = { };    
            }
            
            this[data.contract.conId][data.accountName] = data;
            this.emit("update", data);
        }).on("end", cancel => {
            this.loaded = true;
            this.emit("load");
        }).on("error", err => {
            this.emit("error", err);
        }).send();
        
        this.cancel = () => positions.cancel();
    }
    
}

module.exports = Positions;