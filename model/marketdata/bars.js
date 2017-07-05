"use strict";

const MarketData = require("./marketdata"),
      studies = require("./studies"),
      flags = require("../flags"),
      fs = require("fs");

class Bars extends MarketData {
    
    constructor(session, contract, charts, barSize) {
        super(session, contract);

        this.series = [ ];
        this.charts = charts;
        this.barSize = barSize;
        this.options = {
            regularTradingHours: false,
            dateFormat: 1
        };
        
        charts.on("update", data => {
            let bd = barDate(barSize.text, data.date);
            if (this.series.length && this.series.last().date == bd) {
                merge(this.series.last(), data);
            }
            else {
                data.data = bd;
                data.timestamp = bd.getTime();
                this.series.push(data);
            }
            
            this.emit("update", this.series.last());
        });
    }
    
    set(options) {
        this.options = Object.merge(this.options, options);
        return this;
    }
    
    history(cb, retry) {
        if (this.options.cursor == null && this.series.length) {
            this.options.cursor = this.series.first().date;
        }
        
        let req = this.service.historicalData(
            this.contract.summary, 
            this.options.cursor ? this.options.cursor.format("{yyyy}{MM}{dd} {HH}:{mm}:{ss}") + (this.locale ? " " + this.locale : "") : "", 
            this.barSize.duration, 
            this.barSize.text, 
            this.charts.field, 
            this.options.regularTradingHours ? 1 : 0,
            this.options.dateFormat
        );
        
        let length = this.series.length;
        req.on("data", record => {
            record.date = Date.create(record.date);
            record.timestamp = record.date.getTime();
            this.series.push(record);
        }).once("error", err => {
            if (!retry && err.timeout) {
                this.history(cb, true);
            }
            else {
                if (cb) cb(err);
                else this.emit("error", err);
            }
        }).once("end", () => {
            let newRecords = this.series.from(length).map("timestamp"),
                range = [ newRecords.min(), newRecords.max() ];
            
            this.series = this.series.unique().sortBy("timestamp");
            this.options.cursor = this.series.first().date;
            
            if (cb) cb();
            this.emit("load", range);
        }).send();
        
        return this;
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
            if (i + length - 1 < this.series.length) {
                this.series[i + length - 1][name] = calculator(this.series.from(i).to(length));
            }
        }
        
        this.on("load", timestamps => {
            try {
                let start = this.series.findIndex(i => i.timestamp <= timestamps.min()),
                    end = this.series.findIndex(i => i.timestamp > timestamps.max());

                if (start < 0) start = 0;
                if (end < 0) end = this.series.length - 1;

                start.upto(end).forEach(i => {
                    let window = this.series.from(i).to(length);
                    this.series[i + length - 1][name] = calculator(window);
                });
            }
            catch (ex) {
                this.emit("error", ex);
            }
        });
        
        this.on("update", data => {
            try {
                let window = this.series.from(-length);
                data[name] = calculator(window);
            }
            catch (ex) {
                this.emit("error", ex);
            }
        });
        
        return this;
    }
}

function barDate(size, date) {
    let now = new Date(date),
        count = parseInt(size.split(' ').first());

    if (size.endsWith("day")) now = now.beginningOfDay();
    else if (size.endsWith("week")) now = now.beginningOfWeek();
    else if (size.endsWith("month")) now = now.beginningOfMonth();
    else if (size.endsWith("hour")) {
        let hours = now.getHours();
        let whole = Math.floor(hours / count);
        let current= whole * count;

        now.set({ hours: current }, true);
    }
    else if (size.endsWith("mins")) {
        let minutes = now.getMinutes();
        let whole = Math.floor(minutes / count);
        let current= whole * count;

        now.set({ minutes: current }, true);
    }
    else if (size.endsWith("secs")) {
        let seconds = now.getSeconds();
        let whole = Math.floor(seconds / count);
        let current= whole * count;

        now.set({ seconds: current }, true);
    }

    return now;
}

function merge(oldBar, newBar) {
    oldBar.high = Math.max(oldBar.high, newBar.high);
    oldBar.low = Math.min(oldBar.low, newBar.low);
    oldBar.close = newBar.close;
    oldBar.volume += newBar.volume;
}

module.exports = Bars;