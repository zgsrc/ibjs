"use strict";

require("sugar");

const MarketData = require("./marketdata"),
      studies = require("./studies");

class Bars extends MarketData {
    
    constructor(session, contract, barSize) {
        super(session, contract);
        
        this.options = {
            cursor: Date.create(),
            field: "TRADES",
            regularTradingHours: true,
            dateFormat: 1,
            barSize: barSize
        };
        
        this.series = [ ];
    }
    
    set(options) {
        this.options = Object.merge(this.options, options);
        return this;
    }
    
    history(cb) {
        let req = this.service.historicalData(
            this.contract.summary, 
            this.options.cursor.format("{yyyy}{MM}{dd} {HH}:{mm}:{ss}") + (this.locale ? " " + this.locale : ""), 
            this.options.barSize.duration, 
            this.options.barSize.text, 
            this.options.field, 
            this.options.regularTradingHours ? 1 : 0,
            this.options.dateFormat
        );
        
        let length = this.series.length;
        req.on("data", record => {
            record.date = Date.create(record.date);
            record.timestamp = record.date.getTime();
            this.series.push(record);
        }).on("error", err => {
            if (cb) cb(err);
            else this.emit("error", err);
        }).on("end", () => {
            let newRecords = this.series.from(length).map("timestamp"),
                range = [ newRecords.min(), newRecords.max() ];
            
            this.series = this.series.unique().sortBy("timestamp");
            this.options.cursor = this.series.first().date;
            
            if (cb) cb();
            else this.emit("load", range);
            
            this.emit("update", range);
        }).send();
    }
    
    stream() {
        let req = this.service.realTimeBars(
            this.contract.summary, 
            this.options.barSize.integer, 
            this.options.field, 
            this.options.regularTradingHours
        );
        
        req.on("data", data => {
            data.date = Date.create(data.date * 1000);
            data.timestamp = data.date.getTime();
            this.series.push(data);
            this.emit("update", data);
        }).on("error", (err, cancel) => {
            if (err.timeout) {
                cancel();
                this.emit("error", `${this.contract.localSymbol} ${this.options.barSize.text} streaming bars request timed out. (Outside market hours?)`);
            }
            else this.emit("error", err);
        }).send();
        
        this.close = () => req.cancel();
        return this ;
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
        
        if (calculator == null) {
            throw new Error("No study named " + name);
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

module.exports = Bars;