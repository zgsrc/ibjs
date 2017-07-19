"use strict";

const MarketData = require("./marketdata"),
      flags = require("../flags"),
      TICKS = flags.QUOTE_TICK_TYPES,
      Sugar = require("sugar");

Sugar.Date.getLocale('en').addFormat('{yyyy}{MM}{dd}-{hh}:{mm}:{ss}');

class Quote extends MarketData {
    
    constructor(session, contract) {
        super(session, contract);
        this._fieldTypes = Sugar.Array.create();
        this._exclude.push("_fieldTypes");
    }
    
    addFieldTypes(fieldTypes) {
        if (fieldTypes) {
            this._fieldTypes.append(fieldTypes);
        }
        
        return this;
    }

    ticks() {
        this._fieldTypes.append(TICKS.realTimeVolume);
        return this;
    }
    
    stats() {
        this._fieldTypes.append([ TICKS.tradeCount, TICKS.tradeRate, TICKS.volumeRate, TICKS.priceRange ]);
        return this;
    }
    
    fundamentals() {
        this._fieldTypes.append(TICKS.fundamentalRatios);
        return this;
    }
    
    volatility() {
        this._fieldTypes.append([ TICKS.historicalVolatility, TICKS.optionImpliedVolatility ]);
        return this;
    }
    
    options() {
        this._fieldTypes.append([ TICKS.optionVolume, TICKS.optionOpenInterest ]);
        return this;
    }
    
    futures() {
        this._fieldTypes.append(TICKS.futuresOpenInterest);
        return this;
    }
    
    short() {
        this._fieldTypes.append(TICKS.shortable);
        return this;
    }
    
    news() {
        this._fieldTypes.append(TICKS.news);
        return this;
    }
    
    query(cb) {
        let state = { };
        this.session.service.mktData(this.contract.summary, this._fieldTypes.join(","), true, false)
            .on("data", datum => {
                datum = parseQuotePart(datum);
                this[datum.key] = state[datum.key] = datum.value;
            }).on("error", (err, cancel) => {
                cb(err, state);
                cb = null;
                cancel();
            }).on("end", cancel => {
                cb(null, state);
                cb = null;
                cancel();
            }).send();
        
        return this;
    }
    
    stream() {
        let req = this.session.service.mktData(this.contract.summary, this._fieldTypes.join(","), false, false);
        
        this.cancel = () => req.cancel();
        
        req.on("data", datum  => {
            datum = parseQuotePart(datum);

            let oldValue = this[datum.key];
            this[datum.key] = datum.value;
            this.emit("update", { key: datum.key, newValue: datum.value, oldValue: oldValue });
        }).on("error", err => {
            this.emit("error", err);
        }).on("end", () => {
            this.emit("load");
        }).send();
        
        return this;
    }
    
    get snapshot() {
        return Sugar.Object.select(this, this.fields);
    }
    
    tickBuffer(duration) {
        return new FieldBuffer(this, duration || 5000, "rtVolume");
    }
    
    newsBuffer(duration) {
        return new FieldBuffer(this, duration || 60000 * 60, "newsTick");
    }
    
}

function parseQuotePart(datum) {
    let key = Sugar.String(datum.name), value = datum.value;
    
    if (!key || key == "") throw new Error("Tick key not found.");
    if (value === null || value === "") throw new Error("No tick data value found.");
    
    if (key == "LAST_TIMESTAMP") {
        value = Sugar.Date.create(parseInt(value) * 1000);
    }
    else if (key == "RT_VOLUME") {
        value = value.split(";");
        value = {
            price: parseFloat(value[0]),
            size: parseInt(value[1]),
            time: Sugar.Date.create(parseInt(value[2])),
            volume: parseInt(value[3]),
            vwap: parseFloat(value[4]),
            marketMaker: value[5] == "true" ? true : false
        };
    }
    else if (key == "FUNDAMENTAL_RATIOS") {
        let ratios = { };
        value.split(";").forEach(r => {
            let parts = r.split("=");
            if (parts[0].trim().length > 0) {
                ratios[parts[0]] = parseFloat(parts[1]);
            }
        });
        
        value = ratios;
    }
    else if (key == "NEWS_TICK") {
        value = Sugar.String(value).split(" ");
        value = {
            id: value[0],
            time: value[1],
            source: value[2],
            text: value.from(3).join(' ')
        };
    }
    
    return { key: key.camelize(false), value: value };
}

class FieldBuffer extends MarketData {
    
    constructor(quote, duration, field) {
        super(quote.session, quote.contract);
        
        this.duration = duration;
        this.history = [ ];
        
        if (quote[field]) {
            this.history.push(quote[field]);
        }
        
        quote.on("update", data => {
            if (data.key == field) {
                this.history.push(data.newValue);
                this.prune();
                setInterval(() => this.prune(), duration);
                this.emit("update", data);
            }
        });
    }
    
    prune() {
        let now = (new Date()).getTime();
        while (this.history.length && now - this.history.first().time.getTime() > this.duration) {
            this.history.shift();
        }
    }
    
}

module.exports = Quote;