"use strict";

const MarketData = require("./marketdata"),
      Bars = require("./bars"),
      flags = require("../flags"),
      fs = require('fs'),
      Sugar = require("sugar");

Sugar.Date.getLocale('en').addFormat('{yyyy}{MM}{dd}  {hh}:{mm}:{ss}');

class Charts extends MarketData {
    
    constructor(session, contract, field) {
        
        super(session, contract);
        
        Object.defineProperty(this, 'field', { value: field });
        
        this.setMaxListeners(50);
        
        this.series = [ ];
        
        this.seconds = {
            five: new Bars(session, contract, this, {
                text: "5 secs",
                integer: 5,
                duration: "3600 S"
            }).on("error", err => this.emit("error", err)),
            ten: new Bars(session, contract, this, {
                text: "10 secs",
                integer: 10,
                duration: "7200 S"
            }).on("error", err => this.emit("error", err)),
            fifteen: new Bars(session, contract, this, {
                text: "15 secs",
                integer: 15,
                duration: "10800 S"
            }).on("error", err => this.emit("error", err)),
            thirty: new Bars(session, contract, this, {
                text: "30 secs",
                integer: 30,
                duration: "1 D"
            }).on("error", err => this.emit("error", err))
        };
        
        this.minutes = { 
            one: new Bars(session, contract, this, {
                text: "1 min",
                integer: 60,
                duration: "2 D"
            }).on("error", err => this.emit("error", err)),
            two: new Bars(session, contract, this, {
                text: "2 mins",
                integer: 120,
                duration: "3 D"
            }).on("error", err => this.emit("error", err)),
            three: new Bars(session, contract, this, {
                text: "3 mins",
                integer: 180,
                duration: "4 D"
            }).on("error", err => this.emit("error", err)),
            five:  new Bars(session, contract, this, {
                text: "5 mins",
                integer: 300,
                duration: "1 W"
            }).on("error", err => this.emit("error", err)),
            ten: new Bars(session, contract, this, {
                text: "10 mins",
                integer: 600,
                duration: "2 W"
            }).on("error", err => this.emit("error", err)),
            fifteen: new Bars(session, contract, this, {
                text: "15 mins",
                integer: 900,
                duration: "2 W"
            }).on("error", err => this.emit("error", err)),
            twenty: new Bars(session, contract, this, {
                text: "20 mins",
                integer: 1200,
                duration: "3 W"
            }).on("error", err => this.emit("error", err)),
            thirty: new Bars(session, contract, this, {
                text: "30 mins",
                integer: 1800,
                duration: "1 M"
            }).on("error", err => this.emit("error", err))
        };
        
        this.hours = {
            one: new Bars(session, contract, this, {
                text: "1 hour",
                integer: 3600,
                duration: "2 M"
            }).on("error", err => this.emit("error", err)),
            two: new Bars(session, contract, this, {
                text: "2 hour",
                integer: 7200,
                duration: "2 M"
            }).on("error", err => this.emit("error", err)),
            three: new Bars(session, contract, this, {
                text: "3 hour",
                integer: 10800,
                duration: "3 M"
            }).on("error", err => this.emit("error", err)),
            four: new Bars(session, contract, this, {
                text: "4 hour",
                integer: 14400,
                duration: "4 M"
            }).on("error", err => this.emit("error", err)),
            eight: new Bars(session, contract, this, {
                text: "4 hour",
                integer: 28800,
                duration: "8 M"
            }).on("error", err => this.emit("error", err))
        };

        this.daily = new Bars(session, contract, this, {
            text: "1 day",
            integer: 3600 * 24,
            duration: "1 Y"
        }).on("error", err => this.emit("error", err));
        
        this.weekly = new Bars(session, contract, this, {
            text: "1 week",
            integer: 3600 * 24 * 7,
            duration: "2 Y"
        }).on("error", err => this.emit("error", err));
        
        this.monthly = new Bars(session, contract, this, {
            text: "1 month",
            integer: 3600 * 24 * 7 * 30,
            duration: "5 Y" 
        }).on("error", err => this.emit("error", err));
    }
    
    get all() {
        return Sugar.Object.values(this.seconds)
                     .append(Sugar.Object.values(this.minutes))
                     .append(Sugar.Object.values(this.hours))
                     .append(this.daily)
                     .append(this.weekly)
                     .append(this.monthly);
    }
    
    each(cb) {
        Sugar.Object.values(this.seconds).forEach(cb);
        Sugar.Object.values(this.minutes).forEach(cb);
        Sugar.Object.values(this.hours).forEach(cb);
        cb(this.daily);
        cb(this.weekly);
        cb(this.monthly);
        return this;
    }
    
    stream(retry) {
        this.service.headTimestamp(this.contract.summary, this.field, 0, 1).once("data", data => {
            this.earliestDataTimestamp = Sugar.Date.create(data);
        }).send();
        
        let req = this.service.realTimeBars(this.contract.summary, 5, this.field, false).on("data", data => {
            data.date = Sugar.Date.create(data.date * 1000);
            data.timestamp = data.date.getTime();
            this.series.push(data);
            this.emit("update", data);
        }).on("error", (err, cancel) => {
            if (err.timeout) {
                cancel();
                
                if (retry) {
                    this.emit("error", `Real time streaming bars request for ${this.contract.summary.localSymbol} timed out.`);    
                }
                else {
                    this.stream(true);
                }
            }
            else this.emit("error", err);
        }).send();
        
        this.cancel = () => req.cancel();
        
        return this;
    }
    
    load(path) {
        let txt = fs.readFileSync(path),
            data = JSON.parse(txt.toString()),
            charts = security.charts.all();

        data.forEach((series, i) => {
            charts[i].load(series);
        });
    }

    store(path) {
        let data = this.all().map(bars => bars.series.exclude(b => b.synthetic));
        fs.writeFileSync(path, JSON.stringify(data));
    }
    
}

module.exports = Charts;