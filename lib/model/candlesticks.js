const Subscription = require("./subscription"),
      constants = require("../constants");

Date.getLocale('en').addFormat('{yyyy}{MM}{dd}  {hh}:{mm}:{ss}');

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

class Candlesticks extends Subscription {
    
    constructor(contract, field) {
        super(contract);
        Object.defineProperty(this, 'field', { value: field || constants.HISTORICAL.trades, enumerable: false });
        
        return new Proxy(this, {
            get: function(obj, prop) {
                if (obj[prop]) {
                    return obj[prop];
                }
                else {
                    if (constants.BAR_SIZES[prop]) return obj[prop] = { last: { }, count: 0 };
                    else return undefined;
                }
            }
        });
    }
    
    get periods() {
        return Object.keys(this).filter(key => constants.BAR_SIZES[key]);
    }
    
    async stream(retry) {
        this.service.headTimestamp(this.contract.summary, this.field, 0, 1).once("data", data => {
            this.earliestDataTimestamp = Date.create(data);
        }).send();
        
        return new Promise((yes, no) => {
            let req = this.service.realTimeBars(this.contract.summary, 5, this.field, false);
            this.subscriptions.push(req);
            this.count = 0;
            this.last = { };
            
            let errHandler = err => {
                if (!retry && err.timeout) {
                    this.stream(true).then(yes).catch(no);
                }
                else {
                    this.streaming = false;
                    no(err);
                }
            }
            
            req.once("error", errHandler).once("data", () => {
                req.removeListener("error", errHandler);
                req.on("error", err => {
                    this.streaming = false;
                    this.emit("error", `Real time streaming bars request for ${this.contract.summary.localSymbol} timed out.`);
                });
                
                this.streaming = true;
                yes(this);
            }).on("data", data => {
                data.date = Date.create(data.date * 1000);
                data.timestamp = data.date.getTime();
                
                if (this["5 secs"]) {
                    Object.assign(this["5 secs"].last, data);
                    this["5 secs"].count++;
                }
                
                this.periods.forEach(period => {
                    if (period == "5 secs") {
                        return;
                    }
                    
                    let bd = barDate(constants.BAR_SIZE[period].text, data.date);
                    if (this.series.length && this.series.last().date == bd) {
                        merge(this[period].last, data);
                    }
                    else {
                        data.synthetic = true;
                        data.date = bd;
                        data.timestamp = bd.getTime();
                        Object.assign(this[period].last, data);
                        this[period].count++;
                    }
                });
                
                this.emit("update", { contract: this.contract.summary.conId, type: "chart", field: "realtime", value: data });
            }).send();
        });
    }
    
}

module.exports = Candlesticks;