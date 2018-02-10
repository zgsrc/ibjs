"use strict";

const Subscription = require("./subscription"),
      studies = require("./studies"),
      constants = require("../constants");

class Bars extends Subscription {
    
    constructor(contract, charts, barSize) {
        super(contract);

        Object.defineProperty(this, "charts", { value: charts });
        
        this.series = Array.create();
        this.barSize = barSize;
        this.options = {
            regularTradingHours: false,
            dateFormat: 1
        };
        
        charts.on("update", data => {
            let bd = barDate(barSize.text, data.date);
            if (this.series.length && this.series.last().date == bd) {
                merge(this.series.last(), data);
                this.emit("update", { contract: this.contract.summary.conId, type: "chart", field: barSize.text, value: this.series.last() });
            }
            else {
                data.synthetic = true;
                data.date = bd;
                data.timestamp = bd.getTime();
                this.series.push(data);
                this.emit("update", { contract: this.contract.summary.conId, type: "chart", field: barSize.text, value: this.series.last() });
            }
        });
    }
    
    set(options) {
        this.options = Object.merge(this.options, options);
        return this;
    }
    
    load(data) {  
        if (data && Array.isArray(data)) {
            this.series.append(data).sortBy("timestamp");
            this.options.cursor = this.series.first().date;
            this.emit("load", [ data.min("timestamp"), data.max("timestamp") ]);
        }
        
        return this;
    }
    
    async history(retry) {
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
            this.options.dateFormat,
            false
        );
        
        let length = this.series.length,
            min = Number.MAX_VALUE,
            max = Number.MIN_VALUE;
        
        return new Promise((yes, no) => {
            req.on("data", record => {
                record.date = Date.create(record.date);
                record.timestamp = record.date.getTime();

                if (min > record.timestamp) min = record.timestamp;
                if (max < record.timestamp) max = record.timestamp;

                let existing = this.series.find(r => r.timestamp == record.timestamp);
                if (existing && existing.synthetic) {
                    Object.merge(existing, record);
                    delete existing.synthetic;
                }
                else {
                    this.series.push(record);
                }
            }).once("error", err => {
                if (!retry && err.timeout) this.history(true).then(yes).catch(no);
                else no(err);
            }).once("end", () => {
                this.series = this.series.sortBy("timestamp");
                this.options.cursor = this.series.first().date;
                this.emit("load", [ min, max ]);
                yes(this);
            }).send();
        });
    }
    
    lookup(timestamp) { 
        let idx = this.series.findIndex(i => i.timestamp > timestamp);
        if (idx > 0) return this.series[idx - 1];
        else return null;
    }
    
    study(name, length, calculator, options) {
        if (typeof calculator == "string") {
            calculator = studies[calculator];
        }
        
        if (calculator == null) {
            throw new Error("No study named " + name);
        }
        
        for (let i = 0; i < this.series.length - length; i++) {
            let window = this.series.slice(i, i + length);
            this.series[i + length - 1][name] = calculator(window, name, options || { }) || this.series[i + length - 1][name];
        }
        
        this.on("load", timestamps => {
            try {
                let start = this.series.findIndex(i => i.timestamp <= timestamps.min()) - length,
                    end = this.series.findIndex(i => i.timestamp >= timestamps.max());
                
                if (start < 0) start = 0;
                if (end < 0) end = this.series.length - 1;
                
                for (let i = start; i <= end; i++) {
                    if (i + length - 1 < this.series.length) {
                        let window = this.series.slice(i, i + length);
                        this.series[i + length - 1][name] = calculator(window, name, options || { }) || this.series[i + length - 1][name];
                    }
                }
            }
            catch (ex) {
                this.emit("error", ex);
            }
        });
        
        this.on("update", data => {
            try {
                let window = this.series.from(-length);
                data[name] = calculator(window, name, options || { }) || data[name];
            }
            catch (ex) {
                this.emit("error", ex);
            }
        });
        
        return this;
    }
    
}

function barDate(size, date) {
    let now = Date.create(date),
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