"use strict";

require("sugar");

const async = require("async"),
      Events = require("events"),
      studies = require("./studies");

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
            this.emit("afterUpdate");
        }).on("error", (err, cancel) => {
            if (err.timeout) {
                cancel();
                this.emit("warning", `${this.security.summary.localSymbol} ${this.barSize.text} streaming bars request timed out. (Outside market hours?)`);
            }
            else this.emit("error", err);
        }).send();
        
        this.cancel = () => {
            req.cancel();
            return true;
        };
    }
    
    cancel() {
        return false;
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

class Charts extends Events {
    
    constructor(security) {
        super();
        
        this.security = security;
    
        this.ONE_SECOND = new Bars(this.security, {
            text: "1 sec",
            integer: 1,
            duration: "1800 S"
        });

        this.ONE_SECOND
            .on("error", err => this.emit("error", err))
            .on("warning", msg => this.emit("warning", msg))
            .on("update", data => this.emit("update", data));
        
        this.FIVE_SECONDS = new Bars(this.security, {
            text: "5 secs",
            integer: 5,
            duration: "3600 S"
        });
        
        this.FIVE_SECONDS
            .on("error", err => this.emit("error", err))
            .on("warning", msg => this.emit("warning", msg))
            .on("update", data => this.emit("update", data));
        
        this.TEN_SECONDS = new Bars(this.security, {
            text: "10 secs",
            integer: 10,
            duration: "7200 S"
        });
        
        this.TEN_SECONDS
            .on("error", err => this.emit("error", err))
            .on("warning", msg => this.emit("warning", msg))
            .on("update", data => this.emit("update", data));

        this.FIFTEEN_SECONDS = new Bars(this.security, {
            text: "15 secs",
            integer: 15,
            duration: "10800 S"
        });
        
        this.FIFTEEN_SECONDS
            .on("error", err => this.emit("error", err))
            .on("warning", msg => this.emit("warning", msg))
            .on("update", data => this.emit("update", data));

        this.THIRTY_SECONDS = new Bars(this.security, {
            text: "30 secs",
            integer: 30,
            duration: "1 D"
        });
        
        this.THIRTY_SECONDS
            .on("error", err => this.emit("error", err))
            .on("warning", msg => this.emit("warning", msg))
            .on("update", data => this.emit("update", data));

        this.ONE_MINUTE = new Bars(this.security, {
            text: "1 min",
            integer: 60,
            duration: "2 D"
        });
        
        this.ONE_MINUTE
            .on("error", err => this.emit("error", err))
            .on("warning", msg => this.emit("warning", msg))
            .on("update", data => this.emit("update", data));

        this.TWO_MINUTES = new Bars(this.security, {
            text: "2 mins",
            integer: 120,
            duration: "3 D"
        });
        
        this.TWO_MINUTES
            .on("error", err => this.emit("error", err))
            .on("warning", msg => this.emit("warning", msg))
            .on("update", data => this.emit("update", data));

        this.THREE_MINUTES = new Bars(this.security, {
            text: "3 mins",
            integer: 180,
            duration: "4 D"
        });
        
        this.THREE_MINUTES
            .on("error", err => this.emit("error", err))
            .on("warning", msg => this.emit("warning", msg))
            .on("update", data => this.emit("update", data));

        this.FIVE_MINUTES = new Bars(this.security, {
            text: "5 mins",
            integer: 300,
            duration: "1 W"
        });
        
        this.FIVE_MINUTES
            .on("error", err => this.emit("error", err))
            .on("warning", msg => this.emit("warning", msg))
            .on("update", data => this.emit("update", data));
        
        this.TEN_MINUTES = new Bars(this.security, {
            text: "10 mins",
            integer: 600,
            duration: "2 W"
        });
        
        this.TEN_MINUTES
            .on("error", err => this.emit("error", err))
            .on("warning", msg => this.emit("warning", msg))
            .on("update", data => this.emit("update", data));

        this.FIFTEEN_MINUTES = new Bars(this.security, {
            text: "15 mins",
            integer: 900,
            duration: "2 W"
        });
        
        this.FIFTEEN_MINUTES
            .on("error", err => this.emit("error", err))
            .on("warning", msg => this.emit("warning", msg))
            .on("update", data => this.emit("update", data));

        this.THIRTY_MINUTES = new Bars(this.security, {
            text: "30 mins",
            integer: 1800,
            duration: "1 M"
        });
        
        this.THIRTY_MINUTES
            .on("error", err => this.emit("error", err))
            .on("warning", msg => this.emit("warning", msg))
            .on("update", data => this.emit("update", data));

        this.ONE_HOUR = new Bars(this.security, {
            text: "1 hour",
            integer: 3600,
            duration: "2 M"
        });
        
        this.ONE_HOUR
            .on("error", err => this.emit("error", err))
            .on("warning", msg => this.emit("warning", msg))
            .on("update", data => this.emit("update", data));

        this.TWO_HOURS = new Bars(this.security, {
            text: "2 hour",
            integer: 7200,
            duration: "2 M"
        });
        
        this.TWO_HOURS
            .on("error", err => this.emit("error", err))
            .on("warning", msg => this.emit("warning", msg))
            .on("update", data => this.emit("update", data));

        this.FOUR_HOURS = new Bars(this.security, {
            text: "4 hour",
            integer: 14400,
            duration: "4 M"
        });
        
        this.FOUR_HOURS
            .on("error", err => this.emit("error", err))
            .on("warning", msg => this.emit("warning", msg))
            .on("update", data => this.emit("update", data));

        this.EIGHT_HOURS = new Bars(this.security, {
            text: "4 hour",
            integer: 28800,
            duration: "8 M"
        });
        
        this.EIGHT_HOURS
            .on("error", err => this.emit("error", err))
            .on("warning", msg => this.emit("warning", msg))
            .on("update", data => this.emit("update", data));

        this.ONE_DAY = new Bars(this.security, {
            text: "1 day",
            integer: 3600 * 24,
            duration: "1 Y"
        });
        
        this.ONE_DAY
            .on("error", err => this.emit("error", err))
            .on("warning", msg => this.emit("warning", msg))
            .on("update", data => this.emit("update", data));
    }
    
    cancel() {
        this.ONE_SECOND.cancel();
        this.FIVE_SECONDS.cancel();
        this.TEN_SECONDS.cancel();
        this.FIFTEEN_SECONDS.cancel();
        this.THIRTY_SECONDS.cancel();
        this.ONE_MINUTE.cancel();
        this.TWO_MINUTES.cancel();
        this.THREE_MINUTES.cancel();
        this.FIVE_MINUTES.cancel();
        this.TEN_MINUTES.cancel();
        this.FIFTEEN_MINUTES.cancel();
        this.THIRTY_MINUTES.cancel();
        this.ONE_HOUR.cancel();
        this.TWO_HOURS.cancel();
        this.FOUR_HOURS.cancel();
        this.EIGHT_HOURS.cancel();
        this.ONE_DAY.cancel();
    }
    
}

module.exports = Charts;