const Subscription = require("./subscription"),
      constants = require("../constants"),
      TICKS = constants.QUOTE_TICK_TYPES,
      Depth = require("./depth"),
      Candlesticks = require("./candlesticks"),
      Order = require("./order");

Date.getLocale('en').addFormat('{yyyy}{MM}{dd}-{hh}:{mm}:{ss}');

class Quote extends Subscription {
    
    constructor(contract) {
        super(contract);
        
        this.contractId = contract.summary.conId;
        this.localSymbol = contract.summary.localSymbol;
        
        this.loaded = false;
        this.streaming = false;
        
        this.depth = new Depth(this.contract);
        this.candlesticks = new Candlesticks(this.contract);
        this.order = data => new Order(contract, data);
        this.refresh = () => this.query();
        
        Object.defineProperty(this, "_fieldTypes", { value: [ ], enumerable: false });
    }
    
    addFieldTypes(fieldTypes) {
        if (fieldTypes) {
            this._fieldTypes.append(fieldTypes);
            this._fieldTypes = this._fieldTypes.unique().compact(true);
        }
        
        return this;
    }

    ticks() {
        this._fieldTypes.append(TICKS.realTimeVolume);
        this._fieldTypes = this._fieldTypes.unique().compact(true);
        return this;
    }
    
    stats() {
        this._fieldTypes.append([ TICKS.tradeCount, TICKS.tradeRate, TICKS.volumeRate, TICKS.priceRange ]);
        this._fieldTypes = this._fieldTypes.unique().compact(true);
        return this;
    }
    
    fundamentals() {
        this._fieldTypes.append(TICKS.fundamentalRatios);
        this._fieldTypes = this._fieldTypes.unique().compact(true);
        return this;
    }
    
    volatility() {
        this._fieldTypes.append([ TICKS.historicalVolatility, TICKS.optionImpliedVolatility ]);
        this._fieldTypes = this._fieldTypes.unique().compact(true);
        return this;
    }
    
    options() {
        this._fieldTypes.append([ TICKS.optionVolume, TICKS.optionOpenInterest ]);
        this._fieldTypes = this._fieldTypes.unique().compact(true);
        return this;
    }
    
    futures() {
        this._fieldTypes.append(TICKS.futuresOpenInterest);
        this._fieldTypes = this._fieldTypes.unique().compact(true);
        return this;
    }
    
    short() {
        this._fieldTypes.append(TICKS.shortable);
        this._fieldTypes = this._fieldTypes.unique().compact(true);
        return this;
    }
    
    news() {
        this._fieldTypes.append(TICKS.news);
        this._fieldTypes = this._fieldTypes.unique().compact(true);
        return this;
    }
    
    all() {
        return this.ticks().stats().fundamentals().volatility().options().futures().short().news();
    }
    
    async query() {
        let state = { };
        return new Promise((yes, no) => {
            this.service.mktData(this.contract.summary, this._fieldTypes.join(","), true, false)
                .on("data", datum => {
                    datum = parseQuotePart(datum);
                    if (datum && datum.key && datum.value) {
                        this[datum.key] = state[datum.key] = datum.value;
                    }
                })
                .once("error", err => no(err))
                .once("end", () => yes(state))
                .send();
        });
    }
    
    async stream() {
        let req = this.service.mktData(this.contract.summary, this._fieldTypes.join(","), false, false);
        this.subscriptions.push(req);
        
        return new Promise((yes, no) => {
            let fail = err => {
                this.streaming = false;
                no(err);
            };
            
            req.once("data", () => {
                this.streaming = true;
                req.removeListener("error", fail);
                req.on("error", err => {
                    this.streaming = false;
                    this.emit("error", err);
                });
                
                yes(this);
            }).on("data", datum  => {
                datum = parseQuotePart(datum);
                if (datum && datum.key && datum.value) {
                    this[datum.key] = datum.value;
                    this.emit("update", { contract: this.contract.summary.conId, field: datum.key, value: datum.value });
                }
            }).once("error", fail).send();
        });
    }
    
    async streamAll() {
        return Promise.all([
            this.stream(),
            this.depth.stream(),
            this.candlesticks.stream()
        ]);
    }
    
    cancel() {
        this.streaming = false;
        super.cancel();
    }
    
}

function parseQuotePart(datum) {
    let key = String(datum.name), value = datum.value;
    
    if (!key || key == "") throw new Error("Tick key not found.");
    if (value === null || value === "") throw new Error("No tick data value found.");
    
    if (key == "LAST_TIMESTAMP") {
        value = Date.create(parseInt(value) * 1000);
    }
    else if (key == "RT_VOLUME") {
        value = value.split(";");
        value = {
            price: parseFloat(value[0]),
            size: parseInt(value[1]),
            time: Date.create(parseInt(value[2])),
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
        value = String(value).split(" ");
        value = {
            id: value[0],
            time: value[1],
            source: value[2],
            text: value.from(3).join(' ')
        };
    }
    
    return { key: key.camelize(false), value: value };
}

module.exports = Quote;