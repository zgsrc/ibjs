"use strict";

require("sugar");

const async = require("async"),
      Events = require("events");

class Bars extends Events {
    
    constructor(security, barSize) {
        super();
        
        this.security = security;
        
        this.cursor = Date.create();
        this.field = "TRADES";
        this.regularTradingHours = true;
        this.dateFormat = 1;
        
        this.barSize = barSize;
        
        this.series = [ ];
    }
    
    load(periods, cb) {
        if (cb == null && Object.isFunction(periods)) {
            cb = periods;
            periods = 1;
        }
        
        this.history(err => {
            if (!err) this.stream();
            
            if (periods > 1) {
                async.forEach((1).upto(periods).exclude(1), (i, cb) => this.history(cb), err => cb ? cb(err) : null);
            }
            else if (cb) {
                cb(err);
            }
        });
    }
    
    history(cb) {
        let req = this.security.service.historicalData(
            this.security.summary, 
            this.cursor.format("{yyyy}{MM}{dd} {HH}:{mm}:{ss}") + (this.locale ? " " + this.locale : ""), 
            this.barSize.duration, 
            this.barSize.text, 
            this.field, 
            this.regularTradingHours ? 1 : 0,
            this.dateFormat
        );
        
        req.on("data", record => {
            record.date = Date.create(record.date);
            record.timestamp = record.date.getTime();
            this.series.push(record);
            this.emit("update", record);
        }).on("error", err => {
            this.emit("error", err);
            if (cb) cb(err);
        }).on("end", () => {
            this.series = this.series.unique().sortBy("timestamp");
            this.cursor = this.series.first().date;
            this.emit("load");
            if (cb) cb();
        }).send();
    }
    
    stream() {
        let req = this.security.service.realTimeBars(
            this.security.summary, 
            this.barSize.integer, 
            this.field, 
            this.regularTradingHours
        );
        
        req.on("data", data => {
            data.date = Date.create(data.date * 1000);
            data.timestamp = data.date.getTime();
            this.series.push(data);
            this.emit("update", data);
        }).on("error", (err, cancel) => {
            if (err.timeout) {
                cancel();
                this.emit("warning", `${this.security.summary.localSymbol} ${this.barSize.text} streaming bars request timed out. (Outside market hours?)`);
            }
            else this.emit("error", err);
        }).send();
        
        this.cancel = () => {
            req.cancel();
        };
    }
    
    cancel() {
        
    }
    
}

class BarSizes {
    
    constructor(security) {
        this.security = security;
    }
    
    ONE_SECOND() { 
        return new Bars(this.security, {
            text: "1 sec",
            integer: 1,
            duration: "1800 S"
        });
    }
    
    FIVE_SECONDS() { 
        return new Bars(this.security, {
            text: "5 secs",
            integer: 5,
            duration: "3600 S"
        })
    }
            
    FIFTEEN_SECONDS() { 
        return new Bars(this.security, {
            text: "15 secs",
            integer: 15,
            duration: "10800 S"
        })
    }
            
    THIRTY_SECONDS() { 
        return new Bars(this.security, {
            text: "30 secs",
            integer: 30,
            duration: "1 D"
        })
    }
            
    ONE_MINUTE() { 
        return new Bars(this.security, {
            text: "1 min",
            integer: 60,
            duration: "2 D"
        })
    }
            
    TWO_MINUTES() { 
        return new Bars(this.security, {
            text: "2 mins",
            integer: 120,
            duration: "3 D"
        })
    }
            
    THREE_MINUTES() { 
        return new Bars(this.security, {
            text: "3 mins",
            integer: 180,
            duration: "4 D"
        })
    }
            
    FIVE_MINUTES() { 
        return new Bars(this.security, {
            text: "5 mins",
            integer: 300,
            duration: "1 W"
        })
    }
            
    FIFTEEN_MINUTES()  { 
        return new Bars(this.security, {
            text: "15 mins",
            integer: 900,
            duration: "2 W"
        })
    }
            
    THIRTY_MINUTES() { 
        return new Bars(this.security, {
            text: "30 mins",
            integer: 1800,
            duration: "1 M"
        })
    }
            
    ONE_HOUR() { 
        return new Bars(this.security, {
            text: "1 hour",
            integer: 3600,
            duration: "2 M"
        })
    }
            
    TWO_HOURS() { 
        return new Bars(this.security, {
            text: "2 hour",
            integer: 7200,
            duration: "2 M"
        })
    }
            
    FOUR_HOURS() { 
        return new Bars(this.security, {
            text: "4 hour",
            integer: 14400,
            duration: "4 M"
        })
    }
            
    EIGHT_HOURS() { 
        return new Bars(this.security, {
            text: "4 hour",
            integer: 28800,
            duration: "8 M"
        })
    }
            
    ONE_DAY() { 
        return new Bars(this.security, {
            text: "1 day",
            integer: 3600 * 24,
            duration: "1 Y"
        })
    }
    
}


module.exports = BarSizes;