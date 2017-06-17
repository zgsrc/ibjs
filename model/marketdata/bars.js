"use strict";

require("sugar");

const MarketData = require("./marketdata"),
      studies = require("./studies");

class Bars extends MarketData {
    
    constructor(session, contract, barSize) {
        super(session, contract);
        
        this.cursor = Date.create();
        this.field = "TRADES";
        this.regularTradingHours = true;
        this.dateFormat = 1;
        this.barSize = barSize;
        this.series = [ ];
    }
    
    history(cb) {
        let req = this.service.historicalData(
            this.contract, 
            this.cursor.format("{yyyy}{MM}{dd} {HH}:{mm}:{ss}") + (this.locale ? " " + this.locale : ""), 
            this.barSize.duration, 
            this.barSize.text, 
            this.field, 
            this.regularTradingHours ? 1 : 0,
            this.dateFormat
        );
        
        let length = this.series.length;
        req.on("data", record => {
            record.date = Date.create(record.date);
            record.timestamp = record.date.getTime();
            this.series.push(record);
            this.emit("update", record);
        }).on("error", err => {
            this.emit("error", err);
            if (cb) cb(err);
        }).on("end", () => {
            let newRecords = this.series.from(length).map("timestamp"),
                range = [ newRecords.min(), newRecords.max() ];
            
            this.series = this.series.unique().sortBy("timestamp");
            this.cursor = this.series.first().date;
            this.emit("load", range);
            if (cb) cb();
        }).send();
    }
    
    stream() {
        let req = this.service.realTimeBars(
            this.contract, 
            this.barSize.integer, 
            this.field, 
            this.regularTradingHours
        );
        
        req.on("data", data => {
            data.date = Date.create(data.date * 1000);
            data.timestamp = data.date.getTime();
            this.series.push(data);
            this.emit("update", data);
            this.emit("afterUpdate");
        }).on("error", (err, cancel) => {
            if (err.timeout) {
                cancel();
                this.emit("error", `${this.contract.localSymbol} ${this.barSize.text} streaming bars request timed out. (Outside market hours?)`);
            }
            else this.emit("error", err);
        }).send();
        
        this.close = () => req.cancel();
    }
    
    lookup(timestamp) { 
        let idx = this.series.findIndex(i => i.timestamp > timestamp);
        if (idx > 0) return this.series[idx - 1];
        else return null;
    }
    
    study(name, length, calculator) {
        if (Object.isString(calculator)) {
            calculator = studies[calculator];
        }
        
        for (let i = 0; i < this.series.length; i++) {
            this.series[i][name] = calculator(this.series.from(i).to(length));
        }
        
        this.on("load", timestamps => {
            let start = this.series.findIndex(i => i.timestamp <= timestamps.min()),
                end = this.series.findIndex(i => i.timestamp > timestamps.max());
            
            if (start < 0) start = 0;
            if (end < 0) end = this.series.length - 1;
            
            start.upto(end).each(i => {
                let window = this.series.from(i).to(length);
                this.series[i + length - 1][name] = calculator(window);
            });
        });
        
        this.on("update", data => {
            let window = this.series.from(-length);
            data[name] = calculator(window);
        });
    }
    
}