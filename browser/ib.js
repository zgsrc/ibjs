(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
var Session = require("../model/session"),
    Proxy = require("../service/proxy");

window.ib = {
    session: () => new Session(new Proxy(socket)),
    flags: require("../model/flags")
};
},{"../model/flags":7,"../model/session":18,"../service/proxy":1601}],2:[function(require,module,exports){
"use strict";

const RealTime = require("../realtime");

class Account extends RealTime {
    
    /* string id, boolean orders, boolean trades */
    constructor(session, options) {
        super(session);
        
        if (typeof options == "string") {
            options = { 
                id: options,
                orders: true,
                trades: true
            };
        }
        
        if (typeof options.id != "string") {
            throw new Error("Account id is required.");
        }
        
        this._exclude.push("positions", "orders", "trades");
        
        this.positions = new RealTime(session);
        
        let account = this.service.accountUpdates(options.id).on("data", data => {
            if (data.key) {
                var value = data.value;
                if (/^\-?[0-9]+(\.[0-9]+)?$/.test(value)) value = parseFloat(value);
                else if (value == "true") value = true;
                else if (value == "false") value = false;

                if (data.currency && data.currency != "") {
                    value = { currency: data.currency, value: value };
                }

                var key = data.key.camelize(false);
                this[key] = value;
                this.emit("update", { type: "account", field: key, value: value });
            }
            else if (data.timestamp) {
                var date = Date.create(data.timestamp);
                this.timestamp = date;
                this.emit("update", { type: "account", field: "timestamp", value: date });
            }
            else if (data.contract) {
                this.positions[data.contract.conId] = data;
                this.emit("update", { type: "position", field: data.contract.conId, value: data });
            }
            else {
                this.emit("error", "Unrecognized account update " + JSON.stringify(data));
            }
        }).on("error", err => {
            this.emit("error", err);
        }).send();
        
        let orders = null;
        if (options.orders) {
            this.orders = this.session.orders({ all: true, autoOpen: true, account: options.id });
        }
        
        let trades = null;
        if (options.trades) {
            this.trades = this.session.trades({ account: options.id });
        }
        
        this.cancel = () => {
            account.cancel();
            if (orders) orders.cancel();
            if (trades) trades.cancel();
        };
        
        setTimeout(() => this.emit("load"), 500);
    }
    
}

module.exports = Account;
},{"../realtime":17}],3:[function(require,module,exports){
"use strict";

const RealTime = require("../realtime"),
      flags = require("../flags");

class Accounts extends RealTime {
    
    /* string group, array tags, boolean positions */
    constructor(session, options) {
        super(session);

        if (options == null) {
            options = { positions: true };
        }
        
        let positions = null, summary = this.service.accountSummary(
            options.group || "All", 
            options.tags || Object.values(flags.ACCOUNT_TAGS).join(',')
        ).on("data", datum => {
            if (datum.account && datum.tag) {
                let id = datum.account;
                if (this[id] == null) {
                    this[id] = { positions: { } };
                }

                if (datum.tag) {
                    var value = datum.value;
                    if (/^\-?[0-9]+(\.[0-9]+)?$/.test(value)) value = parseFloat(value);
                    else if (value == "true") value = true;
                    else if (value == "false") value = false;

                    if (datum.currency && datum.currency != "") {
                        value = { currency: datum.currency, value: value };
                    }

                    var key = datum.tag.camelize(false);
                    this[id][key] = value;
                    this.emit("update", { field: key, value: value });
                }
            }
        }).on("end", cancel => {
            if (options.positions) {
                positions = this.service.positions();
                positions.on("data", data => {
                    this[data.accountName].positions[data.contract.conId] = data;
                    this.emit("update", { type: "position", field: data.contract.conId, value: data });
                }).on("end", cancel => {
                    this.emit("load");
                }).on("error", err => {
                    this.emit("error", err);
                }).send();
            }
            else {
                this.emit("load");
            }
        }).on("error", err => {
            this.emit("error", err);
        }).send();
        
        this.cancel = () => {
            summary.cancel();
            if (positions) positions.cancel();
        };
    }
    
}

module.exports = Accounts;
},{"../flags":7,"../realtime":17}],4:[function(require,module,exports){
"use strict";

const RealTime = require("../realtime");

class Orders extends RealTime {
    
    constructor(session, options) {
        super(session);

        if (options == null) {
            options = { all: true };
        }
        
        if (options.autoOpen) {
            this.service.autoOpenOrders(options.autoOpen ? true : false);
        }
        
        let orders = options.all ? this.service.allOpenOrders() : this.service.openOrders();
        this.cancel = () => orders.cancel();
        
        orders.on("data", data => {
            this[data.orderId] = data;
        }).on("end", () => {
            this.emit("load");
        }).on("error", err => {
            this.emit("error", err);
        }).send();
    }
    
    cancelAllOrders() {
        this.service.globalCancel();
    }
    
}

module.exports = Orders;
},{"../realtime":17}],5:[function(require,module,exports){
"use strict";

const RealTime = require("../realtime");

class Positions extends RealTime {
    
    constructor(session, options) {
        super(session);

        let positions = this.service.positions().on("data", data => {
            if (!this[data.contract.conId]) {
                this[data.contract.conId] = { };    
            }
            
            this[data.contract.conId][data.accountName] = data;
            this.emit("update", data);
        }).on("end", cancel => {
            this.emit("load");
        }).on("error", err => {
            this.emit("error", err);
        }).send();
        
        this.cancel = () => positions.cancel();
    }
    
}

module.exports = Positions;
},{"../realtime":17}],6:[function(require,module,exports){
"use strict";

const RealTime = require("../realtime");

class Trades extends RealTime {
    
    constructor(session, options) {
        super(session);

        options = options || { };
        
        this.filter = { };
        this._exclude.push("filter");
        
        if (options.account) this.filter.acctCode = options.account;
        if (options.client) this.filter.clientId = options.client;
        if (options.exchange) this.filter.exchange = options.exchange;
        if (options.secType) this.filter.secType = options.secType;
        if (options.side) this.filter.side = options.side;
        if (options.symbol) this.filter.symbol = options.symbol;
        if (options.time) this.filter.time = options.time;
        
        let trades = this.service.executions(this.filter).on("data", data => {
            if (!this[data.exec.permId]) {
                this[data.exec.permId] = { };
            }

            this[data.exec.permId][data.exec.execId] = data;
            this.emit("update", data);
        }).on("error", err => {
            this.emit("error", err);
        }).on("end", () => {
            this.emit("load");
        }).send();
        
        this.cancel = () => trades.cancel();
    }
    
}

module.exports = Trades;
},{"../realtime":17}],7:[function(require,module,exports){
const HISTORICAL = {
    trades: "TRADES",
    midpoint: "MIDPOINT",
    bid: "BID",
    ask: "ASK",
    bidAsk: "BID_ASK",
    historicalVol: "HISTORICAL_VOLATILITY",
    optionVol: "OPTION_IMPLIED_VOLATILITY",
    rebate: "REBATE_RATE",
    fee: "FEE_RATE",
    yieldBid: "YIELD_BID",
    yieldAsk: "YIELD_ASK",
    yieldBidAsk: "YIELD_BID_ASK",
    yieldLast: "YIELD_LAST"
};

exports.HISTORICAL = HISTORICAL;

const ACCOUNT_TAGS = {
    accountType: "AccountType",
    netLiquidation: "NetLiquidation",
    totalCashValue: "TotalCashValue",
    settledCash: "SettledCash",
    accruedCash: "AccruedCash",
    buyingPower: "BuyingPower",
    equityWithLoanValue: "EquityWithLoanValue",
    previousDayEquityWithLoanValue: "PreviousDayEquityWithLoanValue",
    grossPositionValue: "GrossPositionValue",
    regTEquity: "RegTEquity",
    regTMargin: "RegTMargin",
    sma: "SMA",
    initMarginReq: "InitMarginReq",
    maintMarginReq: "MaintMarginReq",
    availableFunds: "AvailableFunds",
    excessLiquidity: "ExcessLiquidity",
    cushion: "Cushion",
    fullInitMarginReq: "FullInitMarginReq",
    fullMaintMarginReq: "FullMaintMarginReq",
    fullAvailableFunds: "FullAvailableFunds",
    fullExcessLiquidity: "FullExcessLiquidity",
    lookAheadNextChange: "LookAheadNextChange",
    lookAheadInitMarginReq: "LookAheadInitMarginReq",
    lookAheadMaintMarginReq: "LookAheadMaintMarginReq",
    lookAheadAvailableFunds: "LookAheadAvailableFunds",
    lookAheadExcessLiquidity: "LookAheadExcessLiquidity",
    highestSeverity: "HighestSeverity",
    dayTradesRemaining: "DayTradesRemaining",
    leverage: "Leverage"
};

exports.ACCOUNT_TAGS = ACCOUNT_TAGS;

const TICKS = {  
    optionVolume: 100,
    optionOpenInterest: 101,
    historicalVolatility: 104,
    optionImpliedVolatility: 106,
    indexFuturePremium: 162,
    priceRange: 165,
    markPrice: 221,
    auctionValues: 225,
    realTimeVolume: 233,
    shortable: 236,
    fundamentalRatios: 258,
    news: 292,
    tradeCount: 293,
    tradeRate: 294,
    volumeRate: 295,
    realtimeHistoricalVolatility: 411,
    dividends: 456,
    futuresOpenInterest: 588
};

exports.QUOTE_TICK_TYPES = TICKS;

const REPORT = {
    snapshot: "ReportSnapshot",
    financials: "ReportsFinSummary",
    ratios: "ReportRatios",
    statements: "ReportsFinStatements",
    consensus: "RESC",
    calendar: "CalendarReport"
};

exports.FUNDAMENTALS_REPORTS = REPORT;

const CURRENCIES = [
    'KRW', 'EUR', 'GBP', 'AUD',
    'USD', 'TRY', 'ZAR', 'CAD', 
    'CHF', 'MXN', 'HKD', 'JPY', 
    'INR', 'NOK', 'SEK', 'RUB'
];

exports.CURRENCIES = CURRENCIES;

const SECURITY_TYPE = {
    stock: "STK",
    equity: "STK",
    option: "OPT",
    put: "OPT",
    puts: "OPT",
    call: "OPT",
    calls: "OPT",
    future: "FUT",
    futures: "FUT",
    index: "IND",
    forward: "FOP",
    forwards: "FOP",
    cash: "CASH",
    currency: "CASH",
    bag: "BAG",
    news: "NEWS"
};

exports.SECURITY_TYPE = SECURITY_TYPE;

const SIDE = {
    buy: "BUY",
    sell: "SELL",
    short: "SSHORT"
};

exports.SIDE = SIDE;

const ORDER_TYPE = {
    market: "MKT",
    marketProtect: "MKT PRT",
    marketToLimit: "MTL",
    marketIfTouched: "MIT",
    marketOnClose: "MOC",
    
    limit: "LMT",
    limitIfTouched: "LIT",
    limitOnClose: "LOC",
    
    stop: "STP",
    stopProtect: "STP PRT",
    stopLimit: "STP LMT",
    
    trailingStop: "TRAIL",
    trailingStopLimit: "TRAIL LIMIT",
    trailingLimitIfTouched: "TRAIL LIT",
    trailingMarketIfTouched: "TRAIL MIT"
};

exports.ORDER_TYPE = ORDER_TYPE;

const RULE80A = { 
    individual: "I",
    agency: "A",
    agentOtherMember: "W",
    individualPTIA: "J",
    agencyPTIA: "U",
    agentOtherMemberPTIA: "M",
    individualPT: "K",
    agencyPT: "Y",
    agentOtherMemberPT: "N"
};

exports.RULE80A = RULE80A;

const TIME_IN_FORCE = {
    day: "DAY",
    goodUntilCancelled: "GTC",
    goodTilCancelled: "GTC",
    immediateOrCancel: "IOC",
    fillOrKill: "FOK",
    goodUntil: "GTD",
    auction: "AUC",
    open: "OPG"
};

exports.TIME_IN_FORCE = TIME_IN_FORCE;

const OCA_TYPE = {
    cancel: 1,
    reduce: 2,
    reduceWithoutOverfillProtection: 3
};

exports.OCA_TYPE = OCA_TYPE;

},{}],8:[function(require,module,exports){
"use strict";

const MarketData = require("./marketdata"),
      studies = require("./studies"),
      flags = require("../flags"),
      Sugar = require("sugar");

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
                this.emit("update", this.series.last());
            }
            else {
                data.synthetic = true;
                data.date = bd;
                data.timestamp = bd.getTime();
                
                this.emit("old", this.series.last());
                this.series.push(data);
                this.emit("update", this.series.last());
                this.emit("new", this.series.last());
            }
        });
    }
    
    set(options) {
        this.options = Sugar.Object.merge(this.options, options);
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
            this.options.dateFormat,
            false
        );
        
        let length = this.series.length;
        
        let min = Number.MAX_VALUE,
            max = Number.MIN_VALUE;
        
        req.on("data", record => {
            record.date = Sugar.Date.create(record.date);
            record.timestamp = record.date.getTime();
            
            if (min > record.timestamp) min = record.timestamp;
            if (max < record.timestamp) max = record.timestamp;
            
            let existing = this.series.find(r => r.timestamp == record.timestamp);
            if (existing && existing.synthetic) {
                Sugar.Object.merge(existing, record);
                delete existing.synthetic;
            }
            else {
                this.series.push(record);
            }
        }).once("error", err => {
            if (!retry && err.timeout) {
                this.history(cb, true);
            }
            else {
                if (cb) cb(err);
                else this.emit("error", err);
            }
        }).once("end", () => {
            this.series = this.series.sortBy("timestamp");
            this.options.cursor = this.series.first().date;
            this.emit("load", [ min, max ]);
            if (cb) cb();
        }).send();
        
        return this;
    }
    
    lookup(timestamp) { 
        let idx = this.series.findIndex(i => i.timestamp > timestamp);
        if (idx > 0) return this.series[idx - 1];
        else return null;
    }
    
    study(name, length, calculator) {
        if (typeof calculator == "string") {
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
    let now = Sugar.Date.create(date),
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
},{"../flags":7,"./marketdata":12,"./studies":16,"sugar":1245}],9:[function(require,module,exports){
"use strict";

const MarketData = require("./marketdata"),
      Bars = require("./bars"),
      flags = require("../flags"),
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
    
}

module.exports = Charts;
},{"../flags":7,"./bars":8,"./marketdata":12,"sugar":1245}],10:[function(require,module,exports){
"use strict";

require("sugar").extend();

const flags = require("../flags"),
      RealTime = require("../realtime"),
      Sugar = require("Sugar");

function details(session, summary, cb) {
    let list = [ ];
    session.service.contractDetails(summary)
        .on("data", contract => list.push(new Contract(session, contract)))
        .once("error", err => cb(err, list))
        .once("end", () => cb(null, list))
        .send();
}

class Contract extends RealTime {
    
    constructor(session, data) {
        super(session);
        this.merge(data);
    } 
    
    merge(data) {
        Sugar.Object.merge(this, data);
        
        this.symbol = this.summary.localSymbol.compact().underscore().toUpperCase();
        this.orderTypes = this.orderTypes.split(",").compact();
        this.validExchanges = this.validExchanges.split(",").compact();

        if (this.summary.expiry) {
            this.expiry = Sugar.Date.create(Sugar.Date.create(this.summary.expiry).format("{Month} {dd}, {yyyy}") + " 00:00:00 " + this.timeZoneId);
        }
        
        let timeZoneId = this.timeZoneId,
            tradingHours = (this.tradingHours || "").split(';').map(d => d.split(':')),
            liquidHours = (this.liquidHours || "").split(';').map(d => d.split(':'));
        
        let schedule = { };
        tradingHours.forEach(arr => {
            if (arr[1] == "CLOSED") return;
            
            let date = Sugar.Date.create(arr[0], { future: true });
            
            let label = date.format("{Mon}{dd}");
            if (!schedule[label]) schedule[label] = { };
            
            let times = arr[1].split(',').map(d => d.split('-').map(t => t.to(2) + ":" + t.from(2)));
            
            schedule[label].start = [ ];
            schedule[label].end = [ ];
            
            times.forEach(time => {
                let start = Sugar.Date.create(date.format("{Month} {dd}, {yyyy}") + " " + time[0] + ":00 " + timeZoneId, { future: true }),
                    end = Sugar.Date.create(date.format("{Month} {dd}, {yyyy}") + " " + time[1] + ":00 " + timeZoneId, { future: true });

                if (end.isBefore(start)) start.addDays(-1);

                schedule[label].start.push(start);
                schedule[label].end.push(end);
            });
            
            if (schedule[label].start.length != schedule[label].end.length) {
                throw new Error("Bad trading hours.");
            }
        });

        liquidHours.forEach(arr => {
            if (arr[1] == "CLOSED") return;
            
            let date = Sugar.Date.create(arr[0], { future: true });
            
            let label = date.format("{Mon}{dd}");
            if (!schedule[label]) schedule[label] = { };
            
            let times = arr[1].split(',').map(d => d.split('-').map(t => t.to(2) + ":" + t.from(2)));
            
            schedule[label].open = [ ];
            schedule[label].close = [ ];
            
            times.forEach(time => {
                let start = Sugar.Date.create(date.format("{Month} {dd}, {yyyy}") + " " + time[0] + ":00 " + timeZoneId, { future: true }),
                    end = Sugar.Date.create(date.format("{Month} {dd}, {yyyy}") + " " + time[1] + ":00 " + timeZoneId, { future: true });

                if (end.isBefore(start)) start.addDays(-1);

                schedule[label].open.push(start);
                schedule[label].close.push(end);
            });
            
            if (schedule[label].open.length != schedule[label].close.length) {
                throw new Error("Bad liquid hours.");
            }
        });
        
        Object.defineProperty(schedule, 'today', {
            get: function() {
                let now = Sugar.Date.create(),
                    today = schedule[now.format("{Mon}{dd}")];
                
                if (today && today.end.every(end => end.isBefore(now))) {
                    now.addDays(1);
                    today = schedule[now.format("{Mon}{dd}")];
                }
                
                return today;
            }
        });
        
        Object.defineProperty(schedule, 'tomorrow', {
            get: function() {
                if (this.today) {
                    let now = this.today.addDays(1);
                    return schedule[now.format("{Mon}{dd}")];
                }
                else return null;
            }
        });
        
        Object.defineProperty(this, 'schedule', { value: schedule });
        
        delete this.tradingHours;
        delete this.liquidHours;
    }
    
    get marketsOpen() {
        let now = Sugar.Date.create(), hours = this.schedule.today;
        if (hours && hours.start && hours.end) {
            for (let i = 0; i < hours.start.length; i++) {
                if (now.isBetween(hours.start[i], hours.end[i])) return true;
            }
        }
        
        return false;
    }
    
    get marketsLiquid() {
        let now = Sugar.Date.create(), hours = this.schedule.today;
        if (hours && hours.open && hours.close) {
            for (let i = 0; i < hours.open.length; i++) {
                if (now.isBetween(hours.open[i], hours.close[i])) return true;
            }
        }
        
        return false;
    }
    
    refresh(cb) {
        this.session.service.contractDetails(this.summary)
            .once("data", contract => merge(data))
            .once("error", err => cb(err, list))
            .once("end", () => cb(null, list))
            .send();
    } 
    
}

exports.details = details;

let frontMonth = exports.frontMonth = function(cutOffDay, offset) {
    let date = Sugar.Date.create();
    
    if (date.getDate() >= cutOffDay) {
        date.addMonths(1);
    }
    
    if (offset) {
        date.addMonths(offset);
    }

    return date;
};

function parse(definition) {
    if (Sugar.Object.isNumber(definition)) {
        definition = { conId: definition };
    }
    else if (Sugar.Object.isString(definition)) {
        let tokens = definition.split(' ').map("trim").compact(true);
        definition = { };
        
        let date = tokens[0],
            symbol = tokens[1],
            side = tokens[2] ? tokens[2].toLowerCase() : null,
            type = flags.SECURITY_TYPE[side];
        
        if (type) {
            definition.secType = type;
            definition.symbol = symbol;
            
            if (type == "OPT") {
                if (side.startsWith("put") || side.startsWith("call")) definition.right = side.toUpperCase();
                else throw new Error("Must specify 'put' or 'call' for option contracts.");
            }
            
            if (date) {
                if (date.toLowerCase().startsWith("front")) {
                    date = date.from(5);
                    date = date.split('+');
                    
                    if (date[0] == "") date[0] = "15";
                    
                    let cutOff = parseInt(date[0]),
                        offset = date[1] ? parseInt(date[1]) : 0;
                    
                    date = frontMonth(cutOff, offset);
                    if (type == "FUT") date.addMonths(1);
                }
                else {
                    let month = date.to(3),
                        year = date.from(3).trim();

                    if (year.startsWith("'") || year.startsWith("`") || year.startsWith("-") || year.startsWith("/")) year = year.from(1);
                    
                    if (year.length == 2) year = "20" + year;
                    if (year == "") year = Sugar.Date.create().fullYear();

                    date = Sugar.Date.create(month + " " + year);
                }
                
                date = date.format("{yyyy}{MM}");
                definition.expiry = date;
            }

            tokens = tokens.from(3);
        }
        else {
            definition.symbol = tokens[0].toUpperCase();
            
            if (tokens[1] && flags.SECURITY_TYPE[tokens[1].toLowerCase()]) {
                definition.secType = flags.SECURITY_TYPE[tokens[1].toLowerCase()];
                tokens = tokens.from(2);
            }
            else tokens = tokens.from(1);
        }
        
        tokens.inGroupsOf(2).forEach(field => {
            if (field.length == 2 && field.every(a => a != null)) {
                if (field[0].toLowerCase() == "in") {
                    definition.currency = field[1].toUpperCase();
                    if (flags.CURRENCIES.indexOf(definition.currency) < 0) throw new Error("Invalid currency " + definition.currency);
                }
                else if (field[0].toLowerCase() == "on") definition.exchange = field[1].toUpperCase();
                else if (field[0].toLowerCase() == "at") definition.strike = parseFloat(field[1]);
                else throw new Error("Unrecognized field " + field.join(' '));
            }
            else {
                throw new Error("Unrecognized field " + field.join(' '));
            }
        });
    }

    if (Sugar.Object.isObject(definition)) {
        if (definition.symbol == null && definition.conId == null) {
            throw new Error("Definition must have symbol or conId.");
        }

        if (definition.conId == null) {
            if (!definition.secType && flags.CURRENCIES.indexOf(definition.symbol) >= 0) definition.secType = "CASH";
            else definition.secType = definition.secType || "STK";

            if (definition.secType == "CASH") {
                definition.exchange = "IDEALPRO";
                definition.currency = definition.symbol.from(4);
                definition.symbol = definition.symbol.to(3);
            }
            else {
                if (definition.secType == "STK" || definition.secType == "OPT") definition.exchange = definition.exchange || "SMART";
                definition.currency = definition.currency || "USD";
            }
        }
        
        return definition;
    }
    else {
        throw new Error("Unrecognized security definition '" + definition + "'");
    }
}

exports.parse = parse;

function lookup(session, description, cb) {
    let summary = description;
    try { summary = parse(description); }
    catch (ex) { cb(ex); return; }
    
    details(session, summary, cb);
}

exports.lookup = lookup;
},{"../flags":7,"../realtime":17,"Sugar":454,"sugar":1245}],11:[function(require,module,exports){
"use strict";

require("sugar").extend();

const MarketData = require("./marketdata"),
      Sugar = require("sugar");

class Depth extends MarketData {
    
    constructor(session, contract) {
        super(session, contract);
        
        this._exclude.push("_subscriptions");
        this._subscriptions = [ ];
        
        this.exchanges = [ ];
        this.bids = { };
        this.offers = { };
    }
    
    get validExchanges() {
        return this.contract.validExchanges;
    }
    
    streamExchange(exchange, rows) {
        if (this.exchanges.indexOf(exchange) < 0) {
            this.exchanges.push(exchange);
            
            let copy = Sugar.Object.clone(this.contract.summary);
            copy.exchange = exchange;
            
            this.bids[exchange] = { };
            this.offers[exchange] = { };

            let req = this.session.service.mktDepth(copy, rows || 5).on("data", datum => {
                if (datum.side == 1) this.bids[exchange][datum.position] = datum;
                else this.offers[exchange][datum.position] = datum;
                this.emit("update", datum);
            }).on("error", (err, cancel) => {
                this.emit("error", this.contract.summary.localSymbol + " level 2 quotes on " + exchange + " failed.");
                this._subscriptions.remove(req);
                this.exchanges.remove(exchange);
                delete this.bids[exchange];
                delete this.offers[exchange];
                cancel();
            }).send();
            
            this._subscriptions.push(req);
        }
        
        return this;
    }
    
    cancelExchange(exchange) {
        let idx = this.exchanges.indexOf(exchange),
            req = this._subscriptions[i];
        
        req.cancel();
        
        this._subscriptions.remove(req);
        this.exchanges.remove(exchange);
        delete this.bids[exchange];
        delete this.offers[exchange];
        
        return this;
    }
    
    stream(exchanges, rows) {
        if (Sugar.Object.isNumber(exchanges)) {
            rows = exchanges;
            exchanges = null;
        }
        
        if (exchanges == null) {
            exchanges = this.validExchanges;
        }
        
        exchanges.forEach(exchange => {
            this.streamExchange(exchange, rows);
        });
        
        return this;
    }
    
    cancel() {
        this._subscriptions.map("cancel");
    }
    
}

module.exports = Depth;
},{"./marketdata":12,"sugar":1245}],12:[function(require,module,exports){
"use strict";

require("sugar").extend();

const RealTime = require("../realtime");

class MarketData extends RealTime {
    
    constructor(session, contract) {
        super(session);
        Object.defineProperty(this, 'contract', { value: contract });
    }
    
}

module.exports = MarketData;
},{"../realtime":17,"sugar":1245}],13:[function(require,module,exports){
"use strict";

const MarketData = require("./marketdata"),
      flags = require("../flags");

class Order extends MarketData {
    
    constructor(session, contract) {
        super(session, contract);
        Object.defineProperty(this, "children", { value: [ ] });
        
        this.ticket = { 
            tif: flags.TIME_IN_FORCE.day,
            totalQuantity: 1,
            action: flags.SIDE.buy,
            type: flags.ORDER_TYPE.market
        };
    }
    
    or(cb) {
        if (this.ocaGroup == null) {
            let group = Math.floor(Math.random * 1000000).toString();
            this.ocaGroup = group;
            this.oraType = flags.OCA_TYPE.cancel;
        }
        
        let siblingOrder = new Order(this.session, this.contract);
        siblingOrder.ocaGroup = this.ocaGroup;
        siblingOrder.ocaType = flags.OCA_TYPE.cancel;
        
        if (cb && typeof cb == "function") {
            cb(siblingOrder);
            return this;
        }
        else {
            return siblingOrder;
        }
    }
    
    then(cb) {
        let childOrder = new Order(this.session, this.contract);
        childOrder.parent = this;
        this.children.push(childOrder);
        
        if (cb && typeof cb == "function") {
            cb(childOrder);
            return this;
        }
        else {
            return childOrder;
        }
    }
    
    ////////////////////////////////////////
    // QUANTITY
    ////////////////////////////////////////
    trade(qty, show) {
        this.ticket.totalQuantity = Math.abs(qty);
        this.ticket.action = qty > 0 ? flags.SIDE.buy : flags.SIDE.sell;
        
        if (show != null) {
            if (show == 0) this.hidden = true;
            this.displaySize = Math.abs(show);
        }
        
        return this;
    }
    
    buy(qty, show) {
        this.ticket.totalQuantity = qty;
        this.ticket.action = flags.SIDE.buy;
        
        if (show != null) {
            if (show == 0) this.hidden = true;
            this.displaySize = Math.abs(show);
        }
        
        return this;
    }
    
    sell(qty, show) {
        this.ticket.totalQuantity = qty;
        this.ticket.action = flags.SIDE.sell;
        
        if (show != null) {
            if (show == 0) this.hidden = true;
            this.displaySize = Math.abs(show);
        }
        
        return this;
    }
    
    show(qty) {
        if (show != null) {
            if (show == 0) this.hidden = true;
            this.displaySize = Math.abs(show);
        }

        return this;
    }
    
    ////////////////////////////////////////
    // PRICE
    ////////////////////////////////////////
    type(orderType) {
        this.ticket.type = orderType;
    }
    
    market() {
        this.ticket.type = flags.ORDER_TYPE.market;
        return this;
    }
    
    marketProtect() {
        this.ticket.type = flags.ORDER_TYPE.marketProtect;
        return this;
    }
    
    marketToLimit() {
        this.ticket.type = flags.ORDER_TYPE.marketToLimit;
        return this;
    }
    
    auction() {
        this.ticket.type = flags.ORDER_TYPE.marketToLimit;
        this.ticket.tif = flags.TIME_IN_FORCE.auction;
    }
    
    marketIfTouched(price) {
        this.ticket.type = flags.ORDER_TYPE.marketIfTouched;
        this.ticket.auxPrice = price;
        return this;
    }
    
    marketOnClose() {
        this.ticket.type = flags.ORDER_TYPE.marketOnClose;
        return this;
    }
    
    marketOnOpen() {
        this.ticket.type = flags.ORDER_TYPE.market;
        this.ticket.tif = flags.TIME_IN_FORCE.open;
        return this;
    }
    
    limit(price, discretionaryAmount) {
        this.ticket.type = flags.ORDER_TYPE.limit;
        this.ticket.lmtPrice = price;
        if (discretionaryAmount) {
            this.ticket.discretionaryAmt = discretionaryAmount;
        }

        return this;
    }
    
    limitIfTouched(trigger, limit) {
        this.ticket.type = flags.ORDER_TYPE.limitIfTouched;
        this.ticket.auxPrice = trigger;
        this.ticket.lmtPrice = limit;
        return this;
    }
    
    limitOnClose(price) {
        this.ticket.type = flags.ORDER_TYPE.limitOnClose;
        this.ticket.lmtPrice = price;
        return this;
    }
    
    limitOnOpen(price) {
        this.ticket.type = flags.ORDER_TYPE.limit;
        this.ticket.tif = flags.TIME_IN_FORCE.open;
        this.ticket.lmtPrice = price;
        return this;
    }
    
    stop(trigger) {
        this.ticket.type = flags.ORDER_TYPE.stop;
        this.ticket.auxPrice = trigger;
        return this;
    }
    
    stopProtect(trigger) {
        this.ticket.type = flags.ORDER_TYPE.stopProtect;
        this.ticket.auxPrice = trigger;
        return this;
    }
    
    stopLimit(trigger, limit) {
        this.ticket.type = flags.ORDER_TYPE.stopLimit;
        this.ticket.auxPrice = trigger;
        this.ticket.lmtPrice = limit;            
        return this;
    }

    ////////////////////////////////////////
    // TIMEFRAME
    ////////////////////////////////////////
    goodToday() {
        this.ticket.tif = flags.TIME_IN_FORCE.day;
        return this;
    }
    
    goodUntilCancelled() {
        this.ticket.tif = flags.TIME_IN_FORCE.goodUntilCancelled;
        return this;
    }
    
    immediateOrCancel() {
        this.ticket.tif = flags.TIME_IN_FORCE.immediateOrCancel;
        return this;
    }
    
    fillOrKill() {
        this.ticket.tif = flags.TIME_IN_FORCE.fillOrKill;
        return this;
    }
    
    atTheOpen() {
        this.ticket.tif = flags.TIME_IN_FORCE.open;
    }
    
    auction() {
        this.ticket.tif = flags.TIME_IN_FORCE.auction;
    }
    
    outsideRegularTradingHours() { 
        this.ticket.outsideRth = true; 
        return this; 
    }
    
    ////////////////////////////////////////
    // EXECUTION
    ////////////////////////////////////////
    overridePercentageConstraints() {
        this.ticket.overridePercentageConstraints = true;
        return this;
    }
    
    setup() {
        let me = this, 
            nextId = this.service.nextValidId(1);
        
        nextId.on("data", id => {
            nextId.cancel();
            
            this.ticket.orderId = id;
            if (this.children.length) {
                this.children.forEach(child => {
                    child.parentId = id;
                    delete child.parent;
                });
            }
            
            let request = this.service.placeOrder(this.contract, this.ticket);
            me.cancel = () => request.cancel();
            
            request.on("data", data => {
                Object.merge(me, data, { resolve: true });
            }).on("error", err => {
                me.error = err;
                me.emit("error", err);
            }).send();
        }).on("error", err => cb(err)).send();
    }
    
    transmit() {
        this.ticket.transmit = true;
        this.setup();
    }
    
}

module.exports = Order;
},{"../flags":7,"./marketdata":12}],14:[function(require,module,exports){
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
            if (this[datum.key]) this.emit("load");
            
            let oldValue = this[datum.key];
            this[datum.key] = datum.value;
            this.emit("update", { key: datum.key, newValue: datum.value, oldValue: oldValue });
        }).on("error", err => {
            this.emit("error", err);
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
},{"../flags":7,"./marketdata":12,"sugar":1245}],15:[function(require,module,exports){
"use strict";

require("sugar").extend();

const flags = require("../flags"),
      MarketData = require("./marketdata"),
      Quote = require("./quote"),
      Depth = require("./depth"),
      Charts = require("./charts"),
      Order = require("./order");

class Security extends MarketData {
    
    constructor(session, contract) {
        super(session, contract);
        
        this.quote = new Quote(session, contract);
        this.depth = new Depth(session, contract);
        this.charts = new Charts(session, contract, flags.HISTORICAL.trades);
    }
    
    fundamentals(type, cb) {
        this.service.fundamentalData(this.contract.summary, flags.FUNDAMENTALS_REPORTS[type])
            .on("data", data => cb(null, data))
            .on("end", () => cb(new Error("Could not load " + type + " fundamental data for " + this.contract.localSymbol + ". " + err.message)))
            .on("error", err => cb(new Error("Could not load " + type + " fundamental data for " + this.contract.localSymbol + ". " + err.message)))
            .send();
    }
    
    order() {
        return new Order(this.session, this.contract);
    }
    
    cancel() {
        if (this.quote) this.quote.cancel();
        if (this.depth) this.depth.cancel();
        if (this.charts) this.charts.cancel();
    }
    
}

function securities(session, description, cb) {
    session.details(description, (err, contracts) => {
        if (err) cb(err);
        else cb(null, contracts.map(contract => new Security(session, contract)));
    });
}

module.exports = securities;
},{"../flags":7,"./charts":9,"./depth":11,"./marketdata":12,"./order":13,"./quote":14,"sugar":1245}],16:[function(require,module,exports){
module.exports = { };
},{}],17:[function(require,module,exports){
"use strict";

const Events = require("events"),
      Sugar = require("sugar");

class RealTime extends Events {
    
    constructor(session) {
        super();
        this._exclude = [ ];
        Object.defineProperty(this, 'session', { value: session });
        Object.defineProperty(this, 'service', { value: session.service });
    }
    
    get fields() {
        return Sugar.Object.keys(this).exclude(/\_.*/).subtract(this._exclude).exclude("cancel").exclude("domain");
    }
    
    each(fn) {
        this.fields.forEach((e, i) => fn(this[e], e, i));
    }
    
    cancel() {
        return false;
    }
    
}

module.exports = RealTime;
},{"events":1605,"sugar":1245}],18:[function(require,module,exports){
(function (process){
"use strict";

const Events = require("events"),
      Accounts = require("./accounting/accounts"),
      Positions = require("./accounting/positions"),
      Orders = require("./accounting/orders"),
      Trades = require("./accounting/trades"),
      Account = require("./accounting/account"),
      contract = require("./marketdata/contract"),
      securities = require("./marketdata/security"),
      Sugar = require("sugar");

class Session extends Events {
    
    constructor(service) {
        super();
        
        Object.defineProperty(this, 'service', { value: service });
        
        this.connectivity = { };
        this.bulletins = [ ];
        this.state = "initializing";
        this.displayGroups = [ ];
        
        this.service.socket.once("managedAccounts", data => {
            this.managedAccounts = Array.isArray(data) ? data : [ data ];
            this.state = "ready";
            this.emit("ready", this);
        });
        
        this.service.socket.on("connected", () => {
            this.service.system().on("data", data => {
                if (data.code >= 2103 || data.code <= 2106) {
                    let name = data.message.from(data.message.indexOf(" is ") + 4).trim();
                    name = name.split(":");

                    let status = name[0];
                    name = name[1];

                    this.connectivity[name] = { status: status, time: Sugar.Date.create() };   
                    this.emit("connectivity", this.connectivity[name]);
                }
                else {
                    this.emit("error", data);    
                }
            });
            
            this.service.newsBulletins(true).on("data", data => {
                this.bulletins.push(data);
                this.emit("bulletin", data);
            }).on("error", err => {
                this.emit("error", err);
            }).send();
            
            this.service.queryDisplayGroups().on("data", groups => {
                groups.forEach((group, index) => {
                    let displayGroup = this.service.subscribeToGroupEvents(group);
                    this.displayGroups.push(displayGroup);
                    
                    displayGroup.group = group;
                    displayGroup.index = index;
                    displayGroup.update = contract => this.service.updateDisplayGroup(displayGroup.id, contract);
                    
                    displayGroup.on("data", contract => {
                        displayGroup.contract = contract;
                        this.emit("displayGroupUpdated", displayGroup);
                    }).send();
                });
            }).send();
            
            this.emit("connected", this.service.socket);
            this.state = "connected";
        }).on("disconnected", () => {
            this.state = "disconnected";
            this.emit("disconnected");
        });
    }
    
    get clientId() {
        return this.service.socket.clientId;
    }
    
    close(exit) {
        this.service.socket.disconnect();
        if (exit) process.exit();
    }
    
    account(options) {
        if (options && !options.id) {
            options.id = this.managedAccounts.first();
        }
        
        return new Account(this, options || this.managedAccounts.first());
    }

    accountSummary(options) {
        return new Accounts(this, options);
    }
    
    positions(options) {
        return new Positions(this, options);
    }
    
    orders(options) {
        return new Orders(this, options);
    }

    trades(options) {
        return new Trades(this, options);
    }

    details(description, cb) {
        contract.lookup(this, description, cb);
    }
    
    securities(description, cb) {
        securities(this, description, cb);
    }
    
}

module.exports = Session;
}).call(this,require('_process'))
},{"./accounting/account":2,"./accounting/accounts":3,"./accounting/orders":4,"./accounting/positions":5,"./accounting/trades":6,"./marketdata/contract":10,"./marketdata/security":15,"_process":1606,"events":1605,"sugar":1245}],19:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core'),
    arrayClone = require('./internal/arrayClone'),
    arrayAppend = require('./internal/arrayAppend');

Sugar.Array.defineInstance({

  'add': function(arr, item, index) {
    return arrayAppend(arrayClone(arr), item, index);
  }

});

module.exports = Sugar.Array.add;
},{"./internal/arrayAppend":48,"./internal/arrayClone":49,"sugar-core":809}],20:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core'),
    arrayAppend = require('./internal/arrayAppend');

Sugar.Array.defineInstance({

  'append': function(arr, item, index) {
    return arrayAppend(arr, item, index);
  }

});

module.exports = Sugar.Array.append;
},{"./internal/arrayAppend":48,"sugar-core":809}],21:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core'),
    getEntriesForIndexes = require('../common/internal/getEntriesForIndexes');

Sugar.Array.defineInstance({

  'at': function(arr, index, loop) {
    return getEntriesForIndexes(arr, index, loop);
  }

});

module.exports = Sugar.Array.at;
},{"../common/internal/getEntriesForIndexes":133,"sugar-core":809}],22:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core'),
    average = require('../enumerable/internal/average');

Sugar.Array.defineInstance({

  'average': function(arr, map) {
    return average(arr, map);
  }

});

module.exports = Sugar.Array.average;
},{"../enumerable/internal/average":408,"sugar-core":809}],23:[function(require,module,exports){
'use strict';

var setArrayChainableConstructor = require('../internal/setArrayChainableConstructor');

setArrayChainableConstructor();
},{"../internal/setArrayChainableConstructor":70}],24:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core'),
    arrayClone = require('./internal/arrayClone');

Sugar.Array.defineInstance({

  'clone': function(arr) {
    return arrayClone(arr);
  }

});

module.exports = Sugar.Array.clone;
},{"./internal/arrayClone":49,"sugar-core":809}],25:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core'),
    arrayCompact = require('./internal/arrayCompact');

Sugar.Array.defineInstance({

  'compact': function(arr, all) {
    return arrayCompact(arr, all);
  }

});

module.exports = Sugar.Array.compact;
},{"./internal/arrayCompact":50,"sugar-core":809}],26:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core'),
    coercePositiveInteger = require('../common/internal/coercePositiveInteger');

Sugar.Array.defineStatic({

  'construct': function(n, fn) {
    n = coercePositiveInteger(n);
    return Array.from(new Array(n), function(el, i) {
      return fn && fn(i);
    });
  }

});

module.exports = Sugar.Array.construct;
},{"../common/internal/coercePositiveInteger":110,"sugar-core":809}],27:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core'),
    arrayCount = require('../enumerable/internal/arrayCount'),
    fixArgumentLength = require('../common/internal/fixArgumentLength');

Sugar.Array.defineInstance({

  'count': fixArgumentLength(arrayCount)

});

module.exports = Sugar.Array.count;
},{"../common/internal/fixArgumentLength":128,"../enumerable/internal/arrayCount":406,"sugar-core":809}],28:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core'),
    arrayCreate = require('./internal/arrayCreate');

require('./build/setArrayChainableConstructorCall');

Sugar.Array.defineStatic({

  'create': function(obj, clone) {
    return arrayCreate(obj, clone);
  }

});

module.exports = Sugar.Array.create;
},{"./build/setArrayChainableConstructorCall":23,"./internal/arrayCreate":52,"sugar-core":809}],29:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core'),
    ENHANCEMENTS_FLAG = require('../common/var/ENHANCEMENTS_FLAG'),
    ARRAY_ENHANCEMENTS_FLAG = require('../enumerable/var/ARRAY_ENHANCEMENTS_FLAG'),
    fixArgumentLength = require('../common/internal/fixArgumentLength'),
    enhancedMatcherMethods = require('../enumerable/var/enhancedMatcherMethods');

var enhancedEvery = enhancedMatcherMethods.enhancedEvery;

Sugar.Array.defineInstance({

  'every': fixArgumentLength(enhancedEvery)

}, [ENHANCEMENTS_FLAG, ARRAY_ENHANCEMENTS_FLAG]);

module.exports = Sugar.Array.every;
},{"../common/internal/fixArgumentLength":128,"../common/var/ENHANCEMENTS_FLAG":181,"../enumerable/var/ARRAY_ENHANCEMENTS_FLAG":428,"../enumerable/var/enhancedMatcherMethods":430,"sugar-core":809}],30:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core');

require('../enumerable/build/buildFromIndexMethodsCall');

module.exports = Sugar.Array.everyFromIndex;
},{"../enumerable/build/buildFromIndexMethodsCall":404,"sugar-core":809}],31:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core'),
    arrayExclude = require('./internal/arrayExclude');

Sugar.Array.defineInstance({

  'exclude': function(arr, f) {
    return arrayExclude(arr, f);
  }

});

module.exports = Sugar.Array.exclude;
},{"./internal/arrayExclude":53,"sugar-core":809}],32:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core'),
    ENHANCEMENTS_FLAG = require('../common/var/ENHANCEMENTS_FLAG'),
    ARRAY_ENHANCEMENTS_FLAG = require('../enumerable/var/ARRAY_ENHANCEMENTS_FLAG'),
    fixArgumentLength = require('../common/internal/fixArgumentLength'),
    enhancedMatcherMethods = require('../enumerable/var/enhancedMatcherMethods');

var enhancedFilter = enhancedMatcherMethods.enhancedFilter;

Sugar.Array.defineInstance({

  'filter': fixArgumentLength(enhancedFilter)

}, [ENHANCEMENTS_FLAG, ARRAY_ENHANCEMENTS_FLAG]);

module.exports = Sugar.Array.filter;
},{"../common/internal/fixArgumentLength":128,"../common/var/ENHANCEMENTS_FLAG":181,"../enumerable/var/ARRAY_ENHANCEMENTS_FLAG":428,"../enumerable/var/enhancedMatcherMethods":430,"sugar-core":809}],33:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core');

require('../enumerable/build/buildFromIndexMethodsCall');

module.exports = Sugar.Array.filterFromIndex;
},{"../enumerable/build/buildFromIndexMethodsCall":404,"sugar-core":809}],34:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core'),
    ENHANCEMENTS_FLAG = require('../common/var/ENHANCEMENTS_FLAG'),
    ARRAY_ENHANCEMENTS_FLAG = require('../enumerable/var/ARRAY_ENHANCEMENTS_FLAG'),
    fixArgumentLength = require('../common/internal/fixArgumentLength'),
    enhancedMatcherMethods = require('../enumerable/var/enhancedMatcherMethods');

var enhancedFind = enhancedMatcherMethods.enhancedFind;

Sugar.Array.defineInstance({

  'find': fixArgumentLength(enhancedFind)

}, [ENHANCEMENTS_FLAG, ARRAY_ENHANCEMENTS_FLAG]);

module.exports = Sugar.Array.find;
},{"../common/internal/fixArgumentLength":128,"../common/var/ENHANCEMENTS_FLAG":181,"../enumerable/var/ARRAY_ENHANCEMENTS_FLAG":428,"../enumerable/var/enhancedMatcherMethods":430,"sugar-core":809}],35:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core');

require('../enumerable/build/buildFromIndexMethodsCall');

module.exports = Sugar.Array.findFromIndex;
},{"../enumerable/build/buildFromIndexMethodsCall":404,"sugar-core":809}],36:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core'),
    ENHANCEMENTS_FLAG = require('../common/var/ENHANCEMENTS_FLAG'),
    ARRAY_ENHANCEMENTS_FLAG = require('../enumerable/var/ARRAY_ENHANCEMENTS_FLAG'),
    fixArgumentLength = require('../common/internal/fixArgumentLength'),
    enhancedMatcherMethods = require('../enumerable/var/enhancedMatcherMethods');

var enhancedFindIndex = enhancedMatcherMethods.enhancedFindIndex;

Sugar.Array.defineInstance({

  'findIndex': fixArgumentLength(enhancedFindIndex)

}, [ENHANCEMENTS_FLAG, ARRAY_ENHANCEMENTS_FLAG]);

module.exports = Sugar.Array.findIndex;
},{"../common/internal/fixArgumentLength":128,"../common/var/ENHANCEMENTS_FLAG":181,"../enumerable/var/ARRAY_ENHANCEMENTS_FLAG":428,"../enumerable/var/enhancedMatcherMethods":430,"sugar-core":809}],37:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core');

require('../enumerable/build/buildFromIndexMethodsCall');

module.exports = Sugar.Array.findIndexFromIndex;
},{"../enumerable/build/buildFromIndexMethodsCall":404,"sugar-core":809}],38:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core'),
    isUndefined = require('../common/internal/isUndefined');

Sugar.Array.defineInstance({

  'first': function(arr, num) {
    if (isUndefined(num)) return arr[0];
    if (num < 0) num = 0;
    return arr.slice(0, num);
  }

});

module.exports = Sugar.Array.first;
},{"../common/internal/isUndefined":155,"sugar-core":809}],39:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core'),
    arrayFlatten = require('./internal/arrayFlatten');

Sugar.Array.defineInstance({

  'flatten': function(arr, limit) {
    return arrayFlatten(arr, limit);
  }

});

module.exports = Sugar.Array.flatten;
},{"./internal/arrayFlatten":54,"sugar-core":809}],40:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core');

require('../enumerable/build/buildFromIndexMethodsCall');

module.exports = Sugar.Array.forEachFromIndex;
},{"../enumerable/build/buildFromIndexMethodsCall":404,"sugar-core":809}],41:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core');

Sugar.Array.defineInstance({

  'from': function(arr, num) {
    return arr.slice(num);
  }

});

module.exports = Sugar.Array.from;
},{"sugar-core":809}],42:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core'),
    ARRAY_OPTIONS = require('./var/ARRAY_OPTIONS');

var _arrayOptions = ARRAY_OPTIONS._arrayOptions;

module.exports = Sugar.Array.getOption;
},{"./var/ARRAY_OPTIONS":98,"sugar-core":809}],43:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core'),
    arrayGroupBy = require('./internal/arrayGroupBy');

Sugar.Array.defineInstance({

  'groupBy': function(arr, map, fn) {
    return arrayGroupBy(arr, map, fn);
  }

});

module.exports = Sugar.Array.groupBy;
},{"./internal/arrayGroupBy":55,"sugar-core":809}],44:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core'),
    isDefined = require('../common/internal/isDefined'),
    mathAliases = require('../common/var/mathAliases'),
    simpleRepeat = require('../common/internal/simpleRepeat');

var ceil = mathAliases.ceil;

Sugar.Array.defineInstance({

  'inGroups': function(arr, num, padding) {
    var pad = isDefined(padding);
    var result = new Array(num);
    var divisor = ceil(arr.length / num);
    simpleRepeat(num, function(i) {
      var index = i * divisor;
      var group = arr.slice(index, index + divisor);
      if (pad && group.length < divisor) {
        simpleRepeat(divisor - group.length, function() {
          group.push(padding);
        });
      }
      result[i] = group;
    });
    return result;
  }

});

module.exports = Sugar.Array.inGroups;
},{"../common/internal/isDefined":149,"../common/internal/simpleRepeat":174,"../common/var/mathAliases":195,"sugar-core":809}],45:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core'),
    isUndefined = require('../common/internal/isUndefined'),
    mathAliases = require('../common/var/mathAliases'),
    simpleRepeat = require('../common/internal/simpleRepeat');

var ceil = mathAliases.ceil;

Sugar.Array.defineInstance({

  'inGroupsOf': function(arr, num, padding) {
    var result = [], len = arr.length, group;
    if (len === 0 || num === 0) return arr;
    if (isUndefined(num)) num = 1;
    if (isUndefined(padding)) padding = null;
    simpleRepeat(ceil(len / num), function(i) {
      group = arr.slice(num * i, num * i + num);
      while(group.length < num) {
        group.push(padding);
      }
      result.push(group);
    });
    return result;
  }

});

module.exports = Sugar.Array.inGroupsOf;
},{"../common/internal/isUndefined":155,"../common/internal/simpleRepeat":174,"../common/var/mathAliases":195,"sugar-core":809}],46:[function(require,module,exports){
'use strict';

// Static Methods
require('./construct');
require('./create');

// Instance Methods
require('./add');
require('./append');
require('./at');
require('./clone');
require('./compact');
require('./exclude');
require('./first');
require('./flatten');
require('./from');
require('./groupBy');
require('./inGroups');
require('./inGroupsOf');
require('./intersect');
require('./isEmpty');
require('./isEqual');
require('./last');
require('./remove');
require('./removeAt');
require('./sample');
require('./shuffle');
require('./sortBy');
require('./subtract');
require('./to');
require('./union');
require('./unique');
require('./zip');

// Aliases
require('./insert');

// Accessors
require('./getOption');
require('./setOption');

module.exports = require('sugar-core');
},{"./add":19,"./append":20,"./at":21,"./clone":24,"./compact":25,"./construct":26,"./create":28,"./exclude":31,"./first":38,"./flatten":39,"./from":41,"./getOption":42,"./groupBy":43,"./inGroups":44,"./inGroupsOf":45,"./insert":47,"./intersect":71,"./isEmpty":72,"./isEqual":73,"./last":74,"./remove":85,"./removeAt":86,"./sample":87,"./setOption":88,"./shuffle":89,"./sortBy":92,"./subtract":93,"./to":95,"./union":96,"./unique":97,"./zip":102,"sugar-core":809}],47:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core'),
    append = require('./append');

Sugar.Array.alias('insert', 'append');

module.exports = Sugar.Array.insert;
},{"./append":20,"sugar-core":809}],48:[function(require,module,exports){
'use strict';

var isDefined = require('../../common/internal/isDefined');

function arrayAppend(arr, el, index) {
  var spliceArgs;
  index = +index;
  if (isNaN(index)) {
    index = arr.length;
  }
  spliceArgs = [index, 0];
  if (isDefined(el)) {
    spliceArgs = spliceArgs.concat(el);
  }
  arr.splice.apply(arr, spliceArgs);
  return arr;
}

module.exports = arrayAppend;
},{"../../common/internal/isDefined":149}],49:[function(require,module,exports){
'use strict';

var forEach = require('../../common/internal/forEach');

function arrayClone(arr) {
  var clone = new Array(arr.length);
  forEach(arr, function(el, i) {
    clone[i] = el;
  });
  return clone;
}

module.exports = arrayClone;
},{"../../common/internal/forEach":129}],50:[function(require,module,exports){
'use strict';

var filter = require('../../common/internal/filter');

function arrayCompact(arr, all) {
  return filter(arr, function(el) {
    return el || (!all && el != null && el.valueOf() === el.valueOf());
  });
}

module.exports = arrayCompact;
},{"../../common/internal/filter":127}],51:[function(require,module,exports){
'use strict';

var HAS_CONCAT_BUG = require('../var/HAS_CONCAT_BUG'),
    arraySafeConcat = require('./arraySafeConcat');

function arrayConcat(arr1, arr2) {
  if (HAS_CONCAT_BUG) {
    return arraySafeConcat(arr1, arr2);
  }
  return arr1.concat(arr2);
}

module.exports = arrayConcat;
},{"../var/HAS_CONCAT_BUG":101,"./arraySafeConcat":58}],52:[function(require,module,exports){
'use strict';

var isDefined = require('../../common/internal/isDefined'),
    arrayClone = require('./arrayClone'),
    classChecks = require('../../common/var/classChecks'),
    isObjectType = require('../../common/internal/isObjectType'),
    isArrayOrInherited = require('./isArrayOrInherited');

var isString = classChecks.isString;

function arrayCreate(obj, clone) {
  var arr;
  if (isArrayOrInherited(obj)) {
    arr = clone ? arrayClone(obj) : obj;
  } else if (isObjectType(obj) || isString(obj)) {
    arr = Array.from(obj);
  } else if (isDefined(obj)) {
    arr = [obj];
  }
  return arr || [];
}

module.exports = arrayCreate;
},{"../../common/internal/isDefined":149,"../../common/internal/isObjectType":151,"../../common/var/classChecks":192,"./arrayClone":49,"./isArrayOrInherited":69}],53:[function(require,module,exports){
'use strict';

var getMatcher = require('../../common/internal/getMatcher');

function arrayExclude(arr, f) {
  var result = [], matcher = getMatcher(f);
  for (var i = 0; i < arr.length; i++) {
    if (!matcher(arr[i], i, arr)) {
      result.push(arr[i]);
    }
  }
  return result;
}

module.exports = arrayExclude;
},{"../../common/internal/getMatcher":136}],54:[function(require,module,exports){
'use strict';

var forEach = require('../../common/internal/forEach'),
    classChecks = require('../../common/var/classChecks');

var isArray = classChecks.isArray;

function arrayFlatten(arr, level, current) {
  var result = [];
  level = level || Infinity;
  current = current || 0;
  forEach(arr, function(el) {
    if (isArray(el) && current < level) {
      result = result.concat(arrayFlatten(el, level, current + 1));
    } else {
      result.push(el);
    }
  });
  return result;
}

module.exports = arrayFlatten;
},{"../../common/internal/forEach":129,"../../common/var/classChecks":192}],55:[function(require,module,exports){
'use strict';

var forEach = require('../../common/internal/forEach'),
    mapWithShortcuts = require('../../common/internal/mapWithShortcuts'),
    coreUtilityAliases = require('../../common/var/coreUtilityAliases');

var hasOwn = coreUtilityAliases.hasOwn,
    forEachProperty = coreUtilityAliases.forEachProperty;

function arrayGroupBy(arr, map, fn) {
  var result = {}, key;
  forEach(arr, function(el, i) {
    key = mapWithShortcuts(el, map, arr, [el, i, arr]);
    if (!hasOwn(result, key)) {
      result[key] = [];
    }
    result[key].push(el);
  });
  if (fn) {
    forEachProperty(result, fn);
  }
  return result;
}

module.exports = arrayGroupBy;
},{"../../common/internal/forEach":129,"../../common/internal/mapWithShortcuts":160,"../../common/var/coreUtilityAliases":193}],56:[function(require,module,exports){
'use strict';

var forEach = require('../../common/internal/forEach'),
    arrayWrap = require('./arrayWrap'),
    classChecks = require('../../common/var/classChecks'),
    serializeInternal = require('../../common/internal/serializeInternal'),
    coreUtilityAliases = require('../../common/var/coreUtilityAliases');

var isArray = classChecks.isArray,
    hasOwn = coreUtilityAliases.hasOwn;

function arrayIntersectOrSubtract(arr1, arr2, subtract) {
  var result = [], obj = {}, refs = [];
  if (!isArray(arr2)) {
    arr2 = arrayWrap(arr2);
  }
  forEach(arr2, function(el) {
    obj[serializeInternal(el, refs)] = true;
  });
  forEach(arr1, function(el) {
    var key = serializeInternal(el, refs);
    if (hasOwn(obj, key) !== subtract) {
      delete obj[key];
      result.push(el);
    }
  });
  return result;
}

module.exports = arrayIntersectOrSubtract;
},{"../../common/internal/forEach":129,"../../common/internal/serializeInternal":168,"../../common/var/classChecks":192,"../../common/var/coreUtilityAliases":193,"./arrayWrap":61}],57:[function(require,module,exports){
'use strict';

var getMatcher = require('../../common/internal/getMatcher');

function arrayRemove(arr, f) {
  var matcher = getMatcher(f), i = 0;
  while(i < arr.length) {
    if (matcher(arr[i], i, arr)) {
      arr.splice(i, 1);
    } else {
      i++;
    }
  }
  return arr;
}

module.exports = arrayRemove;
},{"../../common/internal/getMatcher":136}],58:[function(require,module,exports){
'use strict';

var forEach = require('../../common/internal/forEach'),
    arrayClone = require('./arrayClone'),
    classChecks = require('../../common/var/classChecks');

var isArray = classChecks.isArray;

function arraySafeConcat(arr, arg) {
  var result = arrayClone(arr), len = result.length, arr2;
  arr2 = isArray(arg) ? arg : [arg];
  result.length += arr2.length;
  forEach(arr2, function(el, i) {
    result[len + i] = el;
  });
  return result;
}

module.exports = arraySafeConcat;
},{"../../common/internal/forEach":129,"../../common/var/classChecks":192,"./arrayClone":49}],59:[function(require,module,exports){
'use strict';

var arrayClone = require('./arrayClone');

function arrayShuffle(arr) {
  arr = arrayClone(arr);
  var i = arr.length, j, x;
  while(i) {
    j = (Math.random() * i) | 0;
    x = arr[--i];
    arr[i] = arr[j];
    arr[j] = x;
  }
  return arr;
}

module.exports = arrayShuffle;
},{"./arrayClone":49}],60:[function(require,module,exports){
'use strict';

var forEach = require('../../common/internal/forEach'),
    mapWithShortcuts = require('../../common/internal/mapWithShortcuts'),
    serializeInternal = require('../../common/internal/serializeInternal'),
    coreUtilityAliases = require('../../common/var/coreUtilityAliases');

var hasOwn = coreUtilityAliases.hasOwn;

function arrayUnique(arr, map) {
  var result = [], obj = {}, refs = [];
  forEach(arr, function(el, i) {
    var transformed = map ? mapWithShortcuts(el, map, arr, [el, i, arr]) : el;
    var key = serializeInternal(transformed, refs);
    if (!hasOwn(obj, key)) {
      result.push(el);
      obj[key] = true;
    }
  });
  return result;
}

module.exports = arrayUnique;
},{"../../common/internal/forEach":129,"../../common/internal/mapWithShortcuts":160,"../../common/internal/serializeInternal":168,"../../common/var/coreUtilityAliases":193}],61:[function(require,module,exports){
'use strict';

function arrayWrap(obj) {
  var arr = [];
  arr.push(obj);
  return arr;
}

module.exports = arrayWrap;
},{}],62:[function(require,module,exports){
'use strict';

var HALF_WIDTH_NINE = require('../var/HALF_WIDTH_NINE'),
    FULL_WIDTH_NINE = require('../var/FULL_WIDTH_NINE'),
    CommonChars = require('../../common/var/CommonChars');

var HALF_WIDTH_ZERO = CommonChars.HALF_WIDTH_ZERO,
    FULL_WIDTH_ZERO = CommonChars.FULL_WIDTH_ZERO;

function codeIsNumeral(code) {
  return (code >= HALF_WIDTH_ZERO && code <= HALF_WIDTH_NINE) ||
         (code >= FULL_WIDTH_ZERO && code <= FULL_WIDTH_NINE);
}

module.exports = codeIsNumeral;
},{"../../common/var/CommonChars":180,"../var/FULL_WIDTH_NINE":99,"../var/HALF_WIDTH_NINE":100}],63:[function(require,module,exports){
'use strict';

var ARRAY_OPTIONS = require('../var/ARRAY_OPTIONS'),
    classChecks = require('../../common/var/classChecks');

var isString = classChecks.isString,
    isArray = classChecks.isArray,
    _arrayOptions = ARRAY_OPTIONS._arrayOptions;

function compareValue(aVal, bVal) {
  var cmp, i, collate;
  if (isString(aVal) && isString(bVal)) {
    collate = _arrayOptions('sortCollate');
    return collate(aVal, bVal);
  } else if (isArray(aVal) && isArray(bVal)) {
    if (aVal.length < bVal.length) {
      return -1;
    } else if (aVal.length > bVal.length) {
      return 1;
    } else {
      for(i = 0; i < aVal.length; i++) {
        cmp = compareValue(aVal[i], bVal[i]);
        if (cmp !== 0) {
          return cmp;
        }
      }
      return 0;
    }
  }
  return aVal < bVal ? -1 : aVal > bVal ? 1 : 0;
}

module.exports = compareValue;
},{"../../common/var/classChecks":192,"../var/ARRAY_OPTIONS":98}],64:[function(require,module,exports){
'use strict';

var coreUtilityAliases = require('../../common/var/coreUtilityAliases');

var getOwn = coreUtilityAliases.getOwn;

function getCollationCharacter(str, index, sortEquivalents) {
  var chr = str.charAt(index);
  return getOwn(sortEquivalents, chr) || chr;
}

module.exports = getCollationCharacter;
},{"../../common/var/coreUtilityAliases":193}],65:[function(require,module,exports){
'use strict';

var classChecks = require('../../common/var/classChecks');

var isString = classChecks.isString;

function getCollationReadyString(str, sortIgnore, sortIgnoreCase) {
  if (!isString(str)) str = String(str);
  if (sortIgnoreCase) {
    str = str.toLowerCase();
  }
  if (sortIgnore) {
    str = str.replace(sortIgnore, '');
  }
  return str;
}

module.exports = getCollationReadyString;
},{"../../common/var/classChecks":192}],66:[function(require,module,exports){
'use strict';

var forEach = require('../../common/internal/forEach'),
    spaceSplit = require('../../common/internal/spaceSplit');

function getSortEquivalents() {
  var equivalents = {};
  forEach(spaceSplit('AÁÀÂÃÄ CÇ EÉÈÊË IÍÌİÎÏ OÓÒÔÕÖ Sß UÚÙÛÜ'), function(set) {
    var first = set.charAt(0);
    forEach(set.slice(1).split(''), function(chr) {
      equivalents[chr] = first;
      equivalents[chr.toLowerCase()] = first.toLowerCase();
    });
  });
  return equivalents;
}

module.exports = getSortEquivalents;
},{"../../common/internal/forEach":129,"../../common/internal/spaceSplit":175}],67:[function(require,module,exports){
'use strict';

var map = require('../../common/internal/map');

function getSortOrder() {
  var order = 'AÁÀÂÃĄBCĆČÇDĎÐEÉÈĚÊËĘFGĞHıIÍÌİÎÏJKLŁMNŃŇÑOÓÒÔPQRŘSŚŠŞTŤUÚÙŮÛÜVWXYÝZŹŻŽÞÆŒØÕÅÄÖ';
  return map(order.split(''), function(str) {
    return str + str.toLowerCase();
  }).join('');
}

module.exports = getSortOrder;
},{"../../common/internal/map":158}],68:[function(require,module,exports){
'use strict';

function getSortOrderIndex(chr, sortOrder) {
  if (!chr) {
    return null;
  } else {
    return sortOrder.indexOf(chr);
  }
}

module.exports = getSortOrderIndex;
},{}],69:[function(require,module,exports){
'use strict';

var classChecks = require('../../common/var/classChecks');

var isArray = classChecks.isArray;

function isArrayOrInherited(obj) {
  return obj && obj.constructor && isArray(obj.constructor.prototype);
}

module.exports = isArrayOrInherited;
},{"../../common/var/classChecks":192}],70:[function(require,module,exports){
'use strict';

var arrayCreate = require('./arrayCreate'),
    namespaceAliases = require('../../common/var/namespaceAliases'),
    setChainableConstructor = require('../../common/internal/setChainableConstructor');

var sugarArray = namespaceAliases.sugarArray;

function setArrayChainableConstructor() {
  setChainableConstructor(sugarArray, arrayCreate);
}

module.exports = setArrayChainableConstructor;
},{"../../common/internal/setChainableConstructor":169,"../../common/var/namespaceAliases":197,"./arrayCreate":52}],71:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core'),
    arrayIntersectOrSubtract = require('./internal/arrayIntersectOrSubtract');

Sugar.Array.defineInstance({

  'intersect': function(arr1, arr2) {
    return arrayIntersectOrSubtract(arr1, arr2, false);
  }

});

module.exports = Sugar.Array.intersect;
},{"./internal/arrayIntersectOrSubtract":56,"sugar-core":809}],72:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core');

Sugar.Array.defineInstance({

  'isEmpty': function(arr) {
    return arr.length === 0;
  }

});

module.exports = Sugar.Array.isEmpty;
},{"sugar-core":809}],73:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core'),
    isEqual = require('../common/internal/isEqual');

Sugar.Array.defineInstance({

  'isEqual': function(a, b) {
    return isEqual(a, b);
  }

});

module.exports = Sugar.Array.isEqual;
},{"../common/internal/isEqual":150,"sugar-core":809}],74:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core'),
    isUndefined = require('../common/internal/isUndefined');

Sugar.Array.defineInstance({

  'last': function(arr, num) {
    if (isUndefined(num)) return arr[arr.length - 1];
    var start = arr.length - num < 0 ? 0 : arr.length - num;
    return arr.slice(start);
  }

});

module.exports = Sugar.Array.last;
},{"../common/internal/isUndefined":155,"sugar-core":809}],75:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core'),
    getLeastOrMost = require('../enumerable/internal/getLeastOrMost');

Sugar.Array.defineInstance({

  'least': function(arr, all, map) {
    return getLeastOrMost(arr, all, map);
  }

});

module.exports = Sugar.Array.least;
},{"../enumerable/internal/getLeastOrMost":415,"sugar-core":809}],76:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core'),
    ENHANCEMENTS_FLAG = require('../common/var/ENHANCEMENTS_FLAG'),
    ARRAY_ENHANCEMENTS_FLAG = require('../enumerable/var/ARRAY_ENHANCEMENTS_FLAG'),
    enhancedMap = require('../enumerable/var/enhancedMap'),
    fixArgumentLength = require('../common/internal/fixArgumentLength');

Sugar.Array.defineInstance({

  'map': fixArgumentLength(enhancedMap)

}, [ENHANCEMENTS_FLAG, ARRAY_ENHANCEMENTS_FLAG]);

module.exports = Sugar.Array.map;
},{"../common/internal/fixArgumentLength":128,"../common/var/ENHANCEMENTS_FLAG":181,"../enumerable/var/ARRAY_ENHANCEMENTS_FLAG":428,"../enumerable/var/enhancedMap":429,"sugar-core":809}],77:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core');

require('../enumerable/build/buildFromIndexMethodsCall');

module.exports = Sugar.Array.mapFromIndex;
},{"../enumerable/build/buildFromIndexMethodsCall":404,"sugar-core":809}],78:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core'),
    getMinOrMax = require('../enumerable/internal/getMinOrMax');

Sugar.Array.defineInstance({

  'max': function(arr, all, map) {
    return getMinOrMax(arr, all, map, true);
  }

});

module.exports = Sugar.Array.max;
},{"../enumerable/internal/getMinOrMax":416,"sugar-core":809}],79:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core'),
    median = require('../enumerable/internal/median');

Sugar.Array.defineInstance({

  'median': function(arr, map) {
    return median(arr, map);
  }

});

module.exports = Sugar.Array.median;
},{"../enumerable/internal/median":418,"sugar-core":809}],80:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core'),
    getMinOrMax = require('../enumerable/internal/getMinOrMax');

Sugar.Array.defineInstance({

  'min': function(arr, all, map) {
    return getMinOrMax(arr, all, map);
  }

});

module.exports = Sugar.Array.min;
},{"../enumerable/internal/getMinOrMax":416,"sugar-core":809}],81:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core'),
    getLeastOrMost = require('../enumerable/internal/getLeastOrMost');

Sugar.Array.defineInstance({

  'most': function(arr, all, map) {
    return getLeastOrMost(arr, all, map, true);
  }

});

module.exports = Sugar.Array.most;
},{"../enumerable/internal/getLeastOrMost":415,"sugar-core":809}],82:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core'),
    arrayNone = require('../enumerable/internal/arrayNone'),
    fixArgumentLength = require('../common/internal/fixArgumentLength');

Sugar.Array.defineInstance({

  'none': fixArgumentLength(arrayNone)

});

module.exports = Sugar.Array.none;
},{"../common/internal/fixArgumentLength":128,"../enumerable/internal/arrayNone":407,"sugar-core":809}],83:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core');

require('../enumerable/build/buildFromIndexMethodsCall');

module.exports = Sugar.Array.reduceFromIndex;
},{"../enumerable/build/buildFromIndexMethodsCall":404,"sugar-core":809}],84:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core');

require('../enumerable/build/buildFromIndexMethodsCall');

module.exports = Sugar.Array.reduceRightFromIndex;
},{"../enumerable/build/buildFromIndexMethodsCall":404,"sugar-core":809}],85:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core'),
    arrayRemove = require('./internal/arrayRemove');

Sugar.Array.defineInstance({

  'remove': function(arr, f) {
    return arrayRemove(arr, f);
  }

});

module.exports = Sugar.Array.remove;
},{"./internal/arrayRemove":57,"sugar-core":809}],86:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core'),
    isUndefined = require('../common/internal/isUndefined');

Sugar.Array.defineInstance({

  'removeAt': function(arr, start, end) {
    if (isUndefined(start)) return arr;
    if (isUndefined(end))   end = start;
    arr.splice(start, end - start + 1);
    return arr;
  }

});

module.exports = Sugar.Array.removeAt;
},{"../common/internal/isUndefined":155,"sugar-core":809}],87:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core'),
    trunc = require('../common/var/trunc'),
    arrayClone = require('./internal/arrayClone'),
    classChecks = require('../common/var/classChecks'),
    isUndefined = require('../common/internal/isUndefined'),
    mathAliases = require('../common/var/mathAliases');

var isBoolean = classChecks.isBoolean,
    min = mathAliases.min;

Sugar.Array.defineInstance({

  'sample': function(arr, arg1, arg2) {
    var result = [], num, remove, single;
    if (isBoolean(arg1)) {
      remove = arg1;
    } else {
      num = arg1;
      remove = arg2;
    }
    if (isUndefined(num)) {
      num = 1;
      single = true;
    }
    if (!remove) {
      arr = arrayClone(arr);
    }
    num = min(num, arr.length);
    for (var i = 0, index; i < num; i++) {
      index = trunc(Math.random() * arr.length);
      result.push(arr[index]);
      arr.splice(index, 1);
    }
    return single ? result[0] : result;
  }

});

module.exports = Sugar.Array.sample;
},{"../common/internal/isUndefined":155,"../common/var/classChecks":192,"../common/var/mathAliases":195,"../common/var/trunc":198,"./internal/arrayClone":49,"sugar-core":809}],88:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core'),
    ARRAY_OPTIONS = require('./var/ARRAY_OPTIONS');

var _arrayOptions = ARRAY_OPTIONS._arrayOptions;

module.exports = Sugar.Array.setOption;
},{"./var/ARRAY_OPTIONS":98,"sugar-core":809}],89:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core'),
    arrayShuffle = require('./internal/arrayShuffle');

Sugar.Array.defineInstance({

  'shuffle': function(arr) {
    return arrayShuffle(arr);
  }

});

module.exports = Sugar.Array.shuffle;
},{"./internal/arrayShuffle":59,"sugar-core":809}],90:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core'),
    ENHANCEMENTS_FLAG = require('../common/var/ENHANCEMENTS_FLAG'),
    ARRAY_ENHANCEMENTS_FLAG = require('../enumerable/var/ARRAY_ENHANCEMENTS_FLAG'),
    fixArgumentLength = require('../common/internal/fixArgumentLength'),
    enhancedMatcherMethods = require('../enumerable/var/enhancedMatcherMethods');

var enhancedSome = enhancedMatcherMethods.enhancedSome;

Sugar.Array.defineInstance({

  'some': fixArgumentLength(enhancedSome)

}, [ENHANCEMENTS_FLAG, ARRAY_ENHANCEMENTS_FLAG]);

module.exports = Sugar.Array.some;
},{"../common/internal/fixArgumentLength":128,"../common/var/ENHANCEMENTS_FLAG":181,"../enumerable/var/ARRAY_ENHANCEMENTS_FLAG":428,"../enumerable/var/enhancedMatcherMethods":430,"sugar-core":809}],91:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core');

require('../enumerable/build/buildFromIndexMethodsCall');

module.exports = Sugar.Array.someFromIndex;
},{"../enumerable/build/buildFromIndexMethodsCall":404,"sugar-core":809}],92:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core'),
    compareValue = require('./internal/compareValue'),
    mapWithShortcuts = require('../common/internal/mapWithShortcuts');

Sugar.Array.defineInstance({

  'sortBy': function(arr, map, desc) {
    arr.sort(function(a, b) {
      var aProperty = mapWithShortcuts(a, map, arr, [a]);
      var bProperty = mapWithShortcuts(b, map, arr, [b]);
      return compareValue(aProperty, bProperty) * (desc ? -1 : 1);
    });
    return arr;
  }

});

module.exports = Sugar.Array.sortBy;
},{"../common/internal/mapWithShortcuts":160,"./internal/compareValue":63,"sugar-core":809}],93:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core'),
    arrayIntersectOrSubtract = require('./internal/arrayIntersectOrSubtract');

Sugar.Array.defineInstance({

  'subtract': function(arr, item) {
    return arrayIntersectOrSubtract(arr, item, true);
  }

});

module.exports = Sugar.Array.subtract;
},{"./internal/arrayIntersectOrSubtract":56,"sugar-core":809}],94:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core'),
    sum = require('../enumerable/internal/sum');

Sugar.Array.defineInstance({

  'sum': function(arr, map) {
    return sum(arr, map);
  }

});

module.exports = Sugar.Array.sum;
},{"../enumerable/internal/sum":425,"sugar-core":809}],95:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core'),
    isUndefined = require('../common/internal/isUndefined');

Sugar.Array.defineInstance({

  'to': function(arr, num) {
    if (isUndefined(num)) num = arr.length;
    return arr.slice(0, num);
  }

});

module.exports = Sugar.Array.to;
},{"../common/internal/isUndefined":155,"sugar-core":809}],96:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core'),
    arrayUnique = require('./internal/arrayUnique'),
    arrayConcat = require('./internal/arrayConcat');

Sugar.Array.defineInstance({

  'union': function(arr1, arr2) {
    return arrayUnique(arrayConcat(arr1, arr2));
  }

});

module.exports = Sugar.Array.union;
},{"./internal/arrayConcat":51,"./internal/arrayUnique":60,"sugar-core":809}],97:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core'),
    arrayUnique = require('./internal/arrayUnique');

Sugar.Array.defineInstance({

  'unique': function(arr, map) {
    return arrayUnique(arr, map);
  }

});

module.exports = Sugar.Array.unique;
},{"./internal/arrayUnique":60,"sugar-core":809}],98:[function(require,module,exports){
'use strict';

var getSortOrder = require('../internal/getSortOrder'),
    codeIsNumeral = require('../internal/codeIsNumeral'),
    stringToNumber = require('../../common/internal/stringToNumber'),
    namespaceAliases = require('../../common/var/namespaceAliases'),
    getSortOrderIndex = require('../internal/getSortOrderIndex'),
    getSortEquivalents = require('../internal/getSortEquivalents'),
    defineOptionsAccessor = require('../../common/internal/defineOptionsAccessor'),
    getCollationCharacter = require('../internal/getCollationCharacter'),
    getCollationReadyString = require('../internal/getCollationReadyString');

var sugarArray = namespaceAliases.sugarArray;

var ARRAY_OPTIONS = {
  'sortIgnore':      null,
  'sortNatural':     true,
  'sortIgnoreCase':  true,
  'sortOrder':       getSortOrder(),
  'sortCollate':     collateStrings,
  'sortEquivalents': getSortEquivalents()
};

var _arrayOptions = defineOptionsAccessor(sugarArray, ARRAY_OPTIONS);

function collateStrings(a, b) {
  var aValue, bValue, aChar, bChar, aEquiv, bEquiv, index = 0, tiebreaker = 0;

  var sortOrder       = _arrayOptions('sortOrder');
  var sortIgnore      = _arrayOptions('sortIgnore');
  var sortNatural     = _arrayOptions('sortNatural');
  var sortIgnoreCase  = _arrayOptions('sortIgnoreCase');
  var sortEquivalents = _arrayOptions('sortEquivalents');

  a = getCollationReadyString(a, sortIgnore, sortIgnoreCase);
  b = getCollationReadyString(b, sortIgnore, sortIgnoreCase);

  do {

    aChar  = getCollationCharacter(a, index, sortEquivalents);
    bChar  = getCollationCharacter(b, index, sortEquivalents);
    aValue = getSortOrderIndex(aChar, sortOrder);
    bValue = getSortOrderIndex(bChar, sortOrder);

    if (aValue === -1 || bValue === -1) {
      aValue = a.charCodeAt(index) || null;
      bValue = b.charCodeAt(index) || null;
      if (sortNatural && codeIsNumeral(aValue) && codeIsNumeral(bValue)) {
        aValue = stringToNumber(a.slice(index));
        bValue = stringToNumber(b.slice(index));
      }
    } else {
      aEquiv = aChar !== a.charAt(index);
      bEquiv = bChar !== b.charAt(index);
      if (aEquiv !== bEquiv && tiebreaker === 0) {
        tiebreaker = aEquiv - bEquiv;
      }
    }
    index += 1;
  } while(aValue != null && bValue != null && aValue === bValue);
  if (aValue === bValue) return tiebreaker;
  return aValue - bValue;
}

module.exports = {
  ARRAY_OPTIONS: ARRAY_OPTIONS,
  _arrayOptions: _arrayOptions
};
},{"../../common/internal/defineOptionsAccessor":124,"../../common/internal/stringToNumber":176,"../../common/var/namespaceAliases":197,"../internal/codeIsNumeral":62,"../internal/getCollationCharacter":64,"../internal/getCollationReadyString":65,"../internal/getSortEquivalents":66,"../internal/getSortOrder":67,"../internal/getSortOrderIndex":68}],99:[function(require,module,exports){
'use strict';

module.exports = 0xff19;
},{}],100:[function(require,module,exports){
'use strict';

module.exports = 0x39;
},{}],101:[function(require,module,exports){
'use strict';

module.exports = !('0' in [].concat(undefined).concat());
},{}],102:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core'),
    map = require('../common/internal/map');

Sugar.Array.defineInstanceWithArguments({

  'zip': function(arr, args) {
    return map(arr, function(el, i) {
      return [el].concat(map(args, function(k) {
        return (i in k) ? k[i] : null;
      }));
    });
  }

});

module.exports = Sugar.Array.zip;
},{"../common/internal/map":158,"sugar-core":809}],103:[function(require,module,exports){
'use strict';

function allCharsReg(src) {
  return RegExp('[' + src + ']', 'g');
}

module.exports = allCharsReg;
},{}],104:[function(require,module,exports){
'use strict';

function assertArgument(exists) {
  if (!exists) {
    throw new TypeError('Argument required');
  }
}

module.exports = assertArgument;
},{}],105:[function(require,module,exports){
'use strict';

var classChecks = require('../var/classChecks');

var isArray = classChecks.isArray;

function assertArray(obj) {
  if (!isArray(obj)) {
    throw new TypeError('Array required');
  }
}

module.exports = assertArray;
},{"../var/classChecks":192}],106:[function(require,module,exports){
'use strict';

var classChecks = require('../var/classChecks');

var isFunction = classChecks.isFunction;

function assertCallable(obj) {
  if (!isFunction(obj)) {
    throw new TypeError('Function is not callable');
  }
}

module.exports = assertCallable;
},{"../var/classChecks":192}],107:[function(require,module,exports){
'use strict';

var isPrimitive = require('./isPrimitive');

function assertWritable(obj) {
  if (isPrimitive(obj)) {
    // If strict mode is active then primitives will throw an
    // error when attempting to write properties. We can't be
    // sure if strict mode is available, so pre-emptively
    // throw an error here to ensure consistent behavior.
    throw new TypeError('Property cannot be written');
  }
}

module.exports = assertWritable;
},{"./isPrimitive":153}],108:[function(require,module,exports){
'use strict';

var _utc = require('../var/_utc');

function callDateGet(d, method) {
  return d['get' + (_utc(d) ? 'UTC' : '') + method]();
}

module.exports = callDateGet;
},{"../var/_utc":190}],109:[function(require,module,exports){
'use strict';

var _utc = require('../var/_utc'),
    callDateGet = require('./callDateGet');

function callDateSet(d, method, value, safe) {
  // "Safe" denotes not setting the date if the value is the same as what is
  // currently set. In theory this should be a noop, however it will cause
  // timezone shifts when in the middle of a DST fallback. This is unavoidable
  // as the notation itself is ambiguous (i.e. there are two "1:00ams" on
  // November 1st, 2015 in northern hemisphere timezones that follow DST),
  // however when advancing or rewinding dates this can throw off calculations
  // so avoiding this unintentional shifting on an opt-in basis.
  if (safe && value === callDateGet(d, method, value)) {
    return;
  }
  d['set' + (_utc(d) ? 'UTC' : '') + method](value);
}

module.exports = callDateSet;
},{"../var/_utc":190,"./callDateGet":108}],110:[function(require,module,exports){
'use strict';

var trunc = require('../var/trunc'),
    classChecks = require('../var/classChecks');

var isNumber = classChecks.isNumber;

function coercePositiveInteger(n) {
  n = +n || 0;
  if (n < 0 || !isNumber(n) || !isFinite(n)) {
    throw new RangeError('Invalid number');
  }
  return trunc(n);
}

module.exports = coercePositiveInteger;
},{"../var/classChecks":192,"../var/trunc":198}],111:[function(require,module,exports){
'use strict';

var NO_KEYS_IN_STRING_OBJECTS = require('../var/NO_KEYS_IN_STRING_OBJECTS'),
    isPrimitive = require('./isPrimitive'),
    classChecks = require('../var/classChecks'),
    forceStringCoercion = require('./forceStringCoercion');

var isString = classChecks.isString;

function coercePrimitiveToObject(obj) {
  if (isPrimitive(obj)) {
    obj = Object(obj);
  }
  if (NO_KEYS_IN_STRING_OBJECTS && isString(obj)) {
    forceStringCoercion(obj);
  }
  return obj;
}

module.exports = coercePrimitiveToObject;
},{"../var/NO_KEYS_IN_STRING_OBJECTS":185,"../var/classChecks":192,"./forceStringCoercion":130,"./isPrimitive":153}],112:[function(require,module,exports){
'use strict';

var forEach = require('./forEach'),
    spaceSplit = require('./spaceSplit'),
    classChecks = require('../var/classChecks');

var isString = classChecks.isString;

function collectSimilarMethods(set, fn) {
  var methods = {};
  if (isString(set)) {
    set = spaceSplit(set);
  }
  forEach(set, function(el, i) {
    fn(methods, el, i);
  });
  return methods;
}

module.exports = collectSimilarMethods;
},{"../var/classChecks":192,"./forEach":129,"./spaceSplit":175}],113:[function(require,module,exports){
'use strict';

var CommonChars = require('../var/CommonChars');

var HALF_WIDTH_COMMA = CommonChars.HALF_WIDTH_COMMA;

function commaSplit(str) {
  return str.split(HALF_WIDTH_COMMA);
}

module.exports = commaSplit;
},{"../var/CommonChars":180}],114:[function(require,module,exports){
'use strict';

var STRING_FORMAT_REG = require('../var/STRING_FORMAT_REG'),
    CommonChars = require('../var/CommonChars'),
    memoizeFunction = require('./memoizeFunction');

var OPEN_BRACE = CommonChars.OPEN_BRACE,
    CLOSE_BRACE = CommonChars.CLOSE_BRACE;

function createFormatMatcher(bracketMatcher, percentMatcher, precheck) {

  var reg = STRING_FORMAT_REG;
  var compileMemoized = memoizeFunction(compile);

  function getToken(format, match) {
    var get, token, literal, fn;
    var bKey = match[2];
    var pLit = match[3];
    var pKey = match[5];
    if (match[4] && percentMatcher) {
      token = pKey;
      get = percentMatcher;
    } else if (bKey) {
      token = bKey;
      get = bracketMatcher;
    } else if (pLit && percentMatcher) {
      literal = pLit;
    } else {
      literal = match[1] || match[0];
    }
    if (get) {
      assertPassesPrecheck(precheck, bKey, pKey);
      fn = function(obj, opt) {
        return get(obj, token, opt);
      };
    }
    format.push(fn || getLiteral(literal));
  }

  function getSubstring(format, str, start, end) {
    if (end > start) {
      var sub = str.slice(start, end);
      assertNoUnmatched(sub, OPEN_BRACE);
      assertNoUnmatched(sub, CLOSE_BRACE);
      format.push(function() {
        return sub;
      });
    }
  }

  function getLiteral(str) {
    return function() {
      return str;
    };
  }

  function assertPassesPrecheck(precheck, bt, pt) {
    if (precheck && !precheck(bt, pt)) {
      throw new TypeError('Invalid token '+ (bt || pt) +' in format string');
    }
  }

  function assertNoUnmatched(str, chr) {
    if (str.indexOf(chr) !== -1) {
      throw new TypeError('Unmatched '+ chr +' in format string');
    }
  }

  function compile(str) {
    var format = [], lastIndex = 0, match;
    reg.lastIndex = 0;
    while(match = reg.exec(str)) {
      getSubstring(format, str, lastIndex, match.index);
      getToken(format, match);
      lastIndex = reg.lastIndex;
    }
    getSubstring(format, str, lastIndex, str.length);
    return format;
  }

  return function(str, obj, opt) {
    var format = compileMemoized(str), result = '';
    for (var i = 0; i < format.length; i++) {
      result += format[i](obj, opt);
    }
    return result;
  };
}

module.exports = createFormatMatcher;
},{"../var/CommonChars":180,"../var/STRING_FORMAT_REG":188,"./memoizeFunction":161}],115:[function(require,module,exports){
'use strict';

function dateMatcher(d) {
  var ms = d.getTime();
  return function(el) {
    return !!(el && el.getTime) && el.getTime() === ms;
  };
}

module.exports = dateMatcher;
},{}],116:[function(require,module,exports){
'use strict';

var handleDeepProperty = require('./handleDeepProperty');

function deepGetProperty(obj, key, any) {
  return handleDeepProperty(obj, key, any, false);
}

module.exports = deepGetProperty;
},{"./handleDeepProperty":142}],117:[function(require,module,exports){
'use strict';

var handleDeepProperty = require('./handleDeepProperty');

function deepHasProperty(obj, key, any) {
  return handleDeepProperty(obj, key, any, true);
}

module.exports = deepHasProperty;
},{"./handleDeepProperty":142}],118:[function(require,module,exports){
'use strict';

var handleDeepProperty = require('./handleDeepProperty');

function deepSetProperty(obj, key, val) {
  handleDeepProperty(obj, key, false, false, true, false, val);
  return obj;
}

module.exports = deepSetProperty;
},{"./handleDeepProperty":142}],119:[function(require,module,exports){
'use strict';

var isEqual = require('./isEqual');

function defaultMatcher(f) {
  return function(el) {
    return isEqual(el, f);
  };
}

module.exports = defaultMatcher;
},{"./isEqual":150}],120:[function(require,module,exports){
'use strict';

var coreUtilityAliases = require('../var/coreUtilityAliases');

var setProperty = coreUtilityAliases.setProperty;

function defineAccessor(namespace, name, fn) {
  setProperty(namespace, name, fn);
}

module.exports = defineAccessor;
},{"../var/coreUtilityAliases":193}],121:[function(require,module,exports){
'use strict';

var methodDefineAliases = require('../var/methodDefineAliases'),
    collectSimilarMethods = require('./collectSimilarMethods');

var defineInstanceAndStatic = methodDefineAliases.defineInstanceAndStatic;

function defineInstanceAndStaticSimilar(sugarNamespace, set, fn, flags) {
  defineInstanceAndStatic(sugarNamespace, collectSimilarMethods(set, fn), flags);
}

module.exports = defineInstanceAndStaticSimilar;
},{"../var/methodDefineAliases":196,"./collectSimilarMethods":112}],122:[function(require,module,exports){
'use strict';

var methodDefineAliases = require('../var/methodDefineAliases'),
    collectSimilarMethods = require('./collectSimilarMethods');

var defineInstance = methodDefineAliases.defineInstance;

function defineInstanceSimilar(sugarNamespace, set, fn, flags) {
  defineInstance(sugarNamespace, collectSimilarMethods(set, fn), flags);
}

module.exports = defineInstanceSimilar;
},{"../var/methodDefineAliases":196,"./collectSimilarMethods":112}],123:[function(require,module,exports){
'use strict';

var coreUtilityAliases = require('../var/coreUtilityAliases');

var forEachProperty = coreUtilityAliases.forEachProperty;

function defineOnPrototype(ctor, methods) {
  var proto = ctor.prototype;
  forEachProperty(methods, function(val, key) {
    proto[key] = val;
  });
}

module.exports = defineOnPrototype;
},{"../var/coreUtilityAliases":193}],124:[function(require,module,exports){
'use strict';

var simpleClone = require('./simpleClone'),
    defineAccessor = require('./defineAccessor'),
    coreUtilityAliases = require('../var/coreUtilityAliases');

var forEachProperty = coreUtilityAliases.forEachProperty;

function defineOptionsAccessor(namespace, defaults) {
  var obj = simpleClone(defaults);

  function getOption(name) {
    return obj[name];
  }

  function setOption(arg1, arg2) {
    var options;
    if (arguments.length === 1) {
      options = arg1;
    } else {
      options = {};
      options[arg1] = arg2;
    }
    forEachProperty(options, function(val, name) {
      if (val === null) {
        val = defaults[name];
      }
      obj[name] = val;
    });
  }

  defineAccessor(namespace, 'getOption', getOption);
  defineAccessor(namespace, 'setOption', setOption);
  return getOption;
}

module.exports = defineOptionsAccessor;
},{"../var/coreUtilityAliases":193,"./defineAccessor":120,"./simpleClone":172}],125:[function(require,module,exports){
'use strict';

var getNormalizedIndex = require('./getNormalizedIndex');

function entryAtIndex(obj, index, length, loop, isString) {
  index = getNormalizedIndex(index, length, loop);
  return isString ? obj.charAt(index) : obj[index];
}

module.exports = entryAtIndex;
},{"./getNormalizedIndex":137}],126:[function(require,module,exports){
'use strict';

var classChecks = require('../var/classChecks');

var isString = classChecks.isString;

function escapeRegExp(str) {
  if (!isString(str)) str = String(str);
  return str.replace(/([\\\/\'*+?|()\[\]{}.^$-])/g,'\\$1');
}

module.exports = escapeRegExp;
},{"../var/classChecks":192}],127:[function(require,module,exports){
'use strict';

function filter(arr, fn) {
  var result = [];
  for (var i = 0, len = arr.length; i < len; i++) {
    var el = arr[i];
    if (i in arr && fn(el, i)) {
      result.push(el);
    }
  }
  return result;
}

module.exports = filter;
},{}],128:[function(require,module,exports){
'use strict';

function fixArgumentLength(fn) {
  var staticFn = function(a) {
    var args = arguments;
    return fn(a, args[1], args[2], args.length - 1);
  };
  staticFn.instance = function(b) {
    var args = arguments;
    return fn(this, b, args[1], args.length);
  };
  return staticFn;
}

module.exports = fixArgumentLength;
},{}],129:[function(require,module,exports){
'use strict';

var iterateOverSparseArray = require('./iterateOverSparseArray');

function forEach(arr, fn) {
  for (var i = 0, len = arr.length; i < len; i++) {
    if (!(i in arr)) {
      return iterateOverSparseArray(arr, fn, i);
    }
    fn(arr[i], i);
  }
}

module.exports = forEach;
},{"./iterateOverSparseArray":156}],130:[function(require,module,exports){
'use strict';

function forceStringCoercion(obj) {
  var i = 0, chr;
  while (chr = obj.charAt(i)) {
    obj[i++] = chr;
  }
}

module.exports = forceStringCoercion;
},{}],131:[function(require,module,exports){
'use strict';

function functionMatcher(fn) {
  return function(el, i, arr) {
    // Return true up front if match by reference
    return el === fn || fn.call(arr, el, i, arr);
  };
}

module.exports = functionMatcher;
},{}],132:[function(require,module,exports){
'use strict';

var Inflections = require('../var/Inflections');

function getAcronym(str) {
  return Inflections.acronyms && Inflections.acronyms.find(str);
}

module.exports = getAcronym;
},{"../var/Inflections":183}],133:[function(require,module,exports){
'use strict';

var forEach = require('./forEach'),
    classChecks = require('../var/classChecks'),
    entryAtIndex = require('./entryAtIndex');

var isArray = classChecks.isArray;

function getEntriesForIndexes(obj, find, loop, isString) {
  var result, length = obj.length;
  if (!isArray(find)) {
    return entryAtIndex(obj, find, length, loop, isString);
  }
  result = new Array(find.length);
  forEach(find, function(index, i) {
    result[i] = entryAtIndex(obj, index, length, loop, isString);
  });
  return result;
}

module.exports = getEntriesForIndexes;
},{"../var/classChecks":192,"./entryAtIndex":125,"./forEach":129}],134:[function(require,module,exports){
'use strict';

var Inflections = require('../var/Inflections');

function getHumanWord(str) {
  return Inflections.human && Inflections.human.find(str);
}

module.exports = getHumanWord;
},{"../var/Inflections":183}],135:[function(require,module,exports){
'use strict';

function getKeys(obj) {
  return Object.keys(obj);
}

module.exports = getKeys;
},{}],136:[function(require,module,exports){
'use strict';

var isPrimitive = require('./isPrimitive'),
    classChecks = require('../var/classChecks'),
    dateMatcher = require('./dateMatcher'),
    regexMatcher = require('./regexMatcher'),
    isObjectType = require('./isObjectType'),
    isPlainObject = require('./isPlainObject'),
    defaultMatcher = require('./defaultMatcher'),
    functionMatcher = require('./functionMatcher'),
    coreUtilityAliases = require('../var/coreUtilityAliases');

var getOwn = coreUtilityAliases.getOwn,
    classToString = coreUtilityAliases.classToString,
    forEachProperty = coreUtilityAliases.forEachProperty,
    isDate = classChecks.isDate,
    isRegExp = classChecks.isRegExp,
    isFunction = classChecks.isFunction;

function getMatcher(f) {
  if (!isPrimitive(f)) {
    var className = classToString(f);
    if (isRegExp(f, className)) {
      return regexMatcher(f);
    } else if (isDate(f, className)) {
      return dateMatcher(f);
    } else if (isFunction(f, className)) {
      return functionMatcher(f);
    } else if (isPlainObject(f, className)) {
      return fuzzyMatcher(f);
    }
  }
  // Default is standard isEqual
  return defaultMatcher(f);
}

function fuzzyMatcher(obj) {
  var matchers = {};
  return function(el, i, arr) {
    var matched = true;
    if (!isObjectType(el)) {
      return false;
    }
    forEachProperty(obj, function(val, key) {
      matchers[key] = getOwn(matchers, key) || getMatcher(val);
      if (matchers[key].call(arr, el[key], i, arr) === false) {
        matched = false;
      }
      return matched;
    });
    return matched;
  };
}

module.exports = getMatcher;
},{"../var/classChecks":192,"../var/coreUtilityAliases":193,"./dateMatcher":115,"./defaultMatcher":119,"./functionMatcher":131,"./isObjectType":151,"./isPlainObject":152,"./isPrimitive":153,"./regexMatcher":165}],137:[function(require,module,exports){
'use strict';

function getNormalizedIndex(index, length, loop) {
  if (index && loop) {
    index = index % length;
  }
  if (index < 0) index = length + index;
  return index;
}

module.exports = getNormalizedIndex;
},{}],138:[function(require,module,exports){
'use strict';

function getOrdinalSuffix(num) {
  if (num >= 11 && num <= 13) {
    return 'th';
  } else {
    switch(num % 10) {
      case 1:  return 'st';
      case 2:  return 'nd';
      case 3:  return 'rd';
      default: return 'th';
    }
  }
}

module.exports = getOrdinalSuffix;
},{}],139:[function(require,module,exports){
'use strict';

var coreUtilityAliases = require('../var/coreUtilityAliases');

var hasOwn = coreUtilityAliases.hasOwn;

function getOwnKey(obj, key) {
  if (hasOwn(obj, key)) {
    return key;
  }
}

module.exports = getOwnKey;
},{"../var/coreUtilityAliases":193}],140:[function(require,module,exports){
'use strict';

function getRegExpFlags(reg, add) {
  var flags = '';
  add = add || '';
  function checkFlag(prop, flag) {
    if (prop || add.indexOf(flag) > -1) {
      flags += flag;
    }
  }
  checkFlag(reg.global, 'g');
  checkFlag(reg.ignoreCase, 'i');
  checkFlag(reg.multiline, 'm');
  checkFlag(reg.sticky, 'y');
  return flags;
}

module.exports = getRegExpFlags;
},{}],141:[function(require,module,exports){
'use strict';

var isArrayIndex = require('./isArrayIndex');

function getSparseArrayIndexes(arr, fromIndex, loop, fromRight) {
  var indexes = [], i;
  for (i in arr) {
    if (isArrayIndex(i) && (loop || (fromRight ? i <= fromIndex : i >= fromIndex))) {
      indexes.push(+i);
    }
  }
  indexes.sort(function(a, b) {
    var aLoop = a > fromIndex;
    var bLoop = b > fromIndex;
    if (aLoop !== bLoop) {
      return aLoop ? -1 : 1;
    }
    return a - b;
  });
  return indexes;
}

module.exports = getSparseArrayIndexes;
},{"./isArrayIndex":147}],142:[function(require,module,exports){
'use strict';

var PROPERTY_RANGE_REG = require('../var/PROPERTY_RANGE_REG'),
    CommonChars = require('../var/CommonChars'),
    isDefined = require('./isDefined'),
    classChecks = require('../var/classChecks'),
    periodSplit = require('./periodSplit'),
    assertArray = require('./assertArray'),
    isObjectType = require('./isObjectType'),
    assertWritable = require('./assertWritable'),
    coreUtilityAliases = require('../var/coreUtilityAliases');

var isString = classChecks.isString,
    hasOwn = coreUtilityAliases.hasOwn,
    HALF_WIDTH_PERIOD = CommonChars.HALF_WIDTH_PERIOD;

function handleDeepProperty(obj, key, any, has, fill, fillLast, val) {
  var ns, bs, ps, cbi, set, isLast, isPush, isIndex, nextIsIndex, exists;
  ns = obj || undefined;
  if (key == null) return;

  if (isObjectType(key)) {
    // Allow array and array-like accessors
    bs = [key];
  } else {
    key = String(key);
    if (key.indexOf('..') !== -1) {
      return handleArrayIndexRange(obj, key, any, val);
    }
    bs = key.split('[');
  }

  set = isDefined(val);

  for (var i = 0, blen = bs.length; i < blen; i++) {
    ps = bs[i];

    if (isString(ps)) {
      ps = periodSplit(ps);
    }

    for (var j = 0, plen = ps.length; j < plen; j++) {
      key = ps[j];

      // Is this the last key?
      isLast = i === blen - 1 && j === plen - 1;

      // Index of the closing ]
      cbi = key.indexOf(']');

      // Is the key an array index?
      isIndex = cbi !== -1;

      // Is this array push syntax "[]"?
      isPush = set && cbi === 0;

      // If the bracket split was successful and this is the last element
      // in the dot split, then we know the next key will be an array index.
      nextIsIndex = blen > 1 && j === plen - 1;

      if (isPush) {
        // Set the index to the end of the array
        key = ns.length;
      } else if (isIndex) {
        // Remove the closing ]
        key = key.slice(0, -1);
      }

      // If the array index is less than 0, then
      // add its length to allow negative indexes.
      if (isIndex && key < 0) {
        key = +key + ns.length;
      }

      // Bracket keys may look like users[5] or just [5], so the leading
      // characters are optional. We can enter the namespace if this is the
      // 2nd part, if there is only 1 part, or if there is an explicit key.
      if (i || key || blen === 1) {

        exists = any ? key in ns : hasOwn(ns, key);

        // Non-existent namespaces are only filled if they are intermediate
        // (not at the end) or explicitly filling the last.
        if (fill && (!isLast || fillLast) && !exists) {
          // For our purposes, last only needs to be an array.
          ns = ns[key] = nextIsIndex || (fillLast && isLast) ? [] : {};
          continue;
        }

        if (has) {
          if (isLast || !exists) {
            return exists;
          }
        } else if (set && isLast) {
          assertWritable(ns);
          ns[key] = val;
        }

        ns = exists ? ns[key] : undefined;
      }

    }
  }
  return ns;
}

function handleArrayIndexRange(obj, key, any, val) {
  var match, start, end, leading, trailing, arr, set;
  match = key.match(PROPERTY_RANGE_REG);
  if (!match) {
    return;
  }

  set = isDefined(val);
  leading = match[1];

  if (leading) {
    arr = handleDeepProperty(obj, leading, any, false, set ? true : false, true);
  } else {
    arr = obj;
  }

  assertArray(arr);

  trailing = match[4];
  start    = match[2] ? +match[2] : 0;
  end      = match[3] ? +match[3] : arr.length;

  // A range of 0..1 is inclusive, so we need to add 1 to the end. If this
  // pushes the index from -1 to 0, then set it to the full length of the
  // array, otherwise it will return nothing.
  end = end === -1 ? arr.length : end + 1;

  if (set) {
    for (var i = start; i < end; i++) {
      handleDeepProperty(arr, i + trailing, any, false, true, false, val);
    }
  } else {
    arr = arr.slice(start, end);

    // If there are trailing properties, then they need to be mapped for each
    // element in the array.
    if (trailing) {
      if (trailing.charAt(0) === HALF_WIDTH_PERIOD) {
        // Need to chomp the period if one is trailing after the range. We
        // can't do this at the regex level because it will be required if
        // we're setting the value as it needs to be concatentated together
        // with the array index to be set.
        trailing = trailing.slice(1);
      }
      return arr.map(function(el) {
        return handleDeepProperty(el, trailing);
      });
    }
  }
  return arr;
}

module.exports = handleDeepProperty;
},{"../var/CommonChars":180,"../var/PROPERTY_RANGE_REG":187,"../var/classChecks":192,"../var/coreUtilityAliases":193,"./assertArray":105,"./assertWritable":107,"./isDefined":149,"./isObjectType":151,"./periodSplit":163}],143:[function(require,module,exports){
'use strict';

var coreUtilityAliases = require('../var/coreUtilityAliases');

var hasOwn = coreUtilityAliases.hasOwn;

function hasOwnEnumeratedProperties(obj) {
  // Plain objects are generally defined as having enumerated properties
  // all their own, however in early IE environments without defineProperty,
  // there may also be enumerated methods in the prototype chain, so check
  // for both of these cases.
  var objectProto = Object.prototype;
  for (var key in obj) {
    var val = obj[key];
    if (!hasOwn(obj, key) && val !== objectProto[key]) {
      return false;
    }
  }
  return true;
}

module.exports = hasOwnEnumeratedProperties;
},{"../var/coreUtilityAliases":193}],144:[function(require,module,exports){
'use strict';

var isPrimitive = require('./isPrimitive');

function hasProperty(obj, prop) {
  return !isPrimitive(obj) && prop in obj;
}

module.exports = hasProperty;
},{"./isPrimitive":153}],145:[function(require,module,exports){
'use strict';

var coreUtilityAliases = require('../var/coreUtilityAliases');

var hasOwn = coreUtilityAliases.hasOwn;

function hasValidPlainObjectPrototype(obj) {
  var hasToString = 'toString' in obj;
  var hasConstructor = 'constructor' in obj;
  // An object created with Object.create(null) has no methods in the
  // prototype chain, so check if any are missing. The additional hasToString
  // check is for false positives on some host objects in old IE which have
  // toString but no constructor. If the object has an inherited constructor,
  // then check if it is Object (the "isPrototypeOf" tapdance here is a more
  // robust way of ensuring this if the global has been hijacked). Note that
  // accessing the constructor directly (without "in" or "hasOwnProperty")
  // will throw a permissions error in IE8 on cross-domain windows.
  return (!hasConstructor && !hasToString) ||
          (hasConstructor && !hasOwn(obj, 'constructor') &&
           hasOwn(obj.constructor.prototype, 'isPrototypeOf'));
}

module.exports = hasValidPlainObjectPrototype;
},{"../var/coreUtilityAliases":193}],146:[function(require,module,exports){
'use strict';

function indexOf(arr, el) {
  for (var i = 0, len = arr.length; i < len; i++) {
    if (i in arr && arr[i] === el) return i;
  }
  return -1;
}

module.exports = indexOf;
},{}],147:[function(require,module,exports){
'use strict';

function isArrayIndex(n) {
  return n >>> 0 == n && n != 0xFFFFFFFF;
}

module.exports = isArrayIndex;
},{}],148:[function(require,module,exports){
'use strict';

var coreUtilityAliases = require('../var/coreUtilityAliases');

var classToString = coreUtilityAliases.classToString;

function isClass(obj, className, str) {
  if (!str) {
    str = classToString(obj);
  }
  return str === '[object '+ className +']';
}

module.exports = isClass;
},{"../var/coreUtilityAliases":193}],149:[function(require,module,exports){
'use strict';

function isDefined(o) {
  return o !== undefined;
}

module.exports = isDefined;
},{}],150:[function(require,module,exports){
'use strict';

var getKeys = require('./getKeys'),
    setToArray = require('./setToArray'),
    mapToArray = require('./mapToArray'),
    classChecks = require('../var/classChecks'),
    isObjectType = require('./isObjectType'),
    coreUtilityAliases = require('../var/coreUtilityAliases'),
    iterateWithCyclicCheck = require('./iterateWithCyclicCheck');

var classToString = coreUtilityAliases.classToString,
    isSerializable = classChecks.isSerializable,
    isSet = classChecks.isSet,
    isMap = classChecks.isMap,
    isError = classChecks.isError;

function isEqual(a, b, stack) {
  var aClass, bClass;
  if (a === b) {
    // Return quickly up front when matched by reference,
    // but be careful about 0 !== -0.
    return a !== 0 || 1 / a === 1 / b;
  }
  aClass = classToString(a);
  bClass = classToString(b);
  if (aClass !== bClass) {
    return false;
  }

  if (isSerializable(a, aClass) && isSerializable(b, bClass)) {
    return objectIsEqual(a, b, aClass, stack);
  } else if (isSet(a, aClass) && isSet(b, bClass)) {
    return a.size === b.size && isEqual(setToArray(a), setToArray(b), stack);
  } else if (isMap(a, aClass) && isMap(b, bClass)) {
    return a.size === b.size && isEqual(mapToArray(a), mapToArray(b), stack);
  } else if (isError(a, aClass) && isError(b, bClass)) {
    return a.toString() === b.toString();
  }

  return false;
}

function objectIsEqual(a, b, aClass, stack) {
  var aType = typeof a, bType = typeof b, propsEqual, count;
  if (aType !== bType) {
    return false;
  }
  if (isObjectType(a.valueOf())) {
    if (a.length !== b.length) {
      // perf: Quickly returning up front for arrays.
      return false;
    }
    count = 0;
    propsEqual = true;
    iterateWithCyclicCheck(a, false, stack, function(key, val, cyc, stack) {
      if (!cyc && (!(key in b) || !isEqual(val, b[key], stack))) {
        propsEqual = false;
      }
      count++;
      return propsEqual;
    });
    if (!propsEqual || count !== getKeys(b).length) {
      return false;
    }
  }
  // Stringifying the value handles NaN, wrapped primitives, dates, and errors in one go.
  return a.valueOf().toString() === b.valueOf().toString();
}

module.exports = isEqual;
},{"../var/classChecks":192,"../var/coreUtilityAliases":193,"./getKeys":135,"./isObjectType":151,"./iterateWithCyclicCheck":157,"./mapToArray":159,"./setToArray":170}],151:[function(require,module,exports){
'use strict';

function isObjectType(obj, type) {
  return !!obj && (type || typeof obj) === 'object';
}

module.exports = isObjectType;
},{}],152:[function(require,module,exports){
'use strict';

var isClass = require('./isClass'),
    isObjectType = require('./isObjectType'),
    hasOwnEnumeratedProperties = require('./hasOwnEnumeratedProperties'),
    hasValidPlainObjectPrototype = require('./hasValidPlainObjectPrototype');

function isPlainObject(obj, className) {
  return isObjectType(obj) &&
         isClass(obj, 'Object', className) &&
         hasValidPlainObjectPrototype(obj) &&
         hasOwnEnumeratedProperties(obj);
}

module.exports = isPlainObject;
},{"./hasOwnEnumeratedProperties":143,"./hasValidPlainObjectPrototype":145,"./isClass":148,"./isObjectType":151}],153:[function(require,module,exports){
'use strict';

function isPrimitive(obj, type) {
  type = type || typeof obj;
  return obj == null || type === 'string' || type === 'number' || type === 'boolean';
}

module.exports = isPrimitive;
},{}],154:[function(require,module,exports){
'use strict';

function isRealNaN(obj) {
  // This is only true of NaN
  return obj != null && obj !== obj;
}

module.exports = isRealNaN;
},{}],155:[function(require,module,exports){
'use strict';

function isUndefined(o) {
  return o === undefined;
}

module.exports = isUndefined;
},{}],156:[function(require,module,exports){
'use strict';

var getSparseArrayIndexes = require('./getSparseArrayIndexes');

function iterateOverSparseArray(arr, fn, fromIndex, loop) {
  var indexes = getSparseArrayIndexes(arr, fromIndex, loop), index;
  for (var i = 0, len = indexes.length; i < len; i++) {
    index = indexes[i];
    fn.call(arr, arr[index], index, arr);
  }
  return arr;
}

module.exports = iterateOverSparseArray;
},{"./getSparseArrayIndexes":141}],157:[function(require,module,exports){
'use strict';

var getKeys = require('./getKeys'),
    coreUtilityAliases = require('../var/coreUtilityAliases');

var forEachProperty = coreUtilityAliases.forEachProperty;

function iterateWithCyclicCheck(obj, sortedKeys, stack, fn) {

  function next(val, key) {
    var cyc = false;

    // Allowing a step into the structure before triggering this check to save
    // cycles on standard JSON structures and also to try as hard as possible to
    // catch basic properties that may have been modified.
    if (stack.length > 1) {
      var i = stack.length;
      while (i--) {
        if (stack[i] === val) {
          cyc = true;
        }
      }
    }

    stack.push(val);
    fn(key, val, cyc, stack);
    stack.pop();
  }

  function iterateWithSortedKeys() {
    // Sorted keys is required for serialization, where object order
    // does not matter but stringified order does.
    var arr = getKeys(obj).sort(), key;
    for (var i = 0; i < arr.length; i++) {
      key = arr[i];
      next(obj[key], arr[i]);
    }
  }

  // This method for checking for cyclic structures was egregiously stolen from
  // the ingenious method by @kitcambridge from the Underscore script:
  // https://github.com/documentcloud/underscore/issues/240
  if (!stack) {
    stack = [];
  }

  if (sortedKeys) {
    iterateWithSortedKeys();
  } else {
    forEachProperty(obj, next);
  }
}

module.exports = iterateWithCyclicCheck;
},{"../var/coreUtilityAliases":193,"./getKeys":135}],158:[function(require,module,exports){
'use strict';

function map(arr, fn) {
  // perf: Not using fixed array len here as it may be sparse.
  var result = [];
  for (var i = 0, len = arr.length; i < len; i++) {
    if (i in arr) {
      result.push(fn(arr[i], i));
    }
  }
  return result;
}

module.exports = map;
},{}],159:[function(require,module,exports){
'use strict';

function mapToArray(map) {
  var arr = new Array(map.size), i = 0;
  map.forEach(function(val, key) {
    arr[i++] = [key, val];
  });
  return arr;
}

module.exports = mapToArray;
},{}],160:[function(require,module,exports){
'use strict';

var classChecks = require('../var/classChecks'),
    deepGetProperty = require('./deepGetProperty');

var isFunction = classChecks.isFunction,
    isArray = classChecks.isArray;

function mapWithShortcuts(el, f, context, mapArgs) {
  if (!f) {
    return el;
  } else if (f.apply) {
    return f.apply(context, mapArgs || []);
  } else if (isArray(f)) {
    return f.map(function(m) {
      return mapWithShortcuts(el, m, context, mapArgs);
    });
  } else if (isFunction(el[f])) {
    return el[f].call(el);
  } else {
    return deepGetProperty(el, f);
  }
}

module.exports = mapWithShortcuts;
},{"../var/classChecks":192,"./deepGetProperty":116}],161:[function(require,module,exports){
'use strict';

var INTERNAL_MEMOIZE_LIMIT = require('../var/INTERNAL_MEMOIZE_LIMIT'),
    coreUtilityAliases = require('../var/coreUtilityAliases');

var hasOwn = coreUtilityAliases.hasOwn;

function memoizeFunction(fn) {
  var memo = {}, counter = 0;

  return function(key) {
    if (hasOwn(memo, key)) {
      return memo[key];
    }
    if (counter === INTERNAL_MEMOIZE_LIMIT) {
      memo = {};
      counter = 0;
    }
    counter++;
    return memo[key] = fn(key);
  };
}

module.exports = memoizeFunction;
},{"../var/INTERNAL_MEMOIZE_LIMIT":182,"../var/coreUtilityAliases":193}],162:[function(require,module,exports){
'use strict';

var mathAliases = require('../var/mathAliases'),
    repeatString = require('./repeatString');

var abs = mathAliases.abs;

function padNumber(num, place, sign, base, replacement) {
  var str = abs(num).toString(base || 10);
  str = repeatString(replacement || '0', place - str.replace(/\.\d+/, '').length) + str;
  if (sign || num < 0) {
    str = (num < 0 ? '-' : '+') + str;
  }
  return str;
}

module.exports = padNumber;
},{"../var/mathAliases":195,"./repeatString":166}],163:[function(require,module,exports){
'use strict';

var CommonChars = require('../var/CommonChars');

var HALF_WIDTH_PERIOD = CommonChars.HALF_WIDTH_PERIOD;

function periodSplit(str) {
  return str.split(HALF_WIDTH_PERIOD);
}

module.exports = periodSplit;
},{"../var/CommonChars":180}],164:[function(require,module,exports){
'use strict';

var PRIVATE_PROP_PREFIX = require('../var/PRIVATE_PROP_PREFIX'),
    coreUtilityAliases = require('../var/coreUtilityAliases');

var setProperty = coreUtilityAliases.setProperty;

function privatePropertyAccessor(key) {
  var privateKey = PRIVATE_PROP_PREFIX + key;
  return function(obj, val) {
    if (arguments.length > 1) {
      setProperty(obj, privateKey, val);
      return obj;
    }
    return obj[privateKey];
  };
}

module.exports = privatePropertyAccessor;
},{"../var/PRIVATE_PROP_PREFIX":186,"../var/coreUtilityAliases":193}],165:[function(require,module,exports){
'use strict';

function regexMatcher(reg) {
  reg = RegExp(reg);
  return function(el) {
    return reg.test(el);
  };
}

module.exports = regexMatcher;
},{}],166:[function(require,module,exports){
'use strict';

function repeatString(str, num) {
  var result = '';
  str = str.toString();
  while (num > 0) {
    if (num & 1) {
      result += str;
    }
    if (num >>= 1) {
      str += str;
    }
  }
  return result;
}

module.exports = repeatString;
},{}],167:[function(require,module,exports){
'use strict';

var Inflections = require('../var/Inflections');

function runHumanRules(str) {
  return Inflections.human && Inflections.human.runRules(str) || str;
}

module.exports = runHumanRules;
},{"../var/Inflections":183}],168:[function(require,module,exports){
'use strict';

var indexOf = require('./indexOf'),
    isRealNaN = require('./isRealNaN'),
    isPrimitive = require('./isPrimitive'),
    classChecks = require('../var/classChecks'),
    isObjectType = require('./isObjectType'),
    coreUtilityAliases = require('../var/coreUtilityAliases'),
    iterateWithCyclicCheck = require('./iterateWithCyclicCheck');

var classToString = coreUtilityAliases.classToString,
    isSerializable = classChecks.isSerializable;

function serializeInternal(obj, refs, stack) {
  var type = typeof obj, className, value, ref;

  // Return quickly for primitives to save cycles
  if (isPrimitive(obj, type) && !isRealNaN(obj)) {
    return type + obj;
  }

  className = classToString(obj);

  if (!isSerializable(obj, className)) {
    ref = indexOf(refs, obj);
    if (ref === -1) {
      ref = refs.length;
      refs.push(obj);
    }
    return ref;
  } else if (isObjectType(obj)) {
    value = serializeDeep(obj, refs, stack) + obj.toString();
  } else if (1 / obj === -Infinity) {
    value = '-0';
  } else if (obj.valueOf) {
    value = obj.valueOf();
  }
  return type + className + value;
}

function serializeDeep(obj, refs, stack) {
  var result = '';
  iterateWithCyclicCheck(obj, true, stack, function(key, val, cyc, stack) {
    result += cyc ? 'CYC' : key + serializeInternal(val, refs, stack);
  });
  return result;
}

module.exports = serializeInternal;
},{"../var/classChecks":192,"../var/coreUtilityAliases":193,"./indexOf":146,"./isObjectType":151,"./isPrimitive":153,"./isRealNaN":154,"./iterateWithCyclicCheck":157}],169:[function(require,module,exports){
'use strict';

function setChainableConstructor(sugarNamespace, createFn) {
  sugarNamespace.prototype.constructor = function() {
    return createFn.apply(this, arguments);
  };
}

module.exports = setChainableConstructor;
},{}],170:[function(require,module,exports){
'use strict';

function setToArray(set) {
  var arr = new Array(set.size), i = 0;
  set.forEach(function(val) {
    arr[i++] = val;
  });
  return arr;
}

module.exports = setToArray;
},{}],171:[function(require,module,exports){
'use strict';

function simpleCapitalize(str) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

module.exports = simpleCapitalize;
},{}],172:[function(require,module,exports){
'use strict';

var simpleMerge = require('./simpleMerge');

function simpleClone(obj) {
  return simpleMerge({}, obj);
}

module.exports = simpleClone;
},{"./simpleMerge":173}],173:[function(require,module,exports){
'use strict';

var coreUtilityAliases = require('../var/coreUtilityAliases');

var forEachProperty = coreUtilityAliases.forEachProperty;

function simpleMerge(target, source) {
  forEachProperty(source, function(val, key) {
    target[key] = val;
  });
  return target;
}

module.exports = simpleMerge;
},{"../var/coreUtilityAliases":193}],174:[function(require,module,exports){
'use strict';

function simpleRepeat(n, fn) {
  for (var i = 0; i < n; i++) {
    fn(i);
  }
}

module.exports = simpleRepeat;
},{}],175:[function(require,module,exports){
'use strict';

function spaceSplit(str) {
  return str.split(' ');
}

module.exports = spaceSplit;
},{}],176:[function(require,module,exports){
'use strict';

var CommonChars = require('../var/CommonChars'),
    coreUtilityAliases = require('../var/coreUtilityAliases'),
    fullwidthNumberHelpers = require('../var/fullwidthNumberHelpers');

var fullWidthNumberReg = fullwidthNumberHelpers.fullWidthNumberReg,
    fullWidthNumberMap = fullwidthNumberHelpers.fullWidthNumberMap,
    getOwn = coreUtilityAliases.getOwn,
    HALF_WIDTH_PERIOD = CommonChars.HALF_WIDTH_PERIOD;

function stringToNumber(str, base) {
  var sanitized, isDecimal;
  sanitized = str.replace(fullWidthNumberReg, function(chr) {
    var replacement = getOwn(fullWidthNumberMap, chr);
    if (replacement === HALF_WIDTH_PERIOD) {
      isDecimal = true;
    }
    return replacement;
  });
  return isDecimal ? parseFloat(sanitized) : parseInt(sanitized, base || 10);
}

module.exports = stringToNumber;
},{"../var/CommonChars":180,"../var/coreUtilityAliases":193,"../var/fullwidthNumberHelpers":194}],177:[function(require,module,exports){
'use strict';

function trim(str) {
  return str.trim();
}

module.exports = trim;
},{}],178:[function(require,module,exports){
'use strict';

var mathAliases = require('../var/mathAliases');

var abs = mathAliases.abs,
    pow = mathAliases.pow,
    round = mathAliases.round;

function withPrecision(val, precision, fn) {
  var multiplier = pow(10, abs(precision || 0));
  fn = fn || round;
  if (precision < 0) multiplier = 1 / multiplier;
  return fn(val * multiplier) / multiplier;
}

module.exports = withPrecision;
},{"../var/mathAliases":195}],179:[function(require,module,exports){
'use strict';

function wrapNamespace(method) {
  return function(sugarNamespace, arg1, arg2) {
    sugarNamespace[method](arg1, arg2);
  };
}

module.exports = wrapNamespace;
},{}],180:[function(require,module,exports){
'use strict';

module.exports = {
  HALF_WIDTH_ZERO: 0x30,
  FULL_WIDTH_ZERO: 0xff10,
  HALF_WIDTH_PERIOD: '.',
  FULL_WIDTH_PERIOD: '．',
  HALF_WIDTH_COMMA: ',',
  OPEN_BRACE: '{',
  CLOSE_BRACE: '}'
};
},{}],181:[function(require,module,exports){
'use strict';

module.exports = 'enhance';
},{}],182:[function(require,module,exports){
'use strict';

module.exports = 1000;
},{}],183:[function(require,module,exports){
'use strict';

module.exports = {};
},{}],184:[function(require,module,exports){
'use strict';

module.exports = 'Boolean Number String Date RegExp Function Array Error Set Map';
},{}],185:[function(require,module,exports){
'use strict';

module.exports = !('0' in Object('a'));
},{}],186:[function(require,module,exports){
'use strict';

module.exports = '_sugar_';
},{}],187:[function(require,module,exports){
'use strict';

module.exports = /^(.*?)\[([-\d]*)\.\.([-\d]*)\](.*)$/;
},{}],188:[function(require,module,exports){
'use strict';

module.exports = /([{}])\1|\{([^}]*)\}|(%)%|(%(\w*))/g;
},{}],189:[function(require,module,exports){
'use strict';

module.exports = '\u0009\u000A\u000B\u000C\u000D\u0020\u00A0\u1680\u180E\u2000\u2001\u2002\u2003\u2004\u2005\u2006\u2007\u2008\u2009\u200A\u202F\u205F\u2028\u2029\u3000\uFEFF';
},{}],190:[function(require,module,exports){
'use strict';

var privatePropertyAccessor = require('../internal/privatePropertyAccessor');

module.exports = privatePropertyAccessor('utc');
},{"../internal/privatePropertyAccessor":164}],191:[function(require,module,exports){
'use strict';

module.exports = String.fromCharCode;
},{}],192:[function(require,module,exports){
'use strict';

var NATIVE_TYPES = require('./NATIVE_TYPES'),
    forEach = require('../internal/forEach'),
    isClass = require('../internal/isClass'),
    spaceSplit = require('../internal/spaceSplit'),
    isPlainObject = require('../internal/isPlainObject'),
    coreUtilityAliases = require('./coreUtilityAliases');

var classToString = coreUtilityAliases.classToString;

var isSerializable,
    isBoolean, isNumber, isString,
    isDate, isRegExp, isFunction,
    isArray, isSet, isMap, isError;

function buildClassChecks() {

  var knownTypes = {};

  function addCoreTypes() {

    var names = spaceSplit(NATIVE_TYPES);

    isBoolean = buildPrimitiveClassCheck(names[0]);
    isNumber  = buildPrimitiveClassCheck(names[1]);
    isString  = buildPrimitiveClassCheck(names[2]);

    isDate   = buildClassCheck(names[3]);
    isRegExp = buildClassCheck(names[4]);

    // Wanted to enhance performance here by using simply "typeof"
    // but Firefox has two major issues that make this impossible,
    // one fixed, the other not, so perform a full class check here.
    //
    // 1. Regexes can be typeof "function" in FF < 3
    //    https://bugzilla.mozilla.org/show_bug.cgi?id=61911 (fixed)
    //
    // 2. HTMLEmbedElement and HTMLObjectElement are be typeof "function"
    //    https://bugzilla.mozilla.org/show_bug.cgi?id=268945 (won't fix)
    isFunction = buildClassCheck(names[5]);


    isArray = Array.isArray || buildClassCheck(names[6]);
    isError = buildClassCheck(names[7]);

    isSet = buildClassCheck(names[8], typeof Set !== 'undefined' && Set);
    isMap = buildClassCheck(names[9], typeof Map !== 'undefined' && Map);

    // Add core types as known so that they can be checked by value below,
    // notably excluding Functions and adding Arguments and Error.
    addKnownType('Arguments');
    addKnownType(names[0]);
    addKnownType(names[1]);
    addKnownType(names[2]);
    addKnownType(names[3]);
    addKnownType(names[4]);
    addKnownType(names[6]);

  }

  function addArrayTypes() {
    var types = 'Int8 Uint8 Uint8Clamped Int16 Uint16 Int32 Uint32 Float32 Float64';
    forEach(spaceSplit(types), function(str) {
      addKnownType(str + 'Array');
    });
  }

  function addKnownType(className) {
    var str = '[object '+ className +']';
    knownTypes[str] = true;
  }

  function isKnownType(className) {
    return knownTypes[className];
  }

  function buildClassCheck(className, globalObject) {
    if (globalObject && isClass(new globalObject, 'Object')) {
      return getConstructorClassCheck(globalObject);
    } else {
      return getToStringClassCheck(className);
    }
  }

  function getConstructorClassCheck(obj) {
    var ctorStr = String(obj);
    return function(obj) {
      return String(obj.constructor) === ctorStr;
    };
  }

  function getToStringClassCheck(className) {
    return function(obj, str) {
      // perf: Returning up front on instanceof appears to be slower.
      return isClass(obj, className, str);
    };
  }

  function buildPrimitiveClassCheck(className) {
    var type = className.toLowerCase();
    return function(obj) {
      var t = typeof obj;
      return t === type || t === 'object' && isClass(obj, className);
    };
  }

  addCoreTypes();
  addArrayTypes();

  isSerializable = function(obj, className) {
    // Only known objects can be serialized. This notably excludes functions,
    // host objects, Symbols (which are matched by reference), and instances
    // of classes. The latter can arguably be matched by value, but
    // distinguishing between these and host objects -- which should never be
    // compared by value -- is very tricky so not dealing with it here.
    className = className || classToString(obj);
    return isKnownType(className) || isPlainObject(obj, className);
  };

}

buildClassChecks();

module.exports = {
  isSerializable: isSerializable,
  isBoolean: isBoolean,
  isNumber: isNumber,
  isString: isString,
  isDate: isDate,
  isRegExp: isRegExp,
  isFunction: isFunction,
  isArray: isArray,
  isSet: isSet,
  isMap: isMap,
  isError: isError
};
},{"../internal/forEach":129,"../internal/isClass":148,"../internal/isPlainObject":152,"../internal/spaceSplit":175,"./NATIVE_TYPES":184,"./coreUtilityAliases":193}],193:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core');

module.exports = {
  hasOwn: Sugar.util.hasOwn,
  getOwn: Sugar.util.getOwn,
  setProperty: Sugar.util.setProperty,
  classToString: Sugar.util.classToString,
  defineProperty: Sugar.util.defineProperty,
  forEachProperty: Sugar.util.forEachProperty,
  mapNativeToChainable: Sugar.util.mapNativeToChainable
};
},{"sugar-core":809}],194:[function(require,module,exports){
'use strict';

var CommonChars = require('./CommonChars'),
    chr = require('./chr'),
    allCharsReg = require('../internal/allCharsReg');

var HALF_WIDTH_ZERO = CommonChars.HALF_WIDTH_ZERO,
    FULL_WIDTH_ZERO = CommonChars.FULL_WIDTH_ZERO,
    HALF_WIDTH_PERIOD = CommonChars.HALF_WIDTH_PERIOD,
    FULL_WIDTH_PERIOD = CommonChars.FULL_WIDTH_PERIOD,
    HALF_WIDTH_COMMA = CommonChars.HALF_WIDTH_COMMA;

var fullWidthNumberReg, fullWidthNumberMap, fullWidthNumbers;

function buildFullWidthNumber() {
  var fwp = FULL_WIDTH_PERIOD, hwp = HALF_WIDTH_PERIOD, hwc = HALF_WIDTH_COMMA, fwn = '';
  fullWidthNumberMap = {};
  for (var i = 0, digit; i <= 9; i++) {
    digit = chr(i + FULL_WIDTH_ZERO);
    fwn += digit;
    fullWidthNumberMap[digit] = chr(i + HALF_WIDTH_ZERO);
  }
  fullWidthNumberMap[hwc] = '';
  fullWidthNumberMap[fwp] = hwp;
  // Mapping this to itself to capture it easily
  // in stringToNumber to detect decimals later.
  fullWidthNumberMap[hwp] = hwp;
  fullWidthNumberReg = allCharsReg(fwn + fwp + hwc + hwp);
  fullWidthNumbers = fwn;
}

buildFullWidthNumber();

module.exports = {
  fullWidthNumberReg: fullWidthNumberReg,
  fullWidthNumberMap: fullWidthNumberMap,
  fullWidthNumbers: fullWidthNumbers
};
},{"../internal/allCharsReg":103,"./CommonChars":180,"./chr":191}],195:[function(require,module,exports){
'use strict';

module.exports = {
  abs: Math.abs,
  pow: Math.pow,
  min: Math.min,
  max: Math.max,
  ceil: Math.ceil,
  floor: Math.floor,
  round: Math.round
};
},{}],196:[function(require,module,exports){
'use strict';

var wrapNamespace = require('../internal/wrapNamespace');

module.exports = {
  alias: wrapNamespace('alias'),
  defineStatic: wrapNamespace('defineStatic'),
  defineInstance: wrapNamespace('defineInstance'),
  defineStaticPolyfill: wrapNamespace('defineStaticPolyfill'),
  defineInstancePolyfill: wrapNamespace('defineInstancePolyfill'),
  defineInstanceAndStatic: wrapNamespace('defineInstanceAndStatic'),
  defineInstanceWithArguments: wrapNamespace('defineInstanceWithArguments')
};
},{"../internal/wrapNamespace":179}],197:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core');

module.exports = {
  sugarObject: Sugar.Object,
  sugarArray: Sugar.Array,
  sugarDate: Sugar.Date,
  sugarString: Sugar.String,
  sugarNumber: Sugar.Number,
  sugarFunction: Sugar.Function,
  sugarRegExp: Sugar.RegExp
};
},{"sugar-core":809}],198:[function(require,module,exports){
'use strict';

var mathAliases = require('./mathAliases');

var ceil = mathAliases.ceil,
    floor = mathAliases.floor;

var trunc = Math.trunc || function(n) {
  if (n === 0 || !isFinite(n)) return n;
  return n < 0 ? ceil(n) : floor(n);
};

module.exports = trunc;
},{"./mathAliases":195}],199:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core');

require('./build/buildDateUnitMethodsCall');

module.exports = Sugar.Date.addDays;
},{"./build/buildDateUnitMethodsCall":214,"sugar-core":809}],200:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core');

require('./build/buildDateUnitMethodsCall');

module.exports = Sugar.Date.addHours;
},{"./build/buildDateUnitMethodsCall":214,"sugar-core":809}],201:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core'),
    LocaleHelpers = require('./var/LocaleHelpers');

var localeManager = LocaleHelpers.localeManager;

Sugar.Date.defineStatic({

  'addLocale': function(code, set) {
    return localeManager.add(code, set);
  }

});

module.exports = Sugar.Date.addLocale;
},{"./var/LocaleHelpers":389,"sugar-core":809}],202:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core');

require('./build/buildDateUnitMethodsCall');

module.exports = Sugar.Date.addMilliseconds;
},{"./build/buildDateUnitMethodsCall":214,"sugar-core":809}],203:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core');

require('./build/buildDateUnitMethodsCall');

module.exports = Sugar.Date.addMinutes;
},{"./build/buildDateUnitMethodsCall":214,"sugar-core":809}],204:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core');

require('./build/buildDateUnitMethodsCall');

module.exports = Sugar.Date.addMonths;
},{"./build/buildDateUnitMethodsCall":214,"sugar-core":809}],205:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core');

require('./build/buildDateUnitMethodsCall');

module.exports = Sugar.Date.addSeconds;
},{"./build/buildDateUnitMethodsCall":214,"sugar-core":809}],206:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core');

require('./build/buildDateUnitMethodsCall');

module.exports = Sugar.Date.addWeeks;
},{"./build/buildDateUnitMethodsCall":214,"sugar-core":809}],207:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core');

require('./build/buildDateUnitMethodsCall');

module.exports = Sugar.Date.addYears;
},{"./build/buildDateUnitMethodsCall":214,"sugar-core":809}],208:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core'),
    advanceDateWithArgs = require('./internal/advanceDateWithArgs');

Sugar.Date.defineInstanceWithArguments({

  'advance': function(d, args) {
    return advanceDateWithArgs(d, args, 1);
  }

});

module.exports = Sugar.Date.advance;
},{"./internal/advanceDateWithArgs":246,"sugar-core":809}],209:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core');

require('./build/buildDateUnitMethodsCall');

module.exports = Sugar.Date.beginningOfDay;
},{"./build/buildDateUnitMethodsCall":214,"sugar-core":809}],210:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core'),
    resetTime = require('./internal/resetTime'),
    getWeekday = require('./internal/getWeekday'),
    setWeekday = require('./internal/setWeekday');

Sugar.Date.defineInstance({

  'beginningOfISOWeek': function(date) {
    var day = getWeekday(date);
    if (day === 0) {
      day = -6;
    } else if (day !== 1) {
      day = 1;
    }
    setWeekday(date, day);
    return resetTime(date);
  }

});

module.exports = Sugar.Date.beginningOfISOWeek;
},{"./internal/getWeekday":293,"./internal/resetTime":306,"./internal/setWeekday":312,"sugar-core":809}],211:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core');

require('./build/buildDateUnitMethodsCall');

module.exports = Sugar.Date.beginningOfMonth;
},{"./build/buildDateUnitMethodsCall":214,"sugar-core":809}],212:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core');

require('./build/buildDateUnitMethodsCall');

module.exports = Sugar.Date.beginningOfWeek;
},{"./build/buildDateUnitMethodsCall":214,"sugar-core":809}],213:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core');

require('./build/buildDateUnitMethodsCall');

module.exports = Sugar.Date.beginningOfYear;
},{"./build/buildDateUnitMethodsCall":214,"sugar-core":809}],214:[function(require,module,exports){
'use strict';

var buildDateUnitMethods = require('../internal/buildDateUnitMethods');

buildDateUnitMethods();
},{"../internal/buildDateUnitMethods":249}],215:[function(require,module,exports){
'use strict';

var buildNumberUnitMethods = require('../internal/buildNumberUnitMethods');

buildNumberUnitMethods();
},{"../internal/buildNumberUnitMethods":250}],216:[function(require,module,exports){
'use strict';

var buildRelativeAliases = require('../internal/buildRelativeAliases');

buildRelativeAliases();
},{"../internal/buildRelativeAliases":251}],217:[function(require,module,exports){
'use strict';

var setDateChainableConstructor = require('../internal/setDateChainableConstructor');

setDateChainableConstructor();
},{"../internal/setDateChainableConstructor":308}],218:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core'),
    cloneDate = require('./internal/cloneDate');

Sugar.Date.defineInstance({

  'clone': function(date) {
    return cloneDate(date);
  }

});

module.exports = Sugar.Date.clone;
},{"./internal/cloneDate":253,"sugar-core":809}],219:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core'),
    createDate = require('./internal/createDate');

require('./build/setDateChainableConstructorCall');

Sugar.Date.defineStatic({

  'create': function(d, options) {
    return createDate(d, options);
  }

});

module.exports = Sugar.Date.create;
},{"./build/setDateChainableConstructorCall":217,"./internal/createDate":258,"sugar-core":809}],220:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core');

require('./build/buildDateUnitMethodsCall');

module.exports = Sugar.Date.daysAgo;
},{"./build/buildDateUnitMethodsCall":214,"sugar-core":809}],221:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core');

require('./build/buildDateUnitMethodsCall');

module.exports = Sugar.Date.daysFromNow;
},{"./build/buildDateUnitMethodsCall":214,"sugar-core":809}],222:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core'),
    getDaysInMonth = require('./internal/getDaysInMonth');

Sugar.Date.defineInstance({

  'daysInMonth': function(date) {
    return getDaysInMonth(date);
  }

});

module.exports = Sugar.Date.daysInMonth;
},{"./internal/getDaysInMonth":274,"sugar-core":809}],223:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core');

require('./build/buildDateUnitMethodsCall');

module.exports = Sugar.Date.daysSince;
},{"./build/buildDateUnitMethodsCall":214,"sugar-core":809}],224:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core');

require('./build/buildDateUnitMethodsCall');

module.exports = Sugar.Date.daysUntil;
},{"./build/buildDateUnitMethodsCall":214,"sugar-core":809}],225:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core');

require('./build/buildDateUnitMethodsCall');

module.exports = Sugar.Date.endOfDay;
},{"./build/buildDateUnitMethodsCall":214,"sugar-core":809}],226:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core'),
    DateUnitIndexes = require('./var/DateUnitIndexes'),
    getWeekday = require('./internal/getWeekday'),
    setWeekday = require('./internal/setWeekday'),
    moveToEndOfUnit = require('./internal/moveToEndOfUnit');

var DAY_INDEX = DateUnitIndexes.DAY_INDEX;

Sugar.Date.defineInstance({

  'endOfISOWeek': function(date) {
    if (getWeekday(date) !== 0) {
      setWeekday(date, 7);
    }
    return moveToEndOfUnit(date, DAY_INDEX);
  }

});

module.exports = Sugar.Date.endOfISOWeek;
},{"./internal/getWeekday":293,"./internal/moveToEndOfUnit":302,"./internal/setWeekday":312,"./var/DateUnitIndexes":382,"sugar-core":809}],227:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core');

require('./build/buildDateUnitMethodsCall');

module.exports = Sugar.Date.endOfMonth;
},{"./build/buildDateUnitMethodsCall":214,"sugar-core":809}],228:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core');

require('./build/buildDateUnitMethodsCall');

module.exports = Sugar.Date.endOfWeek;
},{"./build/buildDateUnitMethodsCall":214,"sugar-core":809}],229:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core');

require('./build/buildDateUnitMethodsCall');

module.exports = Sugar.Date.endOfYear;
},{"./build/buildDateUnitMethodsCall":214,"sugar-core":809}],230:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core'),
    dateFormat = require('./internal/dateFormat');

Sugar.Date.defineInstance({

  'format': function(date, f, localeCode) {
    return dateFormat(date, f, localeCode);
  }

});

module.exports = Sugar.Date.format;
},{"./internal/dateFormat":260,"sugar-core":809}],231:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core'),
    createDateWithContext = require('./internal/createDateWithContext');

Sugar.Date.defineInstance({

  'get': function(date, d, options) {
    return createDateWithContext(date, d, options);
  }

});

module.exports = Sugar.Date.get;
},{"./internal/createDateWithContext":259,"sugar-core":809}],232:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core'),
    LocaleHelpers = require('./var/LocaleHelpers'),
    getKeys = require('../common/internal/getKeys');

var localeManager = LocaleHelpers.localeManager;

Sugar.Date.defineStatic({

  'getAllLocaleCodes': function() {
    return getKeys(localeManager.getAll());
  }

});

module.exports = Sugar.Date.getAllLocaleCodes;
},{"../common/internal/getKeys":135,"./var/LocaleHelpers":389,"sugar-core":809}],233:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core'),
    LocaleHelpers = require('./var/LocaleHelpers');

var localeManager = LocaleHelpers.localeManager;

Sugar.Date.defineStatic({

  'getAllLocales': function() {
    return localeManager.getAll();
  }

});

module.exports = Sugar.Date.getAllLocales;
},{"./var/LocaleHelpers":389,"sugar-core":809}],234:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core'),
    getWeekNumber = require('./internal/getWeekNumber');

Sugar.Date.defineInstance({

  'getISOWeek': function(date) {
    return getWeekNumber(date, true);
  }

});

module.exports = Sugar.Date.getISOWeek;
},{"./internal/getWeekNumber":291,"sugar-core":809}],235:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core'),
    LocaleHelpers = require('./var/LocaleHelpers');

var localeManager = LocaleHelpers.localeManager;

Sugar.Date.defineStatic({

  'getLocale': function(code) {
    return localeManager.get(code, !code);
  }

});

module.exports = Sugar.Date.getLocale;
},{"./var/LocaleHelpers":389,"sugar-core":809}],236:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core'),
    _dateOptions = require('./var/_dateOptions');

module.exports = Sugar.Date.getOption;
},{"./var/_dateOptions":394,"sugar-core":809}],237:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core'),
    getUTCOffset = require('./internal/getUTCOffset');

Sugar.Date.defineInstance({

  'getUTCOffset': function(date, iso) {
    return getUTCOffset(date, iso);
  }

});

module.exports = Sugar.Date.getUTCOffset;
},{"./internal/getUTCOffset":289,"sugar-core":809}],238:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core');

Sugar.Date.defineInstance({

  'getUTCWeekday': function(date) {
    return date.getUTCDay();
  }

});

module.exports = Sugar.Date.getUTCWeekday;
},{"sugar-core":809}],239:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core'),
    getWeekday = require('./internal/getWeekday');

Sugar.Date.defineInstance({

  'getWeekday': function(date) {
    return getWeekday(date);
  }

});

module.exports = Sugar.Date.getWeekday;
},{"./internal/getWeekday":293,"sugar-core":809}],240:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core');

require('./build/buildDateUnitMethodsCall');

module.exports = Sugar.Date.hoursAgo;
},{"./build/buildDateUnitMethodsCall":214,"sugar-core":809}],241:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core');

require('./build/buildDateUnitMethodsCall');

module.exports = Sugar.Date.hoursFromNow;
},{"./build/buildDateUnitMethodsCall":214,"sugar-core":809}],242:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core');

require('./build/buildDateUnitMethodsCall');

module.exports = Sugar.Date.hoursSince;
},{"./build/buildDateUnitMethodsCall":214,"sugar-core":809}],243:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core');

require('./build/buildDateUnitMethodsCall');

module.exports = Sugar.Date.hoursUntil;
},{"./build/buildDateUnitMethodsCall":214,"sugar-core":809}],244:[function(require,module,exports){
'use strict';

// Static Methods
require('./addLocale');
require('./create');
require('./getAllLocaleCodes');
require('./getAllLocales');
require('./getLocale');
require('./removeLocale');
require('./setLocale');

// Instance Methods
require('../number/day');
require('../number/dayAfter');
require('../number/dayAgo');
require('../number/dayBefore');
require('../number/dayFromNow');
require('../number/days');
require('../number/daysAfter');
require('../number/daysAgo');
require('../number/daysBefore');
require('../number/daysFromNow');
require('../number/duration');
require('../number/hour');
require('../number/hourAfter');
require('../number/hourAgo');
require('../number/hourBefore');
require('../number/hourFromNow');
require('../number/hours');
require('../number/hoursAfter');
require('../number/hoursAgo');
require('../number/hoursBefore');
require('../number/hoursFromNow');
require('../number/millisecond');
require('../number/millisecondAfter');
require('../number/millisecondAgo');
require('../number/millisecondBefore');
require('../number/millisecondFromNow');
require('../number/milliseconds');
require('../number/millisecondsAfter');
require('../number/millisecondsAgo');
require('../number/millisecondsBefore');
require('../number/millisecondsFromNow');
require('../number/minute');
require('../number/minuteAfter');
require('../number/minuteAgo');
require('../number/minuteBefore');
require('../number/minuteFromNow');
require('../number/minutes');
require('../number/minutesAfter');
require('../number/minutesAgo');
require('../number/minutesBefore');
require('../number/minutesFromNow');
require('../number/month');
require('../number/monthAfter');
require('../number/monthAgo');
require('../number/monthBefore');
require('../number/monthFromNow');
require('../number/months');
require('../number/monthsAfter');
require('../number/monthsAgo');
require('../number/monthsBefore');
require('../number/monthsFromNow');
require('../number/second');
require('../number/secondAfter');
require('../number/secondAgo');
require('../number/secondBefore');
require('../number/secondFromNow');
require('../number/seconds');
require('../number/secondsAfter');
require('../number/secondsAgo');
require('../number/secondsBefore');
require('../number/secondsFromNow');
require('../number/week');
require('../number/weekAfter');
require('../number/weekAgo');
require('../number/weekBefore');
require('../number/weekFromNow');
require('../number/weeks');
require('../number/weeksAfter');
require('../number/weeksAgo');
require('../number/weeksBefore');
require('../number/weeksFromNow');
require('../number/year');
require('../number/yearAfter');
require('../number/yearAgo');
require('../number/yearBefore');
require('../number/yearFromNow');
require('../number/years');
require('../number/yearsAfter');
require('../number/yearsAgo');
require('../number/yearsBefore');
require('../number/yearsFromNow');
require('./addDays');
require('./addHours');
require('./addMilliseconds');
require('./addMinutes');
require('./addMonths');
require('./addSeconds');
require('./addWeeks');
require('./addYears');
require('./advance');
require('./beginningOfDay');
require('./beginningOfISOWeek');
require('./beginningOfMonth');
require('./beginningOfWeek');
require('./beginningOfYear');
require('./clone');
require('./daysAgo');
require('./daysFromNow');
require('./daysInMonth');
require('./daysSince');
require('./daysUntil');
require('./endOfDay');
require('./endOfISOWeek');
require('./endOfMonth');
require('./endOfWeek');
require('./endOfYear');
require('./format');
require('./get');
require('./getISOWeek');
require('./getUTCOffset');
require('./getUTCWeekday');
require('./getWeekday');
require('./hoursAgo');
require('./hoursFromNow');
require('./hoursSince');
require('./hoursUntil');
require('./is');
require('./isAfter');
require('./isBefore');
require('./isBetween');
require('./isFriday');
require('./isFuture');
require('./isLastMonth');
require('./isLastWeek');
require('./isLastYear');
require('./isLeapYear');
require('./isMonday');
require('./isNextMonth');
require('./isNextWeek');
require('./isNextYear');
require('./isPast');
require('./isSaturday');
require('./isSunday');
require('./isThisMonth');
require('./isThisWeek');
require('./isThisYear');
require('./isThursday');
require('./isToday');
require('./isTomorrow');
require('./isTuesday');
require('./isUTC');
require('./isValid');
require('./isWednesday');
require('./isWeekday');
require('./isWeekend');
require('./isYesterday');
require('./iso');
require('./millisecondsAgo');
require('./millisecondsFromNow');
require('./millisecondsSince');
require('./millisecondsUntil');
require('./minutesAgo');
require('./minutesFromNow');
require('./minutesSince');
require('./minutesUntil');
require('./monthsAgo');
require('./monthsFromNow');
require('./monthsSince');
require('./monthsUntil');
require('./relative');
require('./relativeTo');
require('./reset');
require('./rewind');
require('./secondsAgo');
require('./secondsFromNow');
require('./secondsSince');
require('./secondsUntil');
require('./set');
require('./setISOWeek');
require('./setUTC');
require('./setWeekday');
require('./weeksAgo');
require('./weeksFromNow');
require('./weeksSince');
require('./weeksUntil');
require('./yearsAgo');
require('./yearsFromNow');
require('./yearsSince');
require('./yearsUntil');

// Accessors
require('./getOption');
require('./setOption');

module.exports = require('sugar-core');
},{"../number/day":467,"../number/dayAfter":468,"../number/dayAgo":469,"../number/dayBefore":470,"../number/dayFromNow":471,"../number/days":472,"../number/daysAfter":473,"../number/daysAgo":474,"../number/daysBefore":475,"../number/daysFromNow":476,"../number/duration":478,"../number/hour":484,"../number/hourAfter":485,"../number/hourAgo":486,"../number/hourBefore":487,"../number/hourFromNow":488,"../number/hours":489,"../number/hoursAfter":490,"../number/hoursAgo":491,"../number/hoursBefore":492,"../number/hoursFromNow":493,"../number/millisecond":507,"../number/millisecondAfter":508,"../number/millisecondAgo":509,"../number/millisecondBefore":510,"../number/millisecondFromNow":511,"../number/milliseconds":512,"../number/millisecondsAfter":513,"../number/millisecondsAgo":514,"../number/millisecondsBefore":515,"../number/millisecondsFromNow":516,"../number/minute":517,"../number/minuteAfter":518,"../number/minuteAgo":519,"../number/minuteBefore":520,"../number/minuteFromNow":521,"../number/minutes":522,"../number/minutesAfter":523,"../number/minutesAgo":524,"../number/minutesBefore":525,"../number/minutesFromNow":526,"../number/month":527,"../number/monthAfter":528,"../number/monthAgo":529,"../number/monthBefore":530,"../number/monthFromNow":531,"../number/months":532,"../number/monthsAfter":533,"../number/monthsAgo":534,"../number/monthsBefore":535,"../number/monthsFromNow":536,"../number/second":543,"../number/secondAfter":544,"../number/secondAgo":545,"../number/secondBefore":546,"../number/secondFromNow":547,"../number/seconds":548,"../number/secondsAfter":549,"../number/secondsAgo":550,"../number/secondsBefore":551,"../number/secondsFromNow":552,"../number/week":563,"../number/weekAfter":564,"../number/weekAgo":565,"../number/weekBefore":566,"../number/weekFromNow":567,"../number/weeks":568,"../number/weeksAfter":569,"../number/weeksAgo":570,"../number/weeksBefore":571,"../number/weeksFromNow":572,"../number/year":573,"../number/yearAfter":574,"../number/yearAgo":575,"../number/yearBefore":576,"../number/yearFromNow":577,"../number/years":578,"../number/yearsAfter":579,"../number/yearsAgo":580,"../number/yearsBefore":581,"../number/yearsFromNow":582,"./addDays":199,"./addHours":200,"./addLocale":201,"./addMilliseconds":202,"./addMinutes":203,"./addMonths":204,"./addSeconds":205,"./addWeeks":206,"./addYears":207,"./advance":208,"./beginningOfDay":209,"./beginningOfISOWeek":210,"./beginningOfMonth":211,"./beginningOfWeek":212,"./beginningOfYear":213,"./clone":218,"./create":219,"./daysAgo":220,"./daysFromNow":221,"./daysInMonth":222,"./daysSince":223,"./daysUntil":224,"./endOfDay":225,"./endOfISOWeek":226,"./endOfMonth":227,"./endOfWeek":228,"./endOfYear":229,"./format":230,"./get":231,"./getAllLocaleCodes":232,"./getAllLocales":233,"./getISOWeek":234,"./getLocale":235,"./getOption":236,"./getUTCOffset":237,"./getUTCWeekday":238,"./getWeekday":239,"./hoursAgo":240,"./hoursFromNow":241,"./hoursSince":242,"./hoursUntil":243,"./is":317,"./isAfter":318,"./isBefore":319,"./isBetween":320,"./isFriday":321,"./isFuture":322,"./isLastMonth":323,"./isLastWeek":324,"./isLastYear":325,"./isLeapYear":326,"./isMonday":327,"./isNextMonth":328,"./isNextWeek":329,"./isNextYear":330,"./isPast":331,"./isSaturday":332,"./isSunday":333,"./isThisMonth":334,"./isThisWeek":335,"./isThisYear":336,"./isThursday":337,"./isToday":338,"./isTomorrow":339,"./isTuesday":340,"./isUTC":341,"./isValid":342,"./isWednesday":343,"./isWeekday":344,"./isWeekend":345,"./isYesterday":346,"./iso":347,"./millisecondsAgo":348,"./millisecondsFromNow":349,"./millisecondsSince":350,"./millisecondsUntil":351,"./minutesAgo":352,"./minutesFromNow":353,"./minutesSince":354,"./minutesUntil":355,"./monthsAgo":356,"./monthsFromNow":357,"./monthsSince":358,"./monthsUntil":359,"./relative":361,"./relativeTo":362,"./removeLocale":363,"./reset":364,"./rewind":365,"./secondsAgo":366,"./secondsFromNow":367,"./secondsSince":368,"./secondsUntil":369,"./set":370,"./setISOWeek":371,"./setLocale":372,"./setOption":373,"./setUTC":374,"./setWeekday":375,"./weeksAgo":396,"./weeksFromNow":397,"./weeksSince":398,"./weeksUntil":399,"./yearsAgo":400,"./yearsFromNow":401,"./yearsSince":402,"./yearsUntil":403,"sugar-core":809}],245:[function(require,module,exports){
'use strict';

var updateDate = require('./updateDate');

function advanceDate(d, unit, num, reset) {
  var set = {};
  set[unit] = num;
  return updateDate(d, set, reset, 1);
}

module.exports = advanceDate;
},{"./updateDate":315}],246:[function(require,module,exports){
'use strict';

var updateDate = require('./updateDate'),
    collectDateArguments = require('./collectDateArguments');

function advanceDateWithArgs(d, args, dir) {
  args = collectDateArguments(args, true);
  return updateDate(d, args[0], args[1], dir);
}

module.exports = advanceDateWithArgs;
},{"./collectDateArguments":254,"./updateDate":315}],247:[function(require,module,exports){
'use strict';

var map = require('../../common/internal/map'),
    escapeRegExp = require('../../common/internal/escapeRegExp');

function arrayToRegAlternates(arr) {
  var joined = arr.join('');
  if (!arr || !arr.length) {
    return '';
  }
  if (joined.length === arr.length) {
    return '[' + joined + ']';
  }
  // map handles sparse arrays so no need to compact the array here.
  return map(arr, escapeRegExp).join('|');
}

module.exports = arrayToRegAlternates;
},{"../../common/internal/escapeRegExp":126,"../../common/internal/map":158}],248:[function(require,module,exports){
'use strict';

var dateIsValid = require('./dateIsValid');

function assertDateIsValid(d) {
  if (!dateIsValid(d)) {
    throw new TypeError('Date is not valid');
  }
}

module.exports = assertDateIsValid;
},{"./dateIsValid":261}],249:[function(require,module,exports){
'use strict';

var DateUnits = require('../var/DateUnits'),
    DateUnitIndexes = require('../var/DateUnitIndexes'),
    forEach = require('../../common/internal/forEach'),
    compareDate = require('./compareDate'),
    advanceDate = require('./advanceDate'),
    moveToEndOfUnit = require('./moveToEndOfUnit'),
    simpleCapitalize = require('../../common/internal/simpleCapitalize'),
    namespaceAliases = require('../../common/var/namespaceAliases'),
    defineInstanceSimilar = require('../../common/internal/defineInstanceSimilar'),
    moveToBeginningOfUnit = require('./moveToBeginningOfUnit'),
    createDateWithContext = require('./createDateWithContext'),
    getTimeDistanceForUnit = require('./getTimeDistanceForUnit');

var sugarDate = namespaceAliases.sugarDate,
    HOURS_INDEX = DateUnitIndexes.HOURS_INDEX,
    DAY_INDEX = DateUnitIndexes.DAY_INDEX;

function buildDateUnitMethods() {

  defineInstanceSimilar(sugarDate, DateUnits, function(methods, unit, index) {
    var name = unit.name, caps = simpleCapitalize(name);

    if (index > DAY_INDEX) {
      forEach(['Last','This','Next'], function(shift) {
        methods['is' + shift + caps] = function(d, localeCode) {
          return compareDate(d, shift + ' ' + name, 0, localeCode, { locale: 'en' });
        };
      });
    }
    if (index > HOURS_INDEX) {
      methods['beginningOf' + caps] = function(d, localeCode) {
        return moveToBeginningOfUnit(d, index, localeCode);
      };
      methods['endOf' + caps] = function(d, localeCode) {
        return moveToEndOfUnit(d, index, localeCode);
      };
    }

    methods['add' + caps + 's'] = function(d, num, reset) {
      return advanceDate(d, name, num, reset);
    };

    var since = function(date, d, options) {
      return getTimeDistanceForUnit(date, createDateWithContext(date, d, options, true), unit);
    };
    var until = function(date, d, options) {
      return getTimeDistanceForUnit(createDateWithContext(date, d, options, true), date, unit);
    };

    methods[name + 'sAgo']   = methods[name + 'sUntil']   = until;
    methods[name + 'sSince'] = methods[name + 'sFromNow'] = since;

  });

}

module.exports = buildDateUnitMethods;
},{"../../common/internal/defineInstanceSimilar":122,"../../common/internal/forEach":129,"../../common/internal/simpleCapitalize":171,"../../common/var/namespaceAliases":197,"../var/DateUnitIndexes":382,"../var/DateUnits":383,"./advanceDate":245,"./compareDate":256,"./createDateWithContext":259,"./getTimeDistanceForUnit":288,"./moveToBeginningOfUnit":300,"./moveToEndOfUnit":302}],250:[function(require,module,exports){
'use strict';

var DateUnits = require('../var/DateUnits'),
    createDate = require('./createDate'),
    mathAliases = require('../../common/var/mathAliases'),
    advanceDate = require('./advanceDate'),
    namespaceAliases = require('../../common/var/namespaceAliases'),
    defineInstanceSimilar = require('../../common/internal/defineInstanceSimilar');

var sugarNumber = namespaceAliases.sugarNumber,
    round = mathAliases.round;

function buildNumberUnitMethods() {
  defineInstanceSimilar(sugarNumber, DateUnits, function(methods, unit) {
    var name = unit.name, base, after, before;
    base = function(n) {
      return round(n * unit.multiplier);
    };
    after = function(n, d, options) {
      return advanceDate(createDate(d, options, true), name, n);
    };
    before = function(n, d, options) {
      return advanceDate(createDate(d, options, true), name, -n);
    };
    methods[name] = base;
    methods[name + 's'] = base;
    methods[name + 'Before'] = before;
    methods[name + 'sBefore'] = before;
    methods[name + 'Ago'] = before;
    methods[name + 'sAgo'] = before;
    methods[name + 'After'] = after;
    methods[name + 'sAfter'] = after;
    methods[name + 'FromNow'] = after;
    methods[name + 'sFromNow'] = after;
  });
}

module.exports = buildNumberUnitMethods;
},{"../../common/internal/defineInstanceSimilar":122,"../../common/var/mathAliases":195,"../../common/var/namespaceAliases":197,"../var/DateUnits":383,"./advanceDate":245,"./createDate":258}],251:[function(require,module,exports){
'use strict';

var LocaleHelpers = require('../var/LocaleHelpers'),
    spaceSplit = require('../../common/internal/spaceSplit'),
    fullCompareDate = require('./fullCompareDate'),
    namespaceAliases = require('../../common/var/namespaceAliases'),
    defineInstanceSimilar = require('../../common/internal/defineInstanceSimilar');

var English = LocaleHelpers.English,
    sugarDate = namespaceAliases.sugarDate;

function buildRelativeAliases() {
  var special  = spaceSplit('Today Yesterday Tomorrow Weekday Weekend Future Past');
  var weekdays = English.weekdays.slice(0, 7);
  var months   = English.months.slice(0, 12);
  var together = special.concat(weekdays).concat(months);
  defineInstanceSimilar(sugarDate, together, function(methods, name) {
    methods['is'+ name] = function(d) {
      return fullCompareDate(d, name);
    };
  });
}

module.exports = buildRelativeAliases;
},{"../../common/internal/defineInstanceSimilar":122,"../../common/internal/spaceSplit":175,"../../common/var/namespaceAliases":197,"../var/LocaleHelpers":389,"./fullCompareDate":265}],252:[function(require,module,exports){
'use strict';

var callDateSet = require('../../common/internal/callDateSet'),
    setISOWeekNumber = require('./setISOWeekNumber');

function callDateSetWithWeek(d, method, value, safe) {
  if (method === 'ISOWeek') {
    setISOWeekNumber(d, value);
  } else {
    callDateSet(d, method, value, safe);
  }
}

module.exports = callDateSetWithWeek;
},{"../../common/internal/callDateSet":109,"./setISOWeekNumber":309}],253:[function(require,module,exports){
'use strict';

var _utc = require('../../common/var/_utc');

function cloneDate(d) {
  // Rhino environments have a bug where new Date(d) truncates
  // milliseconds so need to call getTime() here.
  var clone = new Date(d.getTime());
  _utc(clone, !!_utc(d));
  return clone;
}

module.exports = cloneDate;
},{"../../common/var/_utc":190}],254:[function(require,module,exports){
'use strict';

var classChecks = require('../../common/var/classChecks'),
    simpleClone = require('../../common/internal/simpleClone'),
    isObjectType = require('../../common/internal/isObjectType'),
    getDateParamsFromString = require('./getDateParamsFromString'),
    collectDateParamsFromArguments = require('./collectDateParamsFromArguments');

var isNumber = classChecks.isNumber,
    isString = classChecks.isString;

function collectDateArguments(args, allowDuration) {
  var arg1 = args[0], arg2 = args[1];
  if (allowDuration && isString(arg1)) {
    arg1 = getDateParamsFromString(arg1);
  } else if (isNumber(arg1) && isNumber(arg2)) {
    arg1 = collectDateParamsFromArguments(args);
    arg2 = null;
  } else {
    if (isObjectType(arg1)) {
      arg1 = simpleClone(arg1);
    }
  }
  return [arg1, arg2];
}

module.exports = collectDateArguments;
},{"../../common/internal/isObjectType":151,"../../common/internal/simpleClone":172,"../../common/var/classChecks":192,"./collectDateParamsFromArguments":255,"./getDateParamsFromString":273}],255:[function(require,module,exports){
'use strict';

var DateUnitIndexes = require('../var/DateUnitIndexes'),
    isDefined = require('../../common/internal/isDefined'),
    walkUnitDown = require('./walkUnitDown');

var YEAR_INDEX = DateUnitIndexes.YEAR_INDEX;

function collectDateParamsFromArguments(args) {
  var params = {}, index = 0;
  walkUnitDown(YEAR_INDEX, function(unit) {
    var arg = args[index++];
    if (isDefined(arg)) {
      params[unit.name] = arg;
    }
  });
  return params;
}

module.exports = collectDateParamsFromArguments;
},{"../../common/internal/isDefined":149,"../var/DateUnitIndexes":382,"./walkUnitDown":316}],256:[function(require,module,exports){
'use strict';

var MINUTES = require('../var/MINUTES'),
    DateUnits = require('../var/DateUnits'),
    DateUnitIndexes = require('../var/DateUnitIndexes'),
    _utc = require('../../common/var/_utc'),
    tzOffset = require('./tzOffset'),
    cloneDate = require('./cloneDate'),
    isDefined = require('../../common/internal/isDefined'),
    advanceDate = require('./advanceDate'),
    dateIsValid = require('./dateIsValid'),
    moveToEndOfUnit = require('./moveToEndOfUnit'),
    getExtendedDate = require('./getExtendedDate'),
    moveToBeginningOfUnit = require('./moveToBeginningOfUnit');

var MONTH_INDEX = DateUnitIndexes.MONTH_INDEX;

function compareDate(date, d, margin, localeCode, options) {
  var loMargin = 0, hiMargin = 0, timezoneShift, compareEdges, override, min, max, p, t;

  function getTimezoneShift() {
    // If there is any specificity in the date then we're implicitly not
    // checking absolute time, so ignore timezone shifts.
    if (p.set && p.set.specificity) {
      return 0;
    }
    return (tzOffset(p.date) - tzOffset(date)) * MINUTES;
  }

  function addSpecificUnit() {
    var unit = DateUnits[p.set.specificity];
    return advanceDate(cloneDate(p.date), unit.name, 1).getTime() - 1;
  }

  if (_utc(date)) {
    options = options || {};
    options.fromUTC = true;
    options.setUTC = true;
  }

  p = getExtendedDate(null, d, options, true);

  if (margin > 0) {
    loMargin = hiMargin = margin;
    override = true;
  }
  if (!dateIsValid(p.date)) return false;
  if (p.set && p.set.specificity) {
    if (isDefined(p.set.edge) || isDefined(p.set.shift)) {
      compareEdges = true;
      moveToBeginningOfUnit(p.date, p.set.specificity, localeCode);
    }
    if (compareEdges || p.set.specificity === MONTH_INDEX) {
      max = moveToEndOfUnit(cloneDate(p.date), p.set.specificity, localeCode).getTime();
    } else {
      max = addSpecificUnit();
    }
    if (!override && isDefined(p.set.sign) && p.set.specificity) {
      // If the time is relative, there can occasionally be an disparity between
      // the relative date and "now", which it is being compared to, so set an
      // extra margin to account for this.
      loMargin = 50;
      hiMargin = -50;
    }
  }
  t   = date.getTime();
  min = p.date.getTime();
  max = max || min;
  timezoneShift = getTimezoneShift();
  if (timezoneShift) {
    min -= timezoneShift;
    max -= timezoneShift;
  }
  return t >= (min - loMargin) && t <= (max + hiMargin);
}

module.exports = compareDate;
},{"../../common/internal/isDefined":149,"../../common/var/_utc":190,"../var/DateUnitIndexes":382,"../var/DateUnits":383,"../var/MINUTES":391,"./advanceDate":245,"./cloneDate":253,"./dateIsValid":261,"./getExtendedDate":277,"./moveToBeginningOfUnit":300,"./moveToEndOfUnit":302,"./tzOffset":314}],257:[function(require,module,exports){
'use strict';

var setDate = require('./setDate'),
    getDate = require('./getDate'),
    getYear = require('./getYear'),
    getMonth = require('./getMonth'),
    getNewDate = require('./getNewDate');

function compareDay(d, shift) {
  var comp = getNewDate();
  if (shift) {
    setDate(comp, getDate(comp) + shift);
  }
  return getYear(d) === getYear(comp) &&
         getMonth(d) === getMonth(comp) &&
         getDate(d) === getDate(comp);
}

module.exports = compareDay;
},{"./getDate":270,"./getMonth":282,"./getNewDate":283,"./getYear":294,"./setDate":307}],258:[function(require,module,exports){
'use strict';

var getExtendedDate = require('./getExtendedDate');

function createDate(d, options, forceClone) {
  return getExtendedDate(null, d, options, forceClone).date;
}

module.exports = createDate;
},{"./getExtendedDate":277}],259:[function(require,module,exports){
'use strict';

var getExtendedDate = require('./getExtendedDate');

function createDateWithContext(contextDate, d, options, forceClone) {
  return getExtendedDate(contextDate, d, options, forceClone).date;
}

module.exports = createDateWithContext;
},{"./getExtendedDate":277}],260:[function(require,module,exports){
'use strict';

var CoreOutputFormats = require('../var/CoreOutputFormats'),
    formattingTokens = require('../var/formattingTokens'),
    assertDateIsValid = require('./assertDateIsValid');

var dateFormatMatcher = formattingTokens.dateFormatMatcher;

function dateFormat(d, format, localeCode) {
  assertDateIsValid(d);
  format = CoreOutputFormats[format] || format || '{long}';
  return dateFormatMatcher(format, d, localeCode);
}

module.exports = dateFormat;
},{"../var/CoreOutputFormats":379,"../var/formattingTokens":395,"./assertDateIsValid":248}],261:[function(require,module,exports){
'use strict';

function dateIsValid(d) {
  return !isNaN(d.getTime());
}

module.exports = dateIsValid;
},{}],262:[function(require,module,exports){
'use strict';

var LocaleHelpers = require('../var/LocaleHelpers'),
    dateFormat = require('./dateFormat'),
    classChecks = require('../../common/var/classChecks'),
    assertDateIsValid = require('./assertDateIsValid'),
    getAdjustedUnitForDate = require('./getAdjustedUnitForDate');

var isFunction = classChecks.isFunction,
    localeManager = LocaleHelpers.localeManager;

function dateRelative(d, dRelative, arg1, arg2) {
  var adu, format, type, localeCode, fn;
  assertDateIsValid(d);
  if (isFunction(arg1)) {
    fn = arg1;
  } else {
    localeCode = arg1;
    fn = arg2;
  }
  adu = getAdjustedUnitForDate(d, dRelative);
  if (fn) {
    format = fn.apply(d, adu.concat(localeManager.get(localeCode)));
    if (format) {
      return dateFormat(d, format, localeCode);
    }
  }
  // Adjust up if time is in ms, as this doesn't
  // look very good for a standard relative date.
  if (adu[1] === 0) {
    adu[1] = 1;
    adu[0] = 1;
  }
  if (dRelative) {
    type = 'duration';
  } else if (adu[2] > 0) {
    type = 'future';
  } else {
    type = 'past';
  }
  return localeManager.get(localeCode).getRelativeFormat(adu, type);
}

module.exports = dateRelative;
},{"../../common/var/classChecks":192,"../var/LocaleHelpers":389,"./assertDateIsValid":248,"./dateFormat":260,"./getAdjustedUnitForDate":267}],263:[function(require,module,exports){
'use strict';

function defaultNewDate() {
  return new Date;
}

module.exports = defaultNewDate;
},{}],264:[function(require,module,exports){
'use strict';

var getDateParamKey = require('./getDateParamKey');

function deleteDateParam(params, key) {
  delete params[getDateParamKey(params, key)];
}

module.exports = deleteDateParam;
},{"./getDateParamKey":272}],265:[function(require,module,exports){
'use strict';

var LocaleHelpers = require('../var/LocaleHelpers'),
    trim = require('../../common/internal/trim'),
    getMonth = require('./getMonth'),
    isDefined = require('../../common/internal/isDefined'),
    getNewDate = require('./getNewDate'),
    compareDay = require('./compareDay'),
    getWeekday = require('./getWeekday'),
    dateIsValid = require('./dateIsValid'),
    classChecks = require('../../common/var/classChecks'),
    compareDate = require('./compareDate');

var isString = classChecks.isString,
    English = LocaleHelpers.English;

function fullCompareDate(date, d, margin) {
  var tmp;
  if (!dateIsValid(date)) return;
  if (isString(d)) {
    d = trim(d).toLowerCase();
    switch(true) {
      case d === 'future':    return date.getTime() > getNewDate().getTime();
      case d === 'past':      return date.getTime() < getNewDate().getTime();
      case d === 'today':     return compareDay(date);
      case d === 'tomorrow':  return compareDay(date,  1);
      case d === 'yesterday': return compareDay(date, -1);
      case d === 'weekday':   return getWeekday(date) > 0 && getWeekday(date) < 6;
      case d === 'weekend':   return getWeekday(date) === 0 || getWeekday(date) === 6;

      case (isDefined(tmp = English.weekdayMap[d])):
        return getWeekday(date) === tmp;
      case (isDefined(tmp = English.monthMap[d])):
        return getMonth(date) === tmp;
    }
  }
  return compareDate(date, d, margin);
}

module.exports = fullCompareDate;
},{"../../common/internal/isDefined":149,"../../common/internal/trim":177,"../../common/var/classChecks":192,"../var/LocaleHelpers":389,"./compareDate":256,"./compareDay":257,"./dateIsValid":261,"./getMonth":282,"./getNewDate":283,"./getWeekday":293}],266:[function(require,module,exports){
'use strict';

var mathAliases = require('../../common/var/mathAliases'),
    iterateOverDateUnits = require('./iterateOverDateUnits');

var abs = mathAliases.abs;

function getAdjustedUnit(ms, fn) {
  var unitIndex = 0, value = 0;
  iterateOverDateUnits(function(unit, i) {
    value = abs(fn(unit));
    if (value >= 1) {
      unitIndex = i;
      return false;
    }
  });
  return [value, unitIndex, ms];
}

module.exports = getAdjustedUnit;
},{"../../common/var/mathAliases":195,"./iterateOverDateUnits":298}],267:[function(require,module,exports){
'use strict';

var getNewDate = require('./getNewDate'),
    mathAliases = require('../../common/var/mathAliases'),
    getAdjustedUnit = require('./getAdjustedUnit'),
    getTimeDistanceForUnit = require('./getTimeDistanceForUnit');

var abs = mathAliases.abs;

function getAdjustedUnitForDate(d, dRelative) {
  var ms;
  if (!dRelative) {
    dRelative = getNewDate();
    if (d > dRelative) {
      // If our date is greater than the one that we got from getNewDate, it
      // means that we are finding the unit for a date that is in the future
      // relative to now. However, often the incoming date was created in
      // the same cycle as our comparison, but our "now" date will have been
      // created an instant after it, creating situations where "5 minutes from
      // now" becomes "4 minutes from now" in the same tick. To prevent this,
      // subtract a buffer of 10ms to compensate.
      dRelative = new Date(dRelative.getTime() - 10);
    }
  }
  ms = d - dRelative;
  return getAdjustedUnit(ms, function(u) {
    return abs(getTimeDistanceForUnit(d, dRelative, u));
  });
}

module.exports = getAdjustedUnitForDate;
},{"../../common/var/mathAliases":195,"./getAdjustedUnit":266,"./getNewDate":283,"./getTimeDistanceForUnit":288}],268:[function(require,module,exports){
'use strict';

var trunc = require('../../common/var/trunc'),
    withPrecision = require('../../common/internal/withPrecision'),
    getAdjustedUnit = require('./getAdjustedUnit');

function getAdjustedUnitForNumber(ms) {
  return getAdjustedUnit(ms, function(unit) {
    return trunc(withPrecision(ms / unit.multiplier, 1));
  });
}

module.exports = getAdjustedUnitForNumber;
},{"../../common/internal/withPrecision":178,"../../common/var/trunc":198,"./getAdjustedUnit":266}],269:[function(require,module,exports){
'use strict';

function getArrayWithOffset(arr, n, alternate, offset) {
  var val;
  if (alternate > 1) {
    val = arr[n + (alternate - 1) * offset];
  }
  return val || arr[n];
}

module.exports = getArrayWithOffset;
},{}],270:[function(require,module,exports){
'use strict';

var callDateGet = require('../../common/internal/callDateGet');

function getDate(d) {
  return callDateGet(d, 'Date');
}

module.exports = getDate;
},{"../../common/internal/callDateGet":108}],271:[function(require,module,exports){
'use strict';

var getDateParamKey = require('./getDateParamKey'),
    coreUtilityAliases = require('../../common/var/coreUtilityAliases');

var getOwn = coreUtilityAliases.getOwn;

function getDateParam(params, key) {
  return getOwn(params, getDateParamKey(params, key));
}

module.exports = getDateParam;
},{"../../common/var/coreUtilityAliases":193,"./getDateParamKey":272}],272:[function(require,module,exports){
'use strict';

var getOwnKey = require('../../common/internal/getOwnKey');

function getDateParamKey(params, key) {
  return getOwnKey(params, key) ||
         getOwnKey(params, key + 's') ||
         (key === 'day' && getOwnKey(params, 'date'));
}

module.exports = getDateParamKey;
},{"../../common/internal/getOwnKey":139}],273:[function(require,module,exports){
'use strict';

var isUndefined = require('../../common/internal/isUndefined');

function getDateParamsFromString(str) {
  var match, num, params = {};
  match = str.match(/^(-?\d*[\d.]\d*)?\s?(\w+?)s?$/i);
  if (match) {
    if (isUndefined(num)) {
      num = +match[1];
      if (isNaN(num)) {
        num = 1;
      }
    }
    params[match[2].toLowerCase()] = num;
  }
  return params;
}

module.exports = getDateParamsFromString;
},{"../../common/internal/isUndefined":155}],274:[function(require,module,exports){
'use strict';

var getYear = require('./getYear'),
    getMonth = require('./getMonth'),
    callDateGet = require('../../common/internal/callDateGet');

function getDaysInMonth(d) {
  return 32 - callDateGet(new Date(getYear(d), getMonth(d), 32), 'Date');
}

module.exports = getDaysInMonth;
},{"../../common/internal/callDateGet":108,"./getMonth":282,"./getYear":294}],275:[function(require,module,exports){
'use strict';

var DateUnits = require('../var/DateUnits'),
    DateUnitIndexes = require('../var/DateUnitIndexes'),
    getTimeDistanceForUnit = require('./getTimeDistanceForUnit');

var DAY_INDEX = DateUnitIndexes.DAY_INDEX;

function getDaysSince(d1, d2) {
  return getTimeDistanceForUnit(d1, d2, DateUnits[DAY_INDEX]);
}

module.exports = getDaysSince;
},{"../var/DateUnitIndexes":382,"../var/DateUnits":383,"./getTimeDistanceForUnit":288}],276:[function(require,module,exports){
'use strict';

var EnglishLocaleBaseDefinition = require('../var/EnglishLocaleBaseDefinition'),
    simpleMerge = require('../../common/internal/simpleMerge'),
    simpleClone = require('../../common/internal/simpleClone');

function getEnglishVariant(v) {
  return simpleMerge(simpleClone(EnglishLocaleBaseDefinition), v);
}

module.exports = getEnglishVariant;
},{"../../common/internal/simpleClone":172,"../../common/internal/simpleMerge":173,"../var/EnglishLocaleBaseDefinition":384}],277:[function(require,module,exports){
'use strict';

var MINUTES = require('../var/MINUTES'),
    ParsingTokens = require('../var/ParsingTokens'),
    LocaleHelpers = require('../var/LocaleHelpers'),
    DateUnitIndexes = require('../var/DateUnitIndexes'),
    _utc = require('../../common/var/_utc'),
    trunc = require('../../common/var/trunc'),
    forEach = require('../../common/internal/forEach'),
    tzOffset = require('./tzOffset'),
    resetTime = require('./resetTime'),
    isDefined = require('../../common/internal/isDefined'),
    setWeekday = require('./setWeekday'),
    updateDate = require('./updateDate'),
    getNewDate = require('./getNewDate'),
    isUndefined = require('../../common/internal/isUndefined'),
    classChecks = require('../../common/var/classChecks'),
    advanceDate = require('./advanceDate'),
    simpleClone = require('../../common/internal/simpleClone'),
    isObjectType = require('../../common/internal/isObjectType'),
    moveToEndOfUnit = require('./moveToEndOfUnit'),
    deleteDateParam = require('./deleteDateParam'),
    coreUtilityAliases = require('../../common/var/coreUtilityAliases'),
    getParsingTokenValue = require('./getParsingTokenValue'),
    moveToBeginningOfUnit = require('./moveToBeginningOfUnit'),
    iterateOverDateParams = require('./iterateOverDateParams'),
    getYearFromAbbreviation = require('./getYearFromAbbreviation'),
    iterateOverHigherDateParams = require('./iterateOverHigherDateParams');

var isNumber = classChecks.isNumber,
    isString = classChecks.isString,
    isDate = classChecks.isDate,
    hasOwn = coreUtilityAliases.hasOwn,
    getOwn = coreUtilityAliases.getOwn,
    English = LocaleHelpers.English,
    localeManager = LocaleHelpers.localeManager,
    DAY_INDEX = DateUnitIndexes.DAY_INDEX,
    WEEK_INDEX = DateUnitIndexes.WEEK_INDEX,
    MONTH_INDEX = DateUnitIndexes.MONTH_INDEX,
    YEAR_INDEX = DateUnitIndexes.YEAR_INDEX;

function getExtendedDate(contextDate, d, opt, forceClone) {

  var date, set, loc, options, afterCallbacks, relative, weekdayDir;

  afterCallbacks = [];
  options = getDateOptions(opt);

  function getDateOptions(opt) {
    var options = isString(opt) ? { locale: opt } : opt || {};
    options.prefer = +!!getOwn(options, 'future') - +!!getOwn(options, 'past');
    return options;
  }

  function getFormatParams(match, dif) {
    var set = getOwn(options, 'params') || {};
    forEach(dif.to, function(field, i) {
      var str = match[i + 1], token, val;
      if (!str) return;
      if (field === 'yy' || field === 'y') {
        field = 'year';
        val = getYearFromAbbreviation(str, date, getOwn(options, 'prefer'));
      } else if (token = getOwn(ParsingTokens, field)) {
        field = token.param || field;
        val = getParsingTokenValue(token, str);
      } else {
        val = loc.getTokenValue(field, str);
      }
      set[field] = val;
    });
    return set;
  }

  // Clone date will set the utc flag, but it will
  // be overriden later, so set option flags instead.
  function cloneDateByFlag(d, clone) {
    if (_utc(d) && !isDefined(getOwn(options, 'fromUTC'))) {
      options.fromUTC = true;
    }
    if (_utc(d) && !isDefined(getOwn(options, 'setUTC'))) {
      options.setUTC = true;
    }
    if (clone) {
      d = new Date(d.getTime());
    }
    return d;
  }

  function afterDateSet(fn) {
    afterCallbacks.push(fn);
  }

  function fireCallbacks() {
    forEach(afterCallbacks, function(fn) {
      fn.call();
    });
  }

  function parseStringDate(str) {

    str = str.toLowerCase();

    // The act of getting the locale will initialize
    // if it is missing and add the required formats.
    loc = localeManager.get(getOwn(options, 'locale'));

    for (var i = 0, dif, match; dif = loc.compiledFormats[i]; i++) {
      match = str.match(dif.reg);
      if (match) {

        // Note that caching the format will modify the compiledFormats array
        // which is not a good idea to do inside its for loop, however we
        // know at this point that we have a matched format and that we will
        // break out below, so simpler to do it here.
        loc.cacheFormat(dif, i);

        set = getFormatParams(match, dif);

        if (isDefined(set.timestamp)) {
          str = set.timestamp;
          set = null;
          break;
        }

        if (isDefined(set.ampm)) {
          handleAmpm(set.ampm);
        }

        if (set.utc || isDefined(set.tzHour)) {
          handleTimezoneOffset(set.tzHour, set.tzMinute, set.tzSign);
        }

        if (isDefined(set.shift) && isUndefined(set.unit)) {
          // "next january", "next monday", etc
          handleUnitlessShift();
        }

        if (isDefined(set.num) && isUndefined(set.unit)) {
          // "the second of January", etc
          handleUnitlessNum(set.num);
        }

        if (set.midday) {
          // "noon" and "midnight"
          handleMidday(set.midday);
        }

        if (isDefined(set.day)) {
          // Relative day localizations such as "today" and "tomorrow".
          handleRelativeDay(set.day);
        }

        if (isDefined(set.unit)) {
          // "3 days ago", etc
          handleRelativeUnit(set.unit);
        }

        if (set.edge) {
          // "the end of January", etc
          handleEdge(set.edge, set);
        }

        if (set.yearSign) {
          set.year *= set.yearSign;
        }

        break;
      }
    }

    if (!set) {
      // Fall back to native parsing
      date = new Date(str);
      if (getOwn(options, 'fromUTC')) {
        // Falling back to system date here which cannot be parsed as UTC,
        // so if we're forcing UTC then simply add the offset.
        date.setTime(date.getTime() + (tzOffset(date) * MINUTES));
      }
    } else if (relative) {
      updateDate(date, set, false, 1);
    } else {
      if (_utc(date)) {
        // UTC times can traverse into other days or even months,
        // so preemtively reset the time here to prevent this.
        resetTime(date);
      }
      updateDate(date, set, true, 0, getOwn(options, 'prefer'), weekdayDir);
    }
    fireCallbacks();
    return date;
  }

  function handleAmpm(ampm) {
    if (ampm === 1 && set.hour < 12) {
      // If the time is 1pm-11pm advance the time by 12 hours.
      set.hour += 12;
    } else if (ampm === 0 && set.hour === 12) {
      // If it is 12:00am then set the hour to 0.
      set.hour = 0;
    }
  }

  function handleTimezoneOffset(tzHour, tzMinute, tzSign) {
    // Adjust for timezone offset
    _utc(date, true);
    var offset = (tzSign || 1) * ((tzHour || 0) * 60 + (tzMinute || 0));
    if (offset) {
      set.minute = (set.minute || 0) - offset;
    }
  }

  function handleUnitlessShift() {
    if (isDefined(set.month)) {
      // "next January"
      set.unit = YEAR_INDEX;
    } else if (isDefined(set.weekday)) {
      // "next Monday"
      set.unit = WEEK_INDEX;
    }
  }

  function handleUnitlessNum(num) {
    if (isDefined(set.weekday)) {
      // "The second Tuesday of March"
      setOrdinalWeekday(num);
    } else if (isDefined(set.month)) {
      // "The second of March"
      set.date = set.num;
    }
  }

  function handleMidday(hour) {
    set.hour = hour % 24;
    if (hour > 23) {
      // If the date has hours past 24, we need to prevent it from traversing
      // into a new day as that would make it being part of a new week in
      // ambiguous dates such as "Monday".
      afterDateSet(function() {
        advanceDate(date, 'date', trunc(hour / 24));
      });
    }
  }

  function handleRelativeDay() {
    resetTime(date);
    if (isUndefined(set.unit)) {
      set.unit = DAY_INDEX;
      set.num  = set.day;
      delete set.day;
    }
  }

  function handleRelativeUnit(unitIndex) {
    var num = isDefined(set.num) ? set.num : 1;

    // If a weekday is defined, there are 3 possible formats being applied:
    //
    // 1. "the day after monday": unit is days
    // 2. "next monday": short for "next week monday", unit is weeks
    // 3. "the 2nd monday of next month": unit is months
    //
    // In the first case, we need to set the weekday up front, as the day is
    // relative to it. The second case also needs to be handled up front for
    // formats like "next monday at midnight" which will have its weekday reset
    // if not set up front. The last case will set up the params necessary to
    // shift the weekday and allow separateAbsoluteUnits below to handle setting
    // it after the date has been shifted.
    if(isDefined(set.weekday)) {
      if(unitIndex === MONTH_INDEX) {
        setOrdinalWeekday(num);
        num = 1;
      } else {
        updateDate(date, { weekday: set.weekday }, true);
        delete set.weekday;
      }
    }

    if (set.half) {
      // Allow localized "half" as a standalone colloquialism. Purposely avoiding
      // the locale number system to reduce complexity. The units "month" and
      // "week" are purposely excluded in the English date formats below, as
      // "half a week" and "half a month" are meaningless as exact dates.
      num *= set.half;
    }

    if (isDefined(set.shift)) {
      // Shift and unit, ie "next month", "last week", etc.
      num *= set.shift;
    } else if (set.sign) {
      // Unit and sign, ie "months ago", "weeks from now", etc.
      num *= set.sign;
    }

    if (isDefined(set.day)) {
      // "the day after tomorrow"
      num += set.day;
      delete set.day;
    }

    // Formats like "the 15th of last month" or "6:30pm of next week"
    // contain absolute units in addition to relative ones, so separate
    // them here, remove them from the params, and set up a callback to
    // set them after the relative ones have been set.
    separateAbsoluteUnits(unitIndex);

    // Finally shift the unit.
    set[English.units[unitIndex]] = num;
    relative = true;
  }

  function handleEdge(edge, params) {
    var edgeIndex = params.unit, weekdayOfMonth;
    if (!edgeIndex) {
      // If we have "the end of January", then we need to find the unit index.
      iterateOverHigherDateParams(params, function(unitName, val, unit, i) {
        if (unitName === 'weekday' && isDefined(params.month)) {
          // If both a month and weekday exist, then we have a format like
          // "the last tuesday in November, 2012", where the "last" is still
          // relative to the end of the month, so prevent the unit "weekday"
          // from taking over.
          return;
        }
        edgeIndex = i;
      });
    }
    if (edgeIndex === MONTH_INDEX && isDefined(params.weekday)) {
      // If a weekday in a month exists (as described above),
      // then set it up to be set after the date has been shifted.
      weekdayOfMonth = params.weekday;
      delete params.weekday;
    }
    afterDateSet(function() {
      var stopIndex;
      // "edge" values that are at the very edge are "2" so the beginning of the
      // year is -2 and the end of the year is 2. Conversely, the "last day" is
      // actually 00:00am so it is 1. -1 is reserved but unused for now.
      if (edge < 0) {
        moveToBeginningOfUnit(date, edgeIndex, getOwn(options, 'locale'));
      } else if (edge > 0) {
        if (edge === 1) {
          stopIndex = DAY_INDEX;
          moveToBeginningOfUnit(date, DAY_INDEX);
        }
        moveToEndOfUnit(date, edgeIndex, getOwn(options, 'locale'), stopIndex);
      }
      if (isDefined(weekdayOfMonth)) {
        setWeekday(date, weekdayOfMonth, -edge);
        resetTime(date);
      }
    });
    if (edgeIndex === MONTH_INDEX) {
      params.specificity = DAY_INDEX;
    } else {
      params.specificity = edgeIndex - 1;
    }
  }

  function setOrdinalWeekday(num) {
    // If we have "the 2nd Tuesday of June", then pass the "weekdayDir"
    // flag along to updateDate so that the date does not accidentally traverse
    // into the previous month. This needs to be independent of the "prefer"
    // flag because we are only ensuring that the weekday is in the future, not
    // the entire date.
    set.weekday = 7 * (num - 1) + set.weekday;
    set.date = 1;
    weekdayDir = 1;
  }

  function separateAbsoluteUnits(unitIndex) {
    var params;

    iterateOverDateParams(set, function(name, val, unit, i) {
      // If there is a time unit set that is more specific than
      // the matched unit we have a string like "5:30am in 2 minutes",
      // which is meaningless, so invalidate the date...
      if (i >= unitIndex) {
        date.setTime(NaN);
        return false;
      } else if (i < unitIndex) {
        // ...otherwise set the params to set the absolute date
        // as a callback after the relative date has been set.
        params = params || {};
        params[name] = val;
        deleteDateParam(set, name);
      }
    });
    if (params) {
      afterDateSet(function() {
        updateDate(date, params, true, false, getOwn(options, 'prefer'), weekdayDir);
      });
      if (set.edge) {
        // "the end of March of next year"
        handleEdge(set.edge, params);
        delete set.edge;
      }
    }
  }

  if (contextDate && d) {
    // If a context date is passed ("get" and "unitsFromNow"),
    // then use it as the starting point.
    date = cloneDateByFlag(contextDate, true);
  } else {
    date = getNewDate();
  }

  _utc(date, getOwn(options, 'fromUTC'));

  if (isString(d)) {
    date = parseStringDate(d);
  } else if (isDate(d)) {
    date = cloneDateByFlag(d, hasOwn(options, 'clone') || forceClone);
  } else if (isObjectType(d)) {
    set = simpleClone(d);
    updateDate(date, set, true);
  } else if (isNumber(d) || d === null) {
    date.setTime(d);
  }
  // A date created by parsing a string presumes that the format *itself* is
  // UTC, but not that the date, once created, should be manipulated as such. In
  // other words, if you are creating a date object from a server time
  // "2012-11-15T12:00:00Z", in the majority of cases you are using it to create
  // a date that will, after creation, be manipulated as local, so reset the utc
  // flag here unless "setUTC" is also set.
  _utc(date, !!getOwn(options, 'setUTC'));
  return {
    set: set,
    date: date
  };
}

module.exports = getExtendedDate;
},{"../../common/internal/forEach":129,"../../common/internal/isDefined":149,"../../common/internal/isObjectType":151,"../../common/internal/isUndefined":155,"../../common/internal/simpleClone":172,"../../common/var/_utc":190,"../../common/var/classChecks":192,"../../common/var/coreUtilityAliases":193,"../../common/var/trunc":198,"../var/DateUnitIndexes":382,"../var/LocaleHelpers":389,"../var/MINUTES":391,"../var/ParsingTokens":392,"./advanceDate":245,"./deleteDateParam":264,"./getNewDate":283,"./getParsingTokenValue":285,"./getYearFromAbbreviation":295,"./iterateOverDateParams":297,"./iterateOverHigherDateParams":299,"./moveToBeginningOfUnit":300,"./moveToEndOfUnit":302,"./resetTime":306,"./setWeekday":312,"./tzOffset":314,"./updateDate":315}],278:[function(require,module,exports){
'use strict';

var DateUnitIndexes = require('../var/DateUnitIndexes');

var DAY_INDEX = DateUnitIndexes.DAY_INDEX,
    MONTH_INDEX = DateUnitIndexes.MONTH_INDEX;

function getHigherUnitIndex(index) {
  return index === DAY_INDEX ? MONTH_INDEX : index + 1;
}

module.exports = getHigherUnitIndex;
},{"../var/DateUnitIndexes":382}],279:[function(require,module,exports){
'use strict';

var callDateGet = require('../../common/internal/callDateGet');

function getHours(d) {
  return callDateGet(d, 'Hours');
}

module.exports = getHours;
},{"../../common/internal/callDateGet":108}],280:[function(require,module,exports){
'use strict';

var DateUnitIndexes = require('../var/DateUnitIndexes');

var HOURS_INDEX = DateUnitIndexes.HOURS_INDEX,
    DAY_INDEX = DateUnitIndexes.DAY_INDEX,
    WEEK_INDEX = DateUnitIndexes.WEEK_INDEX,
    MONTH_INDEX = DateUnitIndexes.MONTH_INDEX;

function getLowerUnitIndex(index) {
  if (index === MONTH_INDEX) {
    return DAY_INDEX;
  } else if (index === WEEK_INDEX) {
    return HOURS_INDEX;
  }
  return index - 1;
}

module.exports = getLowerUnitIndex;
},{"../var/DateUnitIndexes":382}],281:[function(require,module,exports){
'use strict';

var LocaleHelpers = require('../var/LocaleHelpers'),
    trunc = require('../../common/var/trunc'),
    getHours = require('./getHours');

var localeManager = LocaleHelpers.localeManager;

function getMeridiemToken(d, localeCode) {
  var hours = getHours(d);
  return localeManager.get(localeCode).ampm[trunc(hours / 12)] || '';
}

module.exports = getMeridiemToken;
},{"../../common/var/trunc":198,"../var/LocaleHelpers":389,"./getHours":279}],282:[function(require,module,exports){
'use strict';

var callDateGet = require('../../common/internal/callDateGet');

function getMonth(d) {
  return callDateGet(d, 'Month');
}

module.exports = getMonth;
},{"../../common/internal/callDateGet":108}],283:[function(require,module,exports){
'use strict';

var _dateOptions = require('../var/_dateOptions');

function getNewDate() {
  return _dateOptions('newDateInternal')();
}

module.exports = getNewDate;
},{"../var/_dateOptions":394}],284:[function(require,module,exports){
'use strict';

var LOCALE_ARRAY_FIELDS = require('../var/LOCALE_ARRAY_FIELDS'),
    ISODefaults = require('../var/ISODefaults'),
    ParsingTokens = require('../var/ParsingTokens'),
    CoreParsingFormats = require('../var/CoreParsingFormats'),
    LocalizedParsingTokens = require('../var/LocalizedParsingTokens'),
    map = require('../../common/internal/map'),
    filter = require('../../common/internal/filter'),
    forEach = require('../../common/internal/forEach'),
    isDefined = require('../../common/internal/isDefined'),
    commaSplit = require('../../common/internal/commaSplit'),
    classChecks = require('../../common/var/classChecks'),
    isUndefined = require('../../common/internal/isUndefined'),
    mathAliases = require('../../common/var/mathAliases'),
    simpleMerge = require('../../common/internal/simpleMerge'),
    getOrdinalSuffix = require('../../common/internal/getOrdinalSuffix'),
    getRegNonCapturing = require('./getRegNonCapturing'),
    coreUtilityAliases = require('../../common/var/coreUtilityAliases'),
    getArrayWithOffset = require('./getArrayWithOffset'),
    iterateOverDateUnits = require('./iterateOverDateUnits'),
    arrayToRegAlternates = require('./arrayToRegAlternates'),
    fullwidthNumberHelpers = require('../../common/var/fullwidthNumberHelpers'),
    getAdjustedUnitForNumber = require('./getAdjustedUnitForNumber'),
    getParsingTokenWithSuffix = require('./getParsingTokenWithSuffix');

var getOwn = coreUtilityAliases.getOwn,
    forEachProperty = coreUtilityAliases.forEachProperty,
    fullWidthNumberMap = fullwidthNumberHelpers.fullWidthNumberMap,
    fullWidthNumbers = fullwidthNumberHelpers.fullWidthNumbers,
    pow = mathAliases.pow,
    max = mathAliases.max,
    ISO_FIRST_DAY_OF_WEEK = ISODefaults.ISO_FIRST_DAY_OF_WEEK,
    ISO_FIRST_DAY_OF_WEEK_YEAR = ISODefaults.ISO_FIRST_DAY_OF_WEEK_YEAR,
    isString = classChecks.isString,
    isFunction = classChecks.isFunction;

function getNewLocale(def) {

  function Locale(def) {
    this.init(def);
  }

  Locale.prototype = {

    getMonthName: function(n, alternate) {
      if (this.monthSuffix) {
        return (n + 1) + this.monthSuffix;
      }
      return getArrayWithOffset(this.months, n, alternate, 12);
    },

    getWeekdayName: function(n, alternate) {
      return getArrayWithOffset(this.weekdays, n, alternate, 7);
    },

    getTokenValue: function(field, str) {
      var map = this[field + 'Map'], val;
      if (map) {
        val = map[str];
      }
      if (isUndefined(val)) {
        val = this.getNumber(str);
        if (field === 'month') {
          // Months are the only numeric date field
          // whose value is not the same as its number.
          val -= 1;
        }
      }
      return val;
    },

    getNumber: function(str) {
      var num = this.numeralMap[str];
      if (isDefined(num)) {
        return num;
      }
      // The unary plus operator here show better performance and handles
      // every format that parseFloat does with the exception of trailing
      // characters, which are guaranteed not to be in our string at this point.
      num = +str.replace(/,/, '.');
      if (!isNaN(num)) {
        return num;
      }
      num = this.getNumeralValue(str);
      if (!isNaN(num)) {
        this.numeralMap[str] = num;
        return num;
      }
      return num;
    },

    getNumeralValue: function(str) {
      var place = 1, num = 0, lastWasPlace, isPlace, numeral, digit, arr;
      // Note that "numerals" that need to be converted through this method are
      // all considered to be single characters in order to handle CJK. This
      // method is by no means unique to CJK, but the complexity of handling
      // inflections in non-CJK languages adds too much overhead for not enough
      // value, so avoiding for now.
      arr = str.split('');
      for (var i = arr.length - 1; numeral = arr[i]; i--) {
        digit = getOwn(this.numeralMap, numeral);
        if (isUndefined(digit)) {
          digit = getOwn(fullWidthNumberMap, numeral) || 0;
        }
        isPlace = digit > 0 && digit % 10 === 0;
        if (isPlace) {
          if (lastWasPlace) {
            num += place;
          }
          if (i) {
            place = digit;
          } else {
            num += digit;
          }
        } else {
          num += digit * place;
          place *= 10;
        }
        lastWasPlace = isPlace;
      }
      return num;
    },

    getOrdinal: function(n) {
      var suffix = this.ordinalSuffix;
      return suffix || getOrdinalSuffix(n);
    },

    getRelativeFormat: function(adu, type) {
      return this.convertAdjustedToFormat(adu, type);
    },

    getDuration: function(ms) {
      return this.convertAdjustedToFormat(getAdjustedUnitForNumber(max(0, ms)), 'duration');
    },

    getFirstDayOfWeek: function() {
      var val = this.firstDayOfWeek;
      return isDefined(val) ? val : ISO_FIRST_DAY_OF_WEEK;
    },

    getFirstDayOfWeekYear: function() {
      return this.firstDayOfWeekYear || ISO_FIRST_DAY_OF_WEEK_YEAR;
    },

    convertAdjustedToFormat: function(adu, type) {
      var sign, unit, mult,
          num    = adu[0],
          u      = adu[1],
          ms     = adu[2],
          format = this[type] || this.relative;
      if (isFunction(format)) {
        return format.call(this, num, u, ms, type);
      }
      mult = !this.plural || num === 1 ? 0 : 1;
      unit = this.units[mult * 8 + u] || this.units[u];
      sign = this[ms > 0 ? 'fromNow' : 'ago'];
      return format.replace(/\{(.*?)\}/g, function(full, match) {
        switch(match) {
          case 'num': return num;
          case 'unit': return unit;
          case 'sign': return sign;
        }
      });
    },

    cacheFormat: function(dif, i) {
      this.compiledFormats.splice(i, 1);
      this.compiledFormats.unshift(dif);
    },

    addFormat: function(src, to) {
      var loc = this;

      function getTokenSrc(str) {
        var suffix, src, val,
            opt   = str.match(/\?$/),
            nc    = str.match(/^(\d+)\??$/),
            slice = str.match(/(\d)(?:-(\d))?/),
            key   = str.replace(/[^a-z]+$/i, '');

        // Allowing alias tokens such as {time}
        if (val = getOwn(loc.parsingAliases, key)) {
          src = replaceParsingTokens(val);
          if (opt) {
            src = getRegNonCapturing(src, true);
          }
          return src;
        }

        if (nc) {
          src = loc.tokens[nc[1]];
        } else if (val = getOwn(ParsingTokens, key)) {
          src = val.src;
        } else {
          val = getOwn(loc.parsingTokens, key) || getOwn(loc, key);

          // Both the "months" array and the "month" parsing token can be accessed
          // by either {month} or {months}, falling back as necessary, however
          // regardless of whether or not a fallback occurs, the final field to
          // be passed to addRawFormat must be normalized as singular.
          key = key.replace(/s$/, '');

          if (!val) {
            val = getOwn(loc.parsingTokens, key) || getOwn(loc, key + 's');
          }

          if (isString(val)) {
            src = val;
            suffix = loc[key + 'Suffix'];
          } else {
            if (slice) {
              val = filter(val, function(m, i) {
                var mod = i % (loc.units ? 8 : val.length);
                return mod >= slice[1] && mod <= (slice[2] || slice[1]);
              });
            }
            src = arrayToRegAlternates(val);
          }
        }
        if (!src) {
          return '';
        }
        if (nc) {
          // Non-capturing tokens like {0}
          src = getRegNonCapturing(src);
        } else {
          // Capturing group and add to parsed tokens
          to.push(key);
          src = '(' + src + ')';
        }
        if (suffix) {
          // Date/time suffixes such as those in CJK
          src = getParsingTokenWithSuffix(key, src, suffix);
        }
        if (opt) {
          src += '?';
        }
        return src;
      }

      function replaceParsingTokens(str) {

        // Make spaces optional
        str = str.replace(/ /g, ' ?');

        return str.replace(/\{([^,]+?)\}/g, function(match, token) {
          var tokens = token.split('|'), src;
          if (tokens.length > 1) {
            src = getRegNonCapturing(map(tokens, getTokenSrc).join('|'));
          } else {
            src = getTokenSrc(token);
          }
          return src;
        });
      }

      if (!to) {
        to = [];
        src = replaceParsingTokens(src);
      }

      loc.addRawFormat(src, to);
    },

    addRawFormat: function(format, to) {
      this.compiledFormats.unshift({
        reg: RegExp('^ *' + format + ' *$', 'i'),
        to: to
      });
    },

    init: function(def) {
      var loc = this;

      // -- Initialization helpers

      function initFormats() {
        loc.compiledFormats = [];
        loc.parsingAliases = {};
        loc.parsingTokens = {};
      }

      function initDefinition() {
        simpleMerge(loc, def);
      }

      function initArrayFields() {
        forEach(LOCALE_ARRAY_FIELDS, function(name) {
          var val = loc[name];
          if (isString(val)) {
            loc[name] = commaSplit(val);
          } else if (!val) {
            loc[name] = [];
          }
        });
      }

      // -- Value array build helpers

      function buildValueArray(name, mod, map, fn) {
        var field = name, all = [], setMap;
        if (!loc[field]) {
          field += 's';
        }
        if (!map) {
          map = {};
          setMap = true;
        }
        forAllAlternates(field, function(alt, j, i) {
          var idx = j * mod + i, val;
          val = fn ? fn(i) : i;
          map[alt] = val;
          map[alt.toLowerCase()] = val;
          all[idx] = alt;
        });
        loc[field] = all;
        if (setMap) {
          loc[name + 'Map'] = map;
        }
      }

      function forAllAlternates(field, fn) {
        forEach(loc[field], function(str, i) {
          forEachAlternate(str, function(alt, j) {
            fn(alt, j, i);
          });
        });
      }

      function forEachAlternate(str, fn) {
        var arr = map(str.split('+'), function(split) {
          return split.replace(/(.+):(.+)$/, function(full, base, suffixes) {
            return map(suffixes.split('|'), function(suffix) {
              return base + suffix;
            }).join('|');
          });
        }).join('|');
        forEach(arr.split('|'), fn);
      }

      function buildNumerals() {
        var map = {};
        buildValueArray('numeral', 10, map);
        buildValueArray('article', 1, map, function() {
          return 1;
        });
        buildValueArray('placeholder', 4, map, function(n) {
          return pow(10, n + 1);
        });
        loc.numeralMap = map;
      }

      function buildTimeFormats() {
        loc.parsingAliases['time'] = getTimeFormat();
        loc.parsingAliases['tzOffset'] = getTZOffsetFormat();
      }

      function getTimeFormat() {
        var src;
        if (loc.ampmFront) {
          // "ampmFront" exists mostly for CJK locales, which also presume that
          // time suffixes exist, allowing this to be a simpler regex.
          src = '{ampm?} {hour} (?:{minute} (?::?{second})?)?';
        } else if(loc.ampm.length) {
          src = '{hour}(?:[.:]{minute}(?:[.:]{second})? {ampm?}| {ampm})';
        } else {
          src = '{hour}(?:[.:]{minute}(?:[.:]{second})?)';
        }
        return src;
      }

      function getTZOffsetFormat() {
        return '(?:{Z}|{GMT?}(?:{tzSign}{tzHour}(?::?{tzMinute}(?: \\([\\w\\s]+\\))?)?)?)?';
      }

      function buildParsingTokens() {
        forEachProperty(LocalizedParsingTokens, function(token, name) {
          var src, arr;
          src = token.base ? ParsingTokens[token.base].src : token.src;
          if (token.requiresNumerals || loc.numeralUnits) {
            src += getNumeralSrc();
          }
          arr = loc[name + 's'];
          if (arr && arr.length) {
            src += '|' + arrayToRegAlternates(arr);
          }
          loc.parsingTokens[name] = src;
        });
      }

      function getNumeralSrc() {
        var all, src = '';
        all = loc.numerals.concat(loc.placeholders).concat(loc.articles);
        if (loc.allowsFullWidth) {
          all = all.concat(fullWidthNumbers.split(''));
        }
        if (all.length) {
          src = '|(?:' + arrayToRegAlternates(all) + ')+';
        }
        return src;
      }

      function buildTimeSuffixes() {
        iterateOverDateUnits(function(unit, i) {
          var token = loc.timeSuffixes[i];
          if (token) {
            loc[(unit.alias || unit.name) + 'Suffix'] = token;
          }
        });
      }

      function buildModifiers() {
        forEach(loc.modifiers, function(modifier) {
          var name = modifier.name, mapKey = name + 'Map', map;
          map = loc[mapKey] || {};
          forEachAlternate(modifier.src, function(alt, j) {
            var token = getOwn(loc.parsingTokens, name), val = modifier.value;
            map[alt] = val;
            loc.parsingTokens[name] = token ? token + '|' + alt : alt;
            if (modifier.name === 'sign' && j === 0) {
              // Hooking in here to set the first "fromNow" or "ago" modifier
              // directly on the locale, so that it can be reused in the
              // relative format.
              loc[val === 1 ? 'fromNow' : 'ago'] = alt;
            }
          });
          loc[mapKey] = map;
        });
      }

      // -- Format adding helpers

      function addCoreFormats() {
        forEach(CoreParsingFormats, function(df) {
          var src = df.src;
          if (df.mdy && loc.mdy) {
            // Use the mm/dd/yyyy variant if it
            // exists and the locale requires it
            src = df.mdy;
          }
          if (df.time) {
            // Core formats that allow time require the time
            // reg on both sides, so add both versions here.
            loc.addFormat(getFormatWithTime(src, true));
            loc.addFormat(getFormatWithTime(src));
          } else {
            loc.addFormat(src);
          }
        });
        loc.addFormat('{time}');
      }

      function addLocaleFormats() {
        addFormatSet('parse');
        addFormatSet('timeParse', true);
        addFormatSet('timeFrontParse', true, true);
      }

      function addFormatSet(field, allowTime, timeFront) {
        forEach(loc[field], function(format) {
          if (allowTime) {
            format = getFormatWithTime(format, timeFront);
          }
          loc.addFormat(format);
        });
      }

      function getFormatWithTime(baseFormat, timeBefore) {
        if (timeBefore) {
          return getTimeBefore() + baseFormat;
        }
        return baseFormat + getTimeAfter();
      }

      function getTimeBefore() {
        return getRegNonCapturing('{time}[,\\s\\u3000]', true);
      }

      function getTimeAfter() {
        var markers = ',?[\\s\\u3000]', localized;
        localized = arrayToRegAlternates(loc.timeMarkers);
        if (localized) {
          markers += '| (?:' + localized + ') ';
        }
        markers = getRegNonCapturing(markers, loc.timeMarkerOptional);
        return getRegNonCapturing(markers + '{time}', true);
      }

      initFormats();
      initDefinition();
      initArrayFields();

      buildValueArray('month', 12);
      buildValueArray('weekday', 7);
      buildValueArray('unit', 8);
      buildValueArray('ampm', 2);

      buildNumerals();
      buildTimeFormats();
      buildParsingTokens();
      buildTimeSuffixes();
      buildModifiers();

      // The order of these formats is important. Order is reversed so formats
      // that are initialized later will take precedence. Generally, this means
      // that more specific formats should come later.
      addCoreFormats();
      addLocaleFormats();

    }

  };

  return new Locale(def);
}

module.exports = getNewLocale;
},{"../../common/internal/commaSplit":113,"../../common/internal/filter":127,"../../common/internal/forEach":129,"../../common/internal/getOrdinalSuffix":138,"../../common/internal/isDefined":149,"../../common/internal/isUndefined":155,"../../common/internal/map":158,"../../common/internal/simpleMerge":173,"../../common/var/classChecks":192,"../../common/var/coreUtilityAliases":193,"../../common/var/fullwidthNumberHelpers":194,"../../common/var/mathAliases":195,"../var/CoreParsingFormats":380,"../var/ISODefaults":386,"../var/LOCALE_ARRAY_FIELDS":387,"../var/LocalizedParsingTokens":390,"../var/ParsingTokens":392,"./arrayToRegAlternates":247,"./getAdjustedUnitForNumber":268,"./getArrayWithOffset":269,"./getParsingTokenWithSuffix":286,"./getRegNonCapturing":287,"./iterateOverDateUnits":298}],285:[function(require,module,exports){
'use strict';

function getParsingTokenValue(token, str) {
  var val;
  if (token.val) {
    val = token.val;
  } else if (token.sign) {
    val = str === '+' ? 1 : -1;
  } else if (token.bool) {
    val = !!val;
  } else {
    val = +str.replace(/,/, '.');
  }
  if (token.param === 'month') {
    val -= 1;
  }
  return val;
}

module.exports = getParsingTokenValue;
},{}],286:[function(require,module,exports){
'use strict';

var LocalizedParsingTokens = require('../var/LocalizedParsingTokens'),
    getRegNonCapturing = require('./getRegNonCapturing');

function getParsingTokenWithSuffix(field, src, suffix) {
  var token = LocalizedParsingTokens[field];
  if (token.requiresSuffix) {
    src = getRegNonCapturing(src + getRegNonCapturing(suffix));
  } else if (token.requiresSuffixOr) {
    src += getRegNonCapturing(token.requiresSuffixOr + '|' + suffix);
  } else {
    src += getRegNonCapturing(suffix, true);
  }
  return src;
}

module.exports = getParsingTokenWithSuffix;
},{"../var/LocalizedParsingTokens":390,"./getRegNonCapturing":287}],287:[function(require,module,exports){
'use strict';

function getRegNonCapturing(src, opt) {
  if (src.length > 1) {
    src = '(?:' + src + ')';
  }
  if (opt) {
    src += '?';
  }
  return src;
}

module.exports = getRegNonCapturing;
},{}],288:[function(require,module,exports){
'use strict';

var trunc = require('../../common/var/trunc'),
    cloneDate = require('./cloneDate'),
    advanceDate = require('./advanceDate');

function getTimeDistanceForUnit(d1, d2, unit) {
  var fwd = d2 > d1, num, tmp;
  if (!fwd) {
    tmp = d2;
    d2  = d1;
    d1  = tmp;
  }
  num = d2 - d1;
  if (unit.multiplier > 1) {
    num = trunc(num / unit.multiplier);
  }
  // For higher order with potential ambiguity, use the numeric calculation
  // as a starting point, then iterate until we pass the target date.
  if (unit.ambiguous) {
    d1 = cloneDate(d1);
    if (num) {
      advanceDate(d1, unit.name, num);
    }
    while (d1 < d2) {
      advanceDate(d1, unit.name, 1);
      if (d1 > d2) {
        break;
      }
      num += 1;
    }
  }
  return fwd ? -num : num;
}

module.exports = getTimeDistanceForUnit;
},{"../../common/var/trunc":198,"./advanceDate":245,"./cloneDate":253}],289:[function(require,module,exports){
'use strict';

var _utc = require('../../common/var/_utc'),
    trunc = require('../../common/var/trunc'),
    tzOffset = require('./tzOffset'),
    padNumber = require('../../common/internal/padNumber'),
    mathAliases = require('../../common/var/mathAliases');

var abs = mathAliases.abs;

function getUTCOffset(d, iso) {
  var offset = _utc(d) ? 0 : tzOffset(d), hours, mins, colon;
  colon  = iso === true ? ':' : '';
  if (!offset && iso) return 'Z';
  hours = padNumber(trunc(-offset / 60), 2, true);
  mins = padNumber(abs(offset % 60), 2);
  return  hours + colon + mins;
}

module.exports = getUTCOffset;
},{"../../common/internal/padNumber":162,"../../common/var/_utc":190,"../../common/var/mathAliases":195,"../../common/var/trunc":198,"./tzOffset":314}],290:[function(require,module,exports){
'use strict';

var iterateOverDateParams = require('./iterateOverDateParams');

function getUnitIndexForParamName(name) {
  var params = {}, unitIndex;
  params[name] = 1;
  iterateOverDateParams(params, function(name, val, unit, i) {
    unitIndex = i;
    return false;
  });
  return unitIndex;
}

module.exports = getUnitIndexForParamName;
},{"./iterateOverDateParams":297}],291:[function(require,module,exports){
'use strict';

var ISODefaults = require('../var/ISODefaults'),
    setDate = require('./setDate'),
    getDate = require('./getDate'),
    cloneDate = require('./cloneDate'),
    isUndefined = require('../../common/internal/isUndefined'),
    moveToEndOfWeek = require('./moveToEndOfWeek'),
    moveToBeginningOfWeek = require('./moveToBeginningOfWeek'),
    moveToFirstDayOfWeekYear = require('./moveToFirstDayOfWeekYear');

var ISO_FIRST_DAY_OF_WEEK = ISODefaults.ISO_FIRST_DAY_OF_WEEK,
    ISO_FIRST_DAY_OF_WEEK_YEAR = ISODefaults.ISO_FIRST_DAY_OF_WEEK_YEAR;

function getWeekNumber(d, allowPrevious, firstDayOfWeek, firstDayOfWeekYear) {
  var isoWeek, n = 0;
  if (isUndefined(firstDayOfWeek)) {
    firstDayOfWeek = ISO_FIRST_DAY_OF_WEEK;
  }
  if (isUndefined(firstDayOfWeekYear)) {
    firstDayOfWeekYear = ISO_FIRST_DAY_OF_WEEK_YEAR;
  }
  // Moving to the end of the week allows for forward year traversal, ie
  // Dec 29 2014 is actually week 01 of 2015.
  isoWeek = moveToEndOfWeek(cloneDate(d), firstDayOfWeek);
  moveToFirstDayOfWeekYear(isoWeek, firstDayOfWeek, firstDayOfWeekYear);
  if (allowPrevious && d < isoWeek) {
    // If the date is still before the start of the year, then it should be
    // the last week of the previous year, ie Jan 1 2016 is actually week 53
    // of 2015, so move to the beginning of the week to traverse the year.
    isoWeek = moveToBeginningOfWeek(cloneDate(d), firstDayOfWeek);
    moveToFirstDayOfWeekYear(isoWeek, firstDayOfWeek, firstDayOfWeekYear);
  }
  while (isoWeek <= d) {
    // Doing a very simple walk to get the week number.
    setDate(isoWeek, getDate(isoWeek) + 7);
    n++;
  }
  return n;
}

module.exports = getWeekNumber;
},{"../../common/internal/isUndefined":155,"../var/ISODefaults":386,"./cloneDate":253,"./getDate":270,"./moveToBeginningOfWeek":301,"./moveToEndOfWeek":303,"./moveToFirstDayOfWeekYear":304,"./setDate":307}],292:[function(require,module,exports){
'use strict';

var LocaleHelpers = require('../var/LocaleHelpers'),
    getYear = require('./getYear'),
    getMonth = require('./getMonth'),
    getWeekNumber = require('./getWeekNumber');

var localeManager = LocaleHelpers.localeManager;

function getWeekYear(d, localeCode, iso) {
  var year, month, firstDayOfWeek, firstDayOfWeekYear, week, loc;
  year = getYear(d);
  month = getMonth(d);
  if (month === 0 || month === 11) {
    if (!iso) {
      loc = localeManager.get(localeCode);
      firstDayOfWeek = loc.getFirstDayOfWeek(localeCode);
      firstDayOfWeekYear = loc.getFirstDayOfWeekYear(localeCode);
    }
    week = getWeekNumber(d, false, firstDayOfWeek, firstDayOfWeekYear);
    if (month === 0 && week === 0) {
      year -= 1;
    } else if (month === 11 && week === 1) {
      year += 1;
    }
  }
  return year;
}

module.exports = getWeekYear;
},{"../var/LocaleHelpers":389,"./getMonth":282,"./getWeekNumber":291,"./getYear":294}],293:[function(require,module,exports){
'use strict';

var callDateGet = require('../../common/internal/callDateGet');

function getWeekday(d) {
  return callDateGet(d, 'Day');
}

module.exports = getWeekday;
},{"../../common/internal/callDateGet":108}],294:[function(require,module,exports){
'use strict';

var callDateGet = require('../../common/internal/callDateGet');

function getYear(d) {
  return callDateGet(d, 'FullYear');
}

module.exports = getYear;
},{"../../common/internal/callDateGet":108}],295:[function(require,module,exports){
'use strict';

var getYear = require('./getYear'),
    mathAliases = require('../../common/var/mathAliases');

var abs = mathAliases.abs;

function getYearFromAbbreviation(str, d, prefer) {
  // Following IETF here, adding 1900 or 2000 depending on the last two digits.
  // Note that this makes no accordance for what should happen after 2050, but
  // intentionally ignoring this for now. https://www.ietf.org/rfc/rfc2822.txt
  var val = +str, delta;
  val += val < 50 ? 2000 : 1900;
  if (prefer) {
    delta = val - getYear(d);
    if (delta / abs(delta) !== prefer) {
      val += prefer * 100;
    }
  }
  return val;
}

module.exports = getYearFromAbbreviation;
},{"../../common/var/mathAliases":195,"./getYear":294}],296:[function(require,module,exports){
'use strict';

var _utc = require('../../common/var/_utc'),
    tzOffset = require('./tzOffset');

function isUTC(d) {
  return !!_utc(d) || tzOffset(d) === 0;
}

module.exports = isUTC;
},{"../../common/var/_utc":190,"./tzOffset":314}],297:[function(require,module,exports){
'use strict';

var DateUnitIndexes = require('../var/DateUnitIndexes'),
    isDefined = require('../../common/internal/isDefined'),
    getDateParam = require('./getDateParam'),
    iterateOverDateUnits = require('./iterateOverDateUnits');

var DAY_INDEX = DateUnitIndexes.DAY_INDEX;

function iterateOverDateParams(params, fn, startIndex, endIndex) {

  function run(name, unit, i) {
    var val = getDateParam(params, name);
    if (isDefined(val)) {
      fn(name, val, unit, i);
    }
  }

  iterateOverDateUnits(function (unit, i) {
    var result = run(unit.name, unit, i);
    if (result !== false && i === DAY_INDEX) {
      // Check for "weekday", which has a distinct meaning
      // in the context of setting a date, but has the same
      // meaning as "day" as a unit of time.
      result = run('weekday', unit, i);
    }
    return result;
  }, startIndex, endIndex);

}

module.exports = iterateOverDateParams;
},{"../../common/internal/isDefined":149,"../var/DateUnitIndexes":382,"./getDateParam":271,"./iterateOverDateUnits":298}],298:[function(require,module,exports){
'use strict';

var DateUnits = require('../var/DateUnits'),
    DateUnitIndexes = require('../var/DateUnitIndexes'),
    isUndefined = require('../../common/internal/isUndefined');

var YEAR_INDEX = DateUnitIndexes.YEAR_INDEX;

function iterateOverDateUnits(fn, startIndex, endIndex) {
  endIndex = endIndex || 0;
  if (isUndefined(startIndex)) {
    startIndex = YEAR_INDEX;
  }
  for (var index = startIndex; index >= endIndex; index--) {
    if (fn(DateUnits[index], index) === false) {
      break;
    }
  }
}

module.exports = iterateOverDateUnits;
},{"../../common/internal/isUndefined":155,"../var/DateUnitIndexes":382,"../var/DateUnits":383}],299:[function(require,module,exports){
'use strict';

var DateUnitIndexes = require('../var/DateUnitIndexes'),
    iterateOverDateParams = require('./iterateOverDateParams');

var DAY_INDEX = DateUnitIndexes.DAY_INDEX,
    YEAR_INDEX = DateUnitIndexes.YEAR_INDEX;

function iterateOverHigherDateParams(params, fn) {
  iterateOverDateParams(params, fn, YEAR_INDEX, DAY_INDEX);
}

module.exports = iterateOverHigherDateParams;
},{"../var/DateUnitIndexes":382,"./iterateOverDateParams":297}],300:[function(require,module,exports){
'use strict';

var LocaleHelpers = require('../var/LocaleHelpers'),
    DateUnitIndexes = require('../var/DateUnitIndexes'),
    getLowerUnitIndex = require('./getLowerUnitIndex'),
    moveToBeginningOfWeek = require('./moveToBeginningOfWeek'),
    setUnitAndLowerToEdge = require('./setUnitAndLowerToEdge');

var WEEK_INDEX = DateUnitIndexes.WEEK_INDEX,
    localeManager = LocaleHelpers.localeManager;

function moveToBeginningOfUnit(d, unitIndex, localeCode) {
  if (unitIndex === WEEK_INDEX) {
    moveToBeginningOfWeek(d, localeManager.get(localeCode).getFirstDayOfWeek());
  }
  return setUnitAndLowerToEdge(d, getLowerUnitIndex(unitIndex));
}

module.exports = moveToBeginningOfUnit;
},{"../var/DateUnitIndexes":382,"../var/LocaleHelpers":389,"./getLowerUnitIndex":280,"./moveToBeginningOfWeek":301,"./setUnitAndLowerToEdge":311}],301:[function(require,module,exports){
'use strict';

var setWeekday = require('./setWeekday'),
    getWeekday = require('./getWeekday'),
    mathAliases = require('../../common/var/mathAliases');

var floor = mathAliases.floor;

function moveToBeginningOfWeek(d, firstDayOfWeek) {
  setWeekday(d, floor((getWeekday(d) - firstDayOfWeek) / 7) * 7 + firstDayOfWeek);
  return d;
}

module.exports = moveToBeginningOfWeek;
},{"../../common/var/mathAliases":195,"./getWeekday":293,"./setWeekday":312}],302:[function(require,module,exports){
'use strict';

var LocaleHelpers = require('../var/LocaleHelpers'),
    DateUnitIndexes = require('../var/DateUnitIndexes'),
    moveToEndOfWeek = require('./moveToEndOfWeek'),
    getLowerUnitIndex = require('./getLowerUnitIndex'),
    setUnitAndLowerToEdge = require('./setUnitAndLowerToEdge');

var WEEK_INDEX = DateUnitIndexes.WEEK_INDEX,
    localeManager = LocaleHelpers.localeManager;

function moveToEndOfUnit(d, unitIndex, localeCode, stopIndex) {
  if (unitIndex === WEEK_INDEX) {
    moveToEndOfWeek(d, localeManager.get(localeCode).getFirstDayOfWeek());
  }
  return setUnitAndLowerToEdge(d, getLowerUnitIndex(unitIndex), stopIndex, true);
}

module.exports = moveToEndOfUnit;
},{"../var/DateUnitIndexes":382,"../var/LocaleHelpers":389,"./getLowerUnitIndex":280,"./moveToEndOfWeek":303,"./setUnitAndLowerToEdge":311}],303:[function(require,module,exports){
'use strict';

var setWeekday = require('./setWeekday'),
    getWeekday = require('./getWeekday'),
    mathAliases = require('../../common/var/mathAliases');

var ceil = mathAliases.ceil;

function moveToEndOfWeek(d, firstDayOfWeek) {
  var target = firstDayOfWeek - 1;
  setWeekday(d, ceil((getWeekday(d) - target) / 7) * 7 + target);
  return d;
}

module.exports = moveToEndOfWeek;
},{"../../common/var/mathAliases":195,"./getWeekday":293,"./setWeekday":312}],304:[function(require,module,exports){
'use strict';

var DateUnitIndexes = require('../var/DateUnitIndexes'),
    setDate = require('./setDate'),
    setUnitAndLowerToEdge = require('./setUnitAndLowerToEdge'),
    moveToBeginningOfWeek = require('./moveToBeginningOfWeek');

var MONTH_INDEX = DateUnitIndexes.MONTH_INDEX;

function moveToFirstDayOfWeekYear(d, firstDayOfWeek, firstDayOfWeekYear) {
  setUnitAndLowerToEdge(d, MONTH_INDEX);
  setDate(d, firstDayOfWeekYear);
  moveToBeginningOfWeek(d, firstDayOfWeek);
}

module.exports = moveToFirstDayOfWeekYear;
},{"../var/DateUnitIndexes":382,"./moveToBeginningOfWeek":301,"./setDate":307,"./setUnitAndLowerToEdge":311}],305:[function(require,module,exports){
'use strict';

var getLowerUnitIndex = require('./getLowerUnitIndex'),
    setUnitAndLowerToEdge = require('./setUnitAndLowerToEdge');

function resetLowerUnits(d, unitIndex) {
  return setUnitAndLowerToEdge(d, getLowerUnitIndex(unitIndex));
}

module.exports = resetLowerUnits;
},{"./getLowerUnitIndex":280,"./setUnitAndLowerToEdge":311}],306:[function(require,module,exports){
'use strict';

var DateUnitIndexes = require('../var/DateUnitIndexes'),
    setUnitAndLowerToEdge = require('./setUnitAndLowerToEdge');

var HOURS_INDEX = DateUnitIndexes.HOURS_INDEX;

function resetTime(d) {
  return setUnitAndLowerToEdge(d, HOURS_INDEX);
}

module.exports = resetTime;
},{"../var/DateUnitIndexes":382,"./setUnitAndLowerToEdge":311}],307:[function(require,module,exports){
'use strict';

var callDateSet = require('../../common/internal/callDateSet');

function setDate(d, val) {
  callDateSet(d, 'Date', val);
}

module.exports = setDate;
},{"../../common/internal/callDateSet":109}],308:[function(require,module,exports){
'use strict';

var createDate = require('./createDate'),
    namespaceAliases = require('../../common/var/namespaceAliases'),
    setChainableConstructor = require('../../common/internal/setChainableConstructor');

var sugarDate = namespaceAliases.sugarDate;

function setDateChainableConstructor() {
  setChainableConstructor(sugarDate, createDate);
}

module.exports = setDateChainableConstructor;
},{"../../common/internal/setChainableConstructor":169,"../../common/var/namespaceAliases":197,"./createDate":258}],309:[function(require,module,exports){
'use strict';

var ISODefaults = require('../var/ISODefaults'),
    getDate = require('./getDate'),
    setDate = require('./setDate'),
    setYear = require('./setYear'),
    getYear = require('./getYear'),
    getMonth = require('./getMonth'),
    setMonth = require('./setMonth'),
    cloneDate = require('./cloneDate'),
    getWeekday = require('./getWeekday'),
    setWeekday = require('./setWeekday'),
    classChecks = require('../../common/var/classChecks'),
    moveToFirstDayOfWeekYear = require('./moveToFirstDayOfWeekYear');

var isNumber = classChecks.isNumber,
    ISO_FIRST_DAY_OF_WEEK = ISODefaults.ISO_FIRST_DAY_OF_WEEK,
    ISO_FIRST_DAY_OF_WEEK_YEAR = ISODefaults.ISO_FIRST_DAY_OF_WEEK_YEAR;

function setISOWeekNumber(d, num) {
  if (isNumber(num)) {
    // Intentionally avoiding updateDate here to prevent circular dependencies.
    var isoWeek = cloneDate(d), dow = getWeekday(d);
    moveToFirstDayOfWeekYear(isoWeek, ISO_FIRST_DAY_OF_WEEK, ISO_FIRST_DAY_OF_WEEK_YEAR);
    setDate(isoWeek, getDate(isoWeek) + 7 * (num - 1));
    setYear(d, getYear(isoWeek));
    setMonth(d, getMonth(isoWeek));
    setDate(d, getDate(isoWeek));
    setWeekday(d, dow || 7);
  }
  return d.getTime();
}

module.exports = setISOWeekNumber;
},{"../../common/var/classChecks":192,"../var/ISODefaults":386,"./cloneDate":253,"./getDate":270,"./getMonth":282,"./getWeekday":293,"./getYear":294,"./moveToFirstDayOfWeekYear":304,"./setDate":307,"./setMonth":310,"./setWeekday":312,"./setYear":313}],310:[function(require,module,exports){
'use strict';

var callDateSet = require('../../common/internal/callDateSet');

function setMonth(d, val) {
  callDateSet(d, 'Month', val);
}

module.exports = setMonth;
},{"../../common/internal/callDateSet":109}],311:[function(require,module,exports){
'use strict';

var isDefined = require('../../common/internal/isDefined'),
    classChecks = require('../../common/var/classChecks'),
    callDateSet = require('../../common/internal/callDateSet'),
    walkUnitDown = require('./walkUnitDown');

var isFunction = classChecks.isFunction;

function setUnitAndLowerToEdge(d, startIndex, stopIndex, end) {
  walkUnitDown(startIndex, function(unit, i) {
    var val = end ? unit.end : unit.start;
    if (isFunction(val)) {
      val = val(d);
    }
    callDateSet(d, unit.method, val);
    return !isDefined(stopIndex) || i > stopIndex;
  });
  return d;
}

module.exports = setUnitAndLowerToEdge;
},{"../../common/internal/callDateSet":109,"../../common/internal/isDefined":149,"../../common/var/classChecks":192,"./walkUnitDown":316}],312:[function(require,module,exports){
'use strict';

var setDate = require('./setDate'),
    getDate = require('./getDate'),
    getWeekday = require('./getWeekday'),
    classChecks = require('../../common/var/classChecks'),
    mathAliases = require('../../common/var/mathAliases');

var isNumber = classChecks.isNumber,
    abs = mathAliases.abs;

function setWeekday(d, dow, dir) {
  if (!isNumber(dow)) return;
  var currentWeekday = getWeekday(d);
  if (dir) {
    // Allow a "direction" parameter to determine whether a weekday can
    // be set beyond the current weekday in either direction.
    var ndir = dir > 0 ? 1 : -1;
    var offset = dow % 7 - currentWeekday;
    if (offset && offset / abs(offset) !== ndir) {
      dow += 7 * ndir;
    }
  }
  setDate(d, getDate(d) + dow - currentWeekday);
  return d.getTime();
}

module.exports = setWeekday;
},{"../../common/var/classChecks":192,"../../common/var/mathAliases":195,"./getDate":270,"./getWeekday":293,"./setDate":307}],313:[function(require,module,exports){
'use strict';

var callDateSet = require('../../common/internal/callDateSet');

function setYear(d, val) {
  callDateSet(d, 'FullYear', val);
}

module.exports = setYear;
},{"../../common/internal/callDateSet":109}],314:[function(require,module,exports){
'use strict';

function tzOffset(d) {
  return d.getTimezoneOffset();
}

module.exports = tzOffset;
},{}],315:[function(require,module,exports){
'use strict';

var DateUnits = require('../var/DateUnits'),
    DateUnitIndexes = require('../var/DateUnitIndexes'),
    trunc = require('../../common/var/trunc'),
    setDate = require('./setDate'),
    getDate = require('./getDate'),
    getMonth = require('./getMonth'),
    getNewDate = require('./getNewDate'),
    setWeekday = require('./setWeekday'),
    mathAliases = require('../../common/var/mathAliases'),
    callDateGet = require('../../common/internal/callDateGet'),
    classChecks = require('../../common/var/classChecks'),
    resetLowerUnits = require('./resetLowerUnits'),
    getLowerUnitIndex = require('./getLowerUnitIndex'),
    getHigherUnitIndex = require('./getHigherUnitIndex'),
    callDateSetWithWeek = require('./callDateSetWithWeek'),
    iterateOverDateParams = require('./iterateOverDateParams');

var DAY_INDEX = DateUnitIndexes.DAY_INDEX,
    WEEK_INDEX = DateUnitIndexes.WEEK_INDEX,
    MONTH_INDEX = DateUnitIndexes.MONTH_INDEX,
    YEAR_INDEX = DateUnitIndexes.YEAR_INDEX,
    round = mathAliases.round,
    isNumber = classChecks.isNumber;

function updateDate(d, params, reset, advance, prefer, weekdayDir) {
  var upperUnitIndex;

  function setUpperUnit(unitName, unitIndex) {
    if (prefer && !upperUnitIndex) {
      if (unitName === 'weekday') {
        upperUnitIndex = WEEK_INDEX;
      } else {
        upperUnitIndex = getHigherUnitIndex(unitIndex);
      }
    }
  }

  function setSpecificity(unitIndex) {
    // Other functions may preemptively set the specificity before arriving
    // here so concede to them if they have already set more specific units.
    if (unitIndex > params.specificity) {
      return;
    }
    params.specificity = unitIndex;
  }

  function canDisambiguate() {
    if (!upperUnitIndex || upperUnitIndex > YEAR_INDEX) {
      return;
    }
    switch(prefer) {
      case -1: return d > getNewDate();
      case  1: return d < getNewDate();
    }
  }

  function disambiguateHigherUnit() {
    var unit = DateUnits[upperUnitIndex];
    advance = prefer;
    setUnit(unit.name, 1, unit, upperUnitIndex);
  }

  function handleFraction(unit, unitIndex, fraction) {
    if (unitIndex) {
      var lowerUnit = DateUnits[getLowerUnitIndex(unitIndex)];
      var val = round(unit.multiplier / lowerUnit.multiplier * fraction);
      params[lowerUnit.name] = val;
    }
  }

  function monthHasShifted(d, targetMonth) {
    if (targetMonth < 0) {
      targetMonth = targetMonth % 12 + 12;
    }
    return targetMonth % 12 !== getMonth(d);
  }

  function setUnit(unitName, value, unit, unitIndex) {
    var method = unit.method, checkMonth, fraction;

    setUpperUnit(unitName, unitIndex);
    setSpecificity(unitIndex);

    fraction = value % 1;
    if (fraction) {
      handleFraction(unit, unitIndex, fraction);
      value = trunc(value);
    }

    if (unitName === 'weekday') {
      if (!advance) {
        // Weekdays are always considered absolute units so simply set them
        // here even if it is an "advance" operation. This is to help avoid
        // ambiguous meanings in "advance" as well as to neatly allow formats
        // like "Wednesday of next week" without more complex logic.
        setWeekday(d, value, weekdayDir);
      }
      return;
    }
    checkMonth = unitIndex === MONTH_INDEX && getDate(d) > 28;

    // If we are advancing or rewinding, then we need we need to set the
    // absolute time if the unit is "hours" or less. This is due to the fact
    // that setting by method is ambiguous during DST shifts. For example,
    // 1:00am on November 1st 2015 occurs twice in North American timezones
    // with DST, the second time being after the clocks are rolled back at
    // 2:00am. When springing forward this is automatically handled as there
    // is no 2:00am so the date automatically jumps to 3:00am. However, when
    // rolling back, setHours(2) will always choose the first "2am" even if
    // the date is currently set to the second, causing unintended jumps.
    // This ambiguity is unavoidable when setting dates as the notation is
    // ambiguous. However when advancing, we clearly want the resulting date
    // to be an acutal hour ahead, which can only be accomplished by setting
    // the absolute time. Conversely, any unit higher than "hours" MUST use
    // the internal set methods, as they are ambiguous as absolute units of
    // time. Years may be 365 or 366 days depending on leap years, months are
    // all over the place, and even days may be 23-25 hours depending on DST
    // shifts. Finally, note that the kind of jumping described above will
    // occur when calling ANY "set" method on the date and will occur even if
    // the value being set is identical to the one currently set (i.e.
    // setHours(2) on a date at 2am may not be a noop). This is precarious,
    // so avoiding this situation in callDateSet by checking up front that
    // the value is not the same before setting.
    if (advance && !unit.ambiguous) {
      d.setTime(d.getTime() + (value * advance * unit.multiplier));
      return;
    } else if (advance) {
      if (unitIndex === WEEK_INDEX) {
        value *= 7;
        method = DateUnits[DAY_INDEX].method;
      }
      value = (value * advance) + callDateGet(d, method);
    }
    callDateSetWithWeek(d, method, value, advance);
    if (checkMonth && monthHasShifted(d, value)) {
      // As we are setting the units in reverse order, there is a chance that
      // our date may accidentally traverse into a new month, such as setting
      // { month: 1, date 15 } on January 31st. Check for this here and reset
      // the date to the last day of the previous month if this has happened.
      setDate(d, 0);
    }
  }

  if (isNumber(params) && advance) {
    // If param is a number and advancing, the number is in milliseconds.
    params = { millisecond: params };
  } else if (isNumber(params)) {
    // Otherwise just set the timestamp and return.
    d.setTime(params);
    return d;
  }

  iterateOverDateParams(params, setUnit);

  if (reset && params.specificity) {
    resetLowerUnits(d, params.specificity);
  }

  // If past or future is preferred, then the process of "disambiguation" will
  // ensure that an ambiguous time/date ("4pm", "thursday", "June", etc.) will
  // be in the past or future. Weeks are only considered ambiguous if there is
  // a weekday, i.e. "thursday" is an ambiguous week, but "the 4th" is an
  // ambiguous month.
  if (canDisambiguate()) {
    disambiguateHigherUnit();
  }
  return d;
}

module.exports = updateDate;
},{"../../common/internal/callDateGet":108,"../../common/var/classChecks":192,"../../common/var/mathAliases":195,"../../common/var/trunc":198,"../var/DateUnitIndexes":382,"../var/DateUnits":383,"./callDateSetWithWeek":252,"./getDate":270,"./getHigherUnitIndex":278,"./getLowerUnitIndex":280,"./getMonth":282,"./getNewDate":283,"./iterateOverDateParams":297,"./resetLowerUnits":305,"./setDate":307,"./setWeekday":312}],316:[function(require,module,exports){
'use strict';

var DateUnits = require('../var/DateUnits'),
    getLowerUnitIndex = require('./getLowerUnitIndex');

function walkUnitDown(unitIndex, fn) {
  while (unitIndex >= 0) {
    if (fn(DateUnits[unitIndex], unitIndex) === false) {
      break;
    }
    unitIndex = getLowerUnitIndex(unitIndex);
  }
}

module.exports = walkUnitDown;
},{"../var/DateUnits":383,"./getLowerUnitIndex":280}],317:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core'),
    fullCompareDate = require('./internal/fullCompareDate');

Sugar.Date.defineInstance({

  'is': function(date, d, margin) {
    return fullCompareDate(date, d, margin);
  }

});

module.exports = Sugar.Date.is;
},{"./internal/fullCompareDate":265,"sugar-core":809}],318:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core'),
    createDate = require('./internal/createDate');

Sugar.Date.defineInstance({

  'isAfter': function(date, d, margin) {
    return date.getTime() > createDate(d).getTime() - (margin || 0);
  }

});

module.exports = Sugar.Date.isAfter;
},{"./internal/createDate":258,"sugar-core":809}],319:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core'),
    createDate = require('./internal/createDate');

Sugar.Date.defineInstance({

  'isBefore': function(date, d, margin) {
    return date.getTime() < createDate(d).getTime() + (margin || 0);
  }

});

module.exports = Sugar.Date.isBefore;
},{"./internal/createDate":258,"sugar-core":809}],320:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core'),
    createDate = require('./internal/createDate'),
    mathAliases = require('../common/var/mathAliases');

var min = mathAliases.min,
    max = mathAliases.max;

Sugar.Date.defineInstance({

  'isBetween': function(date, d1, d2, margin) {
    var t  = date.getTime();
    var t1 = createDate(d1).getTime();
    var t2 = createDate(d2).getTime();
    var lo = min(t1, t2);
    var hi = max(t1, t2);
    margin = margin || 0;
    return (lo - margin <= t) && (hi + margin >= t);
  }

});

module.exports = Sugar.Date.isBetween;
},{"../common/var/mathAliases":195,"./internal/createDate":258,"sugar-core":809}],321:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core');

require('./build/buildRelativeAliasesCall');

module.exports = Sugar.Date.isFriday;
},{"./build/buildRelativeAliasesCall":216,"sugar-core":809}],322:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core');

require('./build/buildRelativeAliasesCall');

module.exports = Sugar.Date.isFuture;
},{"./build/buildRelativeAliasesCall":216,"sugar-core":809}],323:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core');

require('./build/buildDateUnitMethodsCall');

module.exports = Sugar.Date.isLastMonth;
},{"./build/buildDateUnitMethodsCall":214,"sugar-core":809}],324:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core');

require('./build/buildDateUnitMethodsCall');

module.exports = Sugar.Date.isLastWeek;
},{"./build/buildDateUnitMethodsCall":214,"sugar-core":809}],325:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core');

require('./build/buildDateUnitMethodsCall');

module.exports = Sugar.Date.isLastYear;
},{"./build/buildDateUnitMethodsCall":214,"sugar-core":809}],326:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core'),
    getYear = require('./internal/getYear');

Sugar.Date.defineInstance({

  'isLeapYear': function(date) {
    var year = getYear(date);
    return (year % 4 === 0 && year % 100 !== 0) || (year % 400 === 0);
  }

});

module.exports = Sugar.Date.isLeapYear;
},{"./internal/getYear":294,"sugar-core":809}],327:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core');

require('./build/buildRelativeAliasesCall');

module.exports = Sugar.Date.isMonday;
},{"./build/buildRelativeAliasesCall":216,"sugar-core":809}],328:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core');

require('./build/buildDateUnitMethodsCall');

module.exports = Sugar.Date.isNextMonth;
},{"./build/buildDateUnitMethodsCall":214,"sugar-core":809}],329:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core');

require('./build/buildDateUnitMethodsCall');

module.exports = Sugar.Date.isNextWeek;
},{"./build/buildDateUnitMethodsCall":214,"sugar-core":809}],330:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core');

require('./build/buildDateUnitMethodsCall');

module.exports = Sugar.Date.isNextYear;
},{"./build/buildDateUnitMethodsCall":214,"sugar-core":809}],331:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core');

require('./build/buildRelativeAliasesCall');

module.exports = Sugar.Date.isPast;
},{"./build/buildRelativeAliasesCall":216,"sugar-core":809}],332:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core');

require('./build/buildRelativeAliasesCall');

module.exports = Sugar.Date.isSaturday;
},{"./build/buildRelativeAliasesCall":216,"sugar-core":809}],333:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core');

require('./build/buildRelativeAliasesCall');

module.exports = Sugar.Date.isSunday;
},{"./build/buildRelativeAliasesCall":216,"sugar-core":809}],334:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core');

require('./build/buildDateUnitMethodsCall');

module.exports = Sugar.Date.isThisMonth;
},{"./build/buildDateUnitMethodsCall":214,"sugar-core":809}],335:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core');

require('./build/buildDateUnitMethodsCall');

module.exports = Sugar.Date.isThisWeek;
},{"./build/buildDateUnitMethodsCall":214,"sugar-core":809}],336:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core');

require('./build/buildDateUnitMethodsCall');

module.exports = Sugar.Date.isThisYear;
},{"./build/buildDateUnitMethodsCall":214,"sugar-core":809}],337:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core');

require('./build/buildRelativeAliasesCall');

module.exports = Sugar.Date.isThursday;
},{"./build/buildRelativeAliasesCall":216,"sugar-core":809}],338:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core');

require('./build/buildRelativeAliasesCall');

module.exports = Sugar.Date.isToday;
},{"./build/buildRelativeAliasesCall":216,"sugar-core":809}],339:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core');

require('./build/buildRelativeAliasesCall');

module.exports = Sugar.Date.isTomorrow;
},{"./build/buildRelativeAliasesCall":216,"sugar-core":809}],340:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core');

require('./build/buildRelativeAliasesCall');

module.exports = Sugar.Date.isTuesday;
},{"./build/buildRelativeAliasesCall":216,"sugar-core":809}],341:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core'),
    isUTC = require('./internal/isUTC');

Sugar.Date.defineInstance({

  'isUTC': function(date) {
    return isUTC(date);
  }

});

module.exports = Sugar.Date.isUTC;
},{"./internal/isUTC":296,"sugar-core":809}],342:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core'),
    dateIsValid = require('./internal/dateIsValid');

Sugar.Date.defineInstance({

  'isValid': function(date) {
    return dateIsValid(date);
  }

});

module.exports = Sugar.Date.isValid;
},{"./internal/dateIsValid":261,"sugar-core":809}],343:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core');

require('./build/buildRelativeAliasesCall');

module.exports = Sugar.Date.isWednesday;
},{"./build/buildRelativeAliasesCall":216,"sugar-core":809}],344:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core');

require('./build/buildRelativeAliasesCall');

module.exports = Sugar.Date.isWeekday;
},{"./build/buildRelativeAliasesCall":216,"sugar-core":809}],345:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core');

require('./build/buildRelativeAliasesCall');

module.exports = Sugar.Date.isWeekend;
},{"./build/buildRelativeAliasesCall":216,"sugar-core":809}],346:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core');

require('./build/buildRelativeAliasesCall');

module.exports = Sugar.Date.isYesterday;
},{"./build/buildRelativeAliasesCall":216,"sugar-core":809}],347:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core');

Sugar.Date.defineInstance({

  'iso': function(date) {
    return date.toISOString();
  }

});

module.exports = Sugar.Date.iso;
},{"sugar-core":809}],348:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core');

require('./build/buildDateUnitMethodsCall');

module.exports = Sugar.Date.millisecondsAgo;
},{"./build/buildDateUnitMethodsCall":214,"sugar-core":809}],349:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core');

require('./build/buildDateUnitMethodsCall');

module.exports = Sugar.Date.millisecondsFromNow;
},{"./build/buildDateUnitMethodsCall":214,"sugar-core":809}],350:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core');

require('./build/buildDateUnitMethodsCall');

module.exports = Sugar.Date.millisecondsSince;
},{"./build/buildDateUnitMethodsCall":214,"sugar-core":809}],351:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core');

require('./build/buildDateUnitMethodsCall');

module.exports = Sugar.Date.millisecondsUntil;
},{"./build/buildDateUnitMethodsCall":214,"sugar-core":809}],352:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core');

require('./build/buildDateUnitMethodsCall');

module.exports = Sugar.Date.minutesAgo;
},{"./build/buildDateUnitMethodsCall":214,"sugar-core":809}],353:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core');

require('./build/buildDateUnitMethodsCall');

module.exports = Sugar.Date.minutesFromNow;
},{"./build/buildDateUnitMethodsCall":214,"sugar-core":809}],354:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core');

require('./build/buildDateUnitMethodsCall');

module.exports = Sugar.Date.minutesSince;
},{"./build/buildDateUnitMethodsCall":214,"sugar-core":809}],355:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core');

require('./build/buildDateUnitMethodsCall');

module.exports = Sugar.Date.minutesUntil;
},{"./build/buildDateUnitMethodsCall":214,"sugar-core":809}],356:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core');

require('./build/buildDateUnitMethodsCall');

module.exports = Sugar.Date.monthsAgo;
},{"./build/buildDateUnitMethodsCall":214,"sugar-core":809}],357:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core');

require('./build/buildDateUnitMethodsCall');

module.exports = Sugar.Date.monthsFromNow;
},{"./build/buildDateUnitMethodsCall":214,"sugar-core":809}],358:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core');

require('./build/buildDateUnitMethodsCall');

module.exports = Sugar.Date.monthsSince;
},{"./build/buildDateUnitMethodsCall":214,"sugar-core":809}],359:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core');

require('./build/buildDateUnitMethodsCall');

module.exports = Sugar.Date.monthsUntil;
},{"./build/buildDateUnitMethodsCall":214,"sugar-core":809}],360:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core'),
    DateRangeConstructor = require('../range/var/DateRangeConstructor');

Sugar.Date.defineStatic({

  'range': DateRangeConstructor

});

module.exports = Sugar.Date.range;
},{"../range/var/DateRangeConstructor":714,"sugar-core":809}],361:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core'),
    dateRelative = require('./internal/dateRelative');

Sugar.Date.defineInstance({

  'relative': function(date, localeCode, fn) {
    return dateRelative(date, null, localeCode, fn);
  }

});

module.exports = Sugar.Date.relative;
},{"./internal/dateRelative":262,"sugar-core":809}],362:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core'),
    createDate = require('./internal/createDate'),
    dateRelative = require('./internal/dateRelative');

Sugar.Date.defineInstance({

  'relativeTo': function(date, d, localeCode) {
    return dateRelative(date, createDate(d), localeCode);
  }

});

module.exports = Sugar.Date.relativeTo;
},{"./internal/createDate":258,"./internal/dateRelative":262,"sugar-core":809}],363:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core'),
    LocaleHelpers = require('./var/LocaleHelpers');

var localeManager = LocaleHelpers.localeManager;

Sugar.Date.defineStatic({

  'removeLocale': function(code) {
    return localeManager.remove(code);
  }

});

module.exports = Sugar.Date.removeLocale;
},{"./var/LocaleHelpers":389,"sugar-core":809}],364:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core'),
    DateUnitIndexes = require('./var/DateUnitIndexes'),
    moveToBeginningOfUnit = require('./internal/moveToBeginningOfUnit'),
    getUnitIndexForParamName = require('./internal/getUnitIndexForParamName');

var DAY_INDEX = DateUnitIndexes.DAY_INDEX;

Sugar.Date.defineInstance({

  'reset': function(date, unit, localeCode) {
    var unitIndex = unit ? getUnitIndexForParamName(unit) : DAY_INDEX;
    moveToBeginningOfUnit(date, unitIndex, localeCode);
    return date;
  }

});

module.exports = Sugar.Date.reset;
},{"./internal/getUnitIndexForParamName":290,"./internal/moveToBeginningOfUnit":300,"./var/DateUnitIndexes":382,"sugar-core":809}],365:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core'),
    advanceDateWithArgs = require('./internal/advanceDateWithArgs');

Sugar.Date.defineInstanceWithArguments({

  'rewind': function(d, args) {
    return advanceDateWithArgs(d, args, -1);
  }

});

module.exports = Sugar.Date.rewind;
},{"./internal/advanceDateWithArgs":246,"sugar-core":809}],366:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core');

require('./build/buildDateUnitMethodsCall');

module.exports = Sugar.Date.secondsAgo;
},{"./build/buildDateUnitMethodsCall":214,"sugar-core":809}],367:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core');

require('./build/buildDateUnitMethodsCall');

module.exports = Sugar.Date.secondsFromNow;
},{"./build/buildDateUnitMethodsCall":214,"sugar-core":809}],368:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core');

require('./build/buildDateUnitMethodsCall');

module.exports = Sugar.Date.secondsSince;
},{"./build/buildDateUnitMethodsCall":214,"sugar-core":809}],369:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core');

require('./build/buildDateUnitMethodsCall');

module.exports = Sugar.Date.secondsUntil;
},{"./build/buildDateUnitMethodsCall":214,"sugar-core":809}],370:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core'),
    updateDate = require('./internal/updateDate'),
    collectDateArguments = require('./internal/collectDateArguments');

Sugar.Date.defineInstanceWithArguments({

  'set': function(d, args) {
    args = collectDateArguments(args);
    return updateDate(d, args[0], args[1]);
  }

});

module.exports = Sugar.Date.set;
},{"./internal/collectDateArguments":254,"./internal/updateDate":315,"sugar-core":809}],371:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core'),
    setISOWeekNumber = require('./internal/setISOWeekNumber');

Sugar.Date.defineInstance({

  'setISOWeek': function(date, num) {
    return setISOWeekNumber(date, num);
  }

});

module.exports = Sugar.Date.setISOWeek;
},{"./internal/setISOWeekNumber":309,"sugar-core":809}],372:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core'),
    LocaleHelpers = require('./var/LocaleHelpers');

var localeManager = LocaleHelpers.localeManager;

Sugar.Date.defineStatic({

  'setLocale': function(code) {
    return localeManager.set(code);
  }

});

module.exports = Sugar.Date.setLocale;
},{"./var/LocaleHelpers":389,"sugar-core":809}],373:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core'),
    _dateOptions = require('./var/_dateOptions');

module.exports = Sugar.Date.setOption;
},{"./var/_dateOptions":394,"sugar-core":809}],374:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core'),
    _utc = require('../common/var/_utc');

Sugar.Date.defineInstance({

  'setUTC': function(date, on) {
    return _utc(date, on);
  }

});

module.exports = Sugar.Date.setUTC;
},{"../common/var/_utc":190,"sugar-core":809}],375:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core'),
    setWeekday = require('./internal/setWeekday');

Sugar.Date.defineInstance({

  'setWeekday': function(date, dow) {
    return setWeekday(date, dow);
  }

});

module.exports = Sugar.Date.setWeekday;
},{"./internal/setWeekday":312,"sugar-core":809}],376:[function(require,module,exports){
'use strict';

var getEnglishVariant = require('../internal/getEnglishVariant');

var AmericanEnglishDefinition = getEnglishVariant({
  'mdy': true,
  'firstDayOfWeek': 0,
  'firstDayOfWeekYear': 1,
  'short':  '{MM}/{dd}/{yyyy}',
  'medium': '{Month} {d}, {yyyy}',
  'long':   '{Month} {d}, {yyyy} {time}',
  'full':   '{Weekday}, {Month} {d}, {yyyy} {time}',
  'stamp':  '{Dow} {Mon} {d} {yyyy} {time}',
  'time':   '{h}:{mm} {TT}'
});

module.exports = AmericanEnglishDefinition;
},{"../internal/getEnglishVariant":276}],377:[function(require,module,exports){
'use strict';

var getEnglishVariant = require('../internal/getEnglishVariant');

var BritishEnglishDefinition = getEnglishVariant({
  'short':  '{dd}/{MM}/{yyyy}',
  'medium': '{d} {Month} {yyyy}',
  'long':   '{d} {Month} {yyyy} {H}:{mm}',
  'full':   '{Weekday}, {d} {Month}, {yyyy} {time}',
  'stamp':  '{Dow} {d} {Mon} {yyyy} {time}'
});

module.exports = BritishEnglishDefinition;
},{"../internal/getEnglishVariant":276}],378:[function(require,module,exports){
'use strict';

var getEnglishVariant = require('../internal/getEnglishVariant');

var CanadianEnglishDefinition = getEnglishVariant({
  'short':  '{yyyy}-{MM}-{dd}',
  'medium': '{d} {Month}, {yyyy}',
  'long':   '{d} {Month}, {yyyy} {H}:{mm}',
  'full':   '{Weekday}, {d} {Month}, {yyyy} {time}',
  'stamp':  '{Dow} {d} {Mon} {yyyy} {time}'
});

module.exports = CanadianEnglishDefinition;
},{"../internal/getEnglishVariant":276}],379:[function(require,module,exports){
'use strict';

var CoreOutputFormats = {
  'ISO8601': '{yyyy}-{MM}-{dd}T{HH}:{mm}:{ss}.{SSS}{Z}',
  'RFC1123': '{Dow}, {dd} {Mon} {yyyy} {HH}:{mm}:{ss} {ZZ}',
  'RFC1036': '{Weekday}, {dd}-{Mon}-{yy} {HH}:{mm}:{ss} {ZZ}'
};

module.exports = CoreOutputFormats;
},{}],380:[function(require,module,exports){
'use strict';

var CoreParsingFormats = [
  {
    // 12-1978
    // 08-1978 (MDY)
    src: '{MM}[-.\\/]{yyyy}'
  },
  {
    // 12/08/1978
    // 08/12/1978 (MDY)
    time: true,
    src: '{dd}[-.\\/]{MM}(?:[-.\\/]{yyyy|yy|y})?',
    mdy: '{MM}[-.\\/]{dd}(?:[-.\\/]{yyyy|yy|y})?'
  },
  {
    // 1975-08-25
    time: true,
    src: '{yyyy}[-.\\/]{MM}(?:[-.\\/]{dd})?'
  },
  {
    // .NET JSON
    src: '\\\\/Date\\({timestamp}(?:[+-]\\d{4,4})?\\)\\\\/'
  },
  {
    // ISO-8601
    src: '{yearSign?}{yyyy}(?:-?{MM}(?:-?{dd}(?:T{ihh}(?::?{imm}(?::?{ss})?)?)?)?)?{tzOffset?}'
  }
];

module.exports = CoreParsingFormats;
},{}],381:[function(require,module,exports){
'use strict';

var defaultNewDate = require('../internal/defaultNewDate');

var DATE_OPTIONS = {
  'newDateInternal': defaultNewDate
};

module.exports = DATE_OPTIONS;
},{"../internal/defaultNewDate":263}],382:[function(require,module,exports){
'use strict';

module.exports = {
  HOURS_INDEX: 3,
  DAY_INDEX: 4,
  WEEK_INDEX: 5,
  MONTH_INDEX: 6,
  YEAR_INDEX: 7
};
},{}],383:[function(require,module,exports){
'use strict';

var getDaysInMonth = require('../internal/getDaysInMonth');

var DateUnits = [
  {
    name: 'millisecond',
    method: 'Milliseconds',
    multiplier: 1,
    start: 0,
    end: 999
  },
  {
    name: 'second',
    method: 'Seconds',
    multiplier: 1000,
    start: 0,
    end: 59
  },
  {
    name: 'minute',
    method: 'Minutes',
    multiplier: 60 * 1000,
    start: 0,
    end: 59
  },
  {
    name: 'hour',
    method: 'Hours',
    multiplier: 60 * 60 * 1000,
    start: 0,
    end: 23
  },
  {
    name: 'day',
    alias: 'date',
    method: 'Date',
    ambiguous: true,
    multiplier: 24 * 60 * 60 * 1000,
    start: 1,
    end: function(d) {
      return getDaysInMonth(d);
    }
  },
  {
    name: 'week',
    method: 'ISOWeek',
    ambiguous: true,
    multiplier: 7 * 24 * 60 * 60 * 1000
  },
  {
    name: 'month',
    method: 'Month',
    ambiguous: true,
    multiplier: 30.4375 * 24 * 60 * 60 * 1000,
    start: 0,
    end: 11
  },
  {
    name: 'year',
    method: 'FullYear',
    ambiguous: true,
    multiplier: 365.25 * 24 * 60 * 60 * 1000,
    start: 0
  }
];

module.exports = DateUnits;
},{"../internal/getDaysInMonth":274}],384:[function(require,module,exports){
'use strict';

var EnglishLocaleBaseDefinition = {
  'code': 'en',
  'plural': true,
  'timeMarkers': 'at',
  'ampm': 'AM|A.M.|a,PM|P.M.|p',
  'units': 'millisecond:|s,second:|s,minute:|s,hour:|s,day:|s,week:|s,month:|s,year:|s',
  'months': 'Jan:uary|,Feb:ruary|,Mar:ch|,Apr:il|,May,Jun:e|,Jul:y|,Aug:ust|,Sep:tember|t|,Oct:ober|,Nov:ember|,Dec:ember|',
  'weekdays': 'Sun:day|,Mon:day|,Tue:sday|,Wed:nesday|,Thu:rsday|,Fri:day|,Sat:urday|+weekend',
  'numerals': 'zero,one|first,two|second,three|third,four:|th,five|fifth,six:|th,seven:|th,eight:|h,nin:e|th,ten:|th',
  'articles': 'a,an,the',
  'tokens': 'the,st|nd|rd|th,of|in,a|an,on',
  'time': '{H}:{mm}',
  'past': '{num} {unit} {sign}',
  'future': '{num} {unit} {sign}',
  'duration': '{num} {unit}',
  'modifiers': [
    { 'name': 'half',   'src': 'half', 'value': .5 },
    { 'name': 'midday', 'src': 'noon', 'value': 12 },
    { 'name': 'midday', 'src': 'midnight', 'value': 24 },
    { 'name': 'day',    'src': 'yesterday', 'value': -1 },
    { 'name': 'day',    'src': 'today|tonight', 'value': 0 },
    { 'name': 'day',    'src': 'tomorrow', 'value': 1 },
    { 'name': 'sign',   'src': 'ago|before', 'value': -1 },
    { 'name': 'sign',   'src': 'from now|after|from|in|later', 'value': 1 },
    { 'name': 'edge',   'src': 'first day|first|beginning', 'value': -2 },
    { 'name': 'edge',   'src': 'last day', 'value': 1 },
    { 'name': 'edge',   'src': 'end|last', 'value': 2 },
    { 'name': 'shift',  'src': 'last', 'value': -1 },
    { 'name': 'shift',  'src': 'the|this', 'value': 0 },
    { 'name': 'shift',  'src': 'next', 'value': 1 }
  ],
  'parse': [
    '(?:just)? now',
    '{shift} {unit:5-7}',
    "{months?} (?:{year}|'{yy})",
    '{midday} {4?} {day|weekday}',
    '{months},?(?:[-.\\/\\s]{year})?',
    '{edge} of (?:day)? {day|weekday}',
    '{0} {num}{1?} {weekday} {2} {months},? {year?}',
    '{shift?} {day?} {weekday?} {timeMarker?} {midday}',
    '{sign?} {3?} {half} {3?} {unit:3-4|unit:7} {sign?}',
    '{0?} {edge} {weekday?} {2} {shift?} {unit:4-7?} {months?},? {year?}'
  ],
  'timeParse': [
    '{day|weekday}',
    '{shift} {unit:5?} {weekday}',
    '{0?} {date}{1?} {2?} {months?}',
    '{weekday} {2?} {shift} {unit:5}',
    '{0?} {num} {2?} {months}\\.?,? {year?}',
    '{num?} {unit:4-5} {sign} {day|weekday}',
    '{year}[-.\\/\\s]{months}[-.\\/\\s]{date}',
    '{0|months} {date?}{1?} of {shift} {unit:6-7}',
    '{0?} {num}{1?} {weekday} of {shift} {unit:6}',
    "{date}[-.\\/\\s]{months}[-.\\/\\s](?:{year}|'?{yy})",
    "{weekday?}\\.?,? {months}\\.?,? {date}{1?},? (?:{year}|'{yy})?"
  ],
  'timeFrontParse': [
    '{sign} {num} {unit}',
    '{num} {unit} {sign}',
    '{4?} {day|weekday}'
  ]
};

module.exports = EnglishLocaleBaseDefinition;
},{}],385:[function(require,module,exports){
'use strict';

var TIMEZONE_ABBREVIATION_REG = require('./TIMEZONE_ABBREVIATION_REG'),
    LocaleHelpers = require('./LocaleHelpers'),
    DateUnitIndexes = require('./DateUnitIndexes'),
    trunc = require('../../common/var/trunc'),
    getDate = require('../internal/getDate'),
    getYear = require('../internal/getYear'),
    getHours = require('../internal/getHours'),
    getMonth = require('../internal/getMonth'),
    cloneDate = require('../internal/cloneDate'),
    padNumber = require('../../common/internal/padNumber'),
    getWeekday = require('../internal/getWeekday'),
    callDateGet = require('../../common/internal/callDateGet'),
    mathAliases = require('../../common/var/mathAliases'),
    getWeekYear = require('../internal/getWeekYear'),
    getUTCOffset = require('../internal/getUTCOffset'),
    getDaysSince = require('../internal/getDaysSince'),
    getWeekNumber = require('../internal/getWeekNumber'),
    getMeridiemToken = require('../internal/getMeridiemToken'),
    setUnitAndLowerToEdge = require('../internal/setUnitAndLowerToEdge');

var localeManager = LocaleHelpers.localeManager,
    MONTH_INDEX = DateUnitIndexes.MONTH_INDEX,
    ceil = mathAliases.ceil;

var FormatTokensBase = [
  {
    ldml: 'Dow',
    strf: 'a',
    lowerToken: 'dow',
    get: function(d, localeCode) {
      return localeManager.get(localeCode).getWeekdayName(getWeekday(d), 2);
    }
  },
  {
    ldml: 'Weekday',
    strf: 'A',
    lowerToken: 'weekday',
    allowAlternates: true,
    get: function(d, localeCode, alternate) {
      return localeManager.get(localeCode).getWeekdayName(getWeekday(d), alternate);
    }
  },
  {
    ldml: 'Mon',
    strf: 'b h',
    lowerToken: 'mon',
    get: function(d, localeCode) {
      return localeManager.get(localeCode).getMonthName(getMonth(d), 2);
    }
  },
  {
    ldml: 'Month',
    strf: 'B',
    lowerToken: 'month',
    allowAlternates: true,
    get: function(d, localeCode, alternate) {
      return localeManager.get(localeCode).getMonthName(getMonth(d), alternate);
    }
  },
  {
    strf: 'C',
    get: function(d) {
      return getYear(d).toString().slice(0, 2);
    }
  },
  {
    ldml: 'd date day',
    strf: 'd',
    strfPadding: 2,
    ldmlPaddedToken: 'dd',
    ordinalToken: 'do',
    get: function(d) {
      return getDate(d);
    }
  },
  {
    strf: 'e',
    get: function(d) {
      return padNumber(getDate(d), 2, false, 10, ' ');
    }
  },
  {
    ldml: 'H 24hr',
    strf: 'H',
    strfPadding: 2,
    ldmlPaddedToken: 'HH',
    get: function(d) {
      return getHours(d);
    }
  },
  {
    ldml: 'h hours 12hr',
    strf: 'I',
    strfPadding: 2,
    ldmlPaddedToken: 'hh',
    get: function(d) {
      return getHours(d) % 12 || 12;
    }
  },
  {
    ldml: 'D',
    strf: 'j',
    strfPadding: 3,
    ldmlPaddedToken: 'DDD',
    get: function(d) {
      var s = setUnitAndLowerToEdge(cloneDate(d), MONTH_INDEX);
      return getDaysSince(d, s) + 1;
    }
  },
  {
    ldml: 'M',
    strf: 'm',
    strfPadding: 2,
    ordinalToken: 'Mo',
    ldmlPaddedToken: 'MM',
    get: function(d) {
      return getMonth(d) + 1;
    }
  },
  {
    ldml: 'm minutes',
    strf: 'M',
    strfPadding: 2,
    ldmlPaddedToken: 'mm',
    get: function(d) {
      return callDateGet(d, 'Minutes');
    }
  },
  {
    ldml: 'Q',
    get: function(d) {
      return ceil((getMonth(d) + 1) / 3);
    }
  },
  {
    ldml: 'TT',
    strf: 'p',
    get: function(d, localeCode) {
      return getMeridiemToken(d, localeCode);
    }
  },
  {
    ldml: 'tt',
    strf: 'P',
    get: function(d, localeCode) {
      return getMeridiemToken(d, localeCode).toLowerCase();
    }
  },
  {
    ldml: 'T',
    lowerToken: 't',
    get: function(d, localeCode) {
      return getMeridiemToken(d, localeCode).charAt(0);
    }
  },
  {
    ldml: 's seconds',
    strf: 'S',
    strfPadding: 2,
    ldmlPaddedToken: 'ss',
    get: function(d) {
      return callDateGet(d, 'Seconds');
    }
  },
  {
    ldml: 'S ms',
    strfPadding: 3,
    ldmlPaddedToken: 'SSS',
    get: function(d) {
      return callDateGet(d, 'Milliseconds');
    }
  },
  {
    ldml: 'e',
    strf: 'u',
    ordinalToken: 'eo',
    get: function(d) {
      return getWeekday(d) || 7;
    }
  },
  {
    strf: 'U',
    strfPadding: 2,
    get: function(d) {
      // Sunday first, 0-53
      return getWeekNumber(d, false, 0);
    }
  },
  {
    ldml: 'W',
    strf: 'V',
    strfPadding: 2,
    ordinalToken: 'Wo',
    ldmlPaddedToken: 'WW',
    get: function(d) {
      // Monday first, 1-53 (ISO8601)
      return getWeekNumber(d, true);
    }
  },
  {
    strf: 'w',
    get: function(d) {
      return getWeekday(d);
    }
  },
  {
    ldml: 'w',
    ordinalToken: 'wo',
    ldmlPaddedToken: 'ww',
    get: function(d, localeCode) {
      // Locale dependent, 1-53
      var loc = localeManager.get(localeCode),
          dow = loc.getFirstDayOfWeek(localeCode),
          doy = loc.getFirstDayOfWeekYear(localeCode);
      return getWeekNumber(d, true, dow, doy);
    }
  },
  {
    strf: 'W',
    strfPadding: 2,
    get: function(d) {
      // Monday first, 0-53
      return getWeekNumber(d, false);
    }
  },
  {
    ldmlPaddedToken: 'gggg',
    ldmlTwoDigitToken: 'gg',
    get: function(d, localeCode) {
      return getWeekYear(d, localeCode);
    }
  },
  {
    strf: 'G',
    strfPadding: 4,
    strfTwoDigitToken: 'g',
    ldmlPaddedToken: 'GGGG',
    ldmlTwoDigitToken: 'GG',
    get: function(d, localeCode) {
      return getWeekYear(d, localeCode, true);
    }
  },
  {
    ldml: 'year',
    ldmlPaddedToken: 'yyyy',
    ldmlTwoDigitToken: 'yy',
    strf: 'Y',
    strfPadding: 4,
    strfTwoDigitToken: 'y',
    get: function(d) {
      return getYear(d);
    }
  },
  {
    ldml: 'ZZ',
    strf: 'z',
    get: function(d) {
      return getUTCOffset(d);
    }
  },
  {
    ldml: 'X',
    get: function(d) {
      return trunc(d.getTime() / 1000);
    }
  },
  {
    ldml: 'x',
    get: function(d) {
      return d.getTime();
    }
  },
  {
    ldml: 'Z',
    get: function(d) {
      return getUTCOffset(d, true);
    }
  },
  {
    ldml: 'z',
    strf: 'Z',
    get: function(d) {
      // Note that this is not accurate in all browsing environments!
      // https://github.com/moment/moment/issues/162
      // It will continue to be supported for Node and usage with the
      // understanding that it may be blank.
      var match = d.toString().match(TIMEZONE_ABBREVIATION_REG);
      return match ? match[1]: '';
    }
  },
  {
    strf: 'D',
    alias: '%m/%d/%y'
  },
  {
    strf: 'F',
    alias: '%Y-%m-%d'
  },
  {
    strf: 'r',
    alias: '%I:%M:%S %p'
  },
  {
    strf: 'R',
    alias: '%H:%M'
  },
  {
    strf: 'T',
    alias: '%H:%M:%S'
  },
  {
    strf: 'x',
    alias: '{short}'
  },
  {
    strf: 'X',
    alias: '{time}'
  },
  {
    strf: 'c',
    alias: '{stamp}'
  }
];

module.exports = FormatTokensBase;
},{"../../common/internal/callDateGet":108,"../../common/internal/padNumber":162,"../../common/var/mathAliases":195,"../../common/var/trunc":198,"../internal/cloneDate":253,"../internal/getDate":270,"../internal/getDaysSince":275,"../internal/getHours":279,"../internal/getMeridiemToken":281,"../internal/getMonth":282,"../internal/getUTCOffset":289,"../internal/getWeekNumber":291,"../internal/getWeekYear":292,"../internal/getWeekday":293,"../internal/getYear":294,"../internal/setUnitAndLowerToEdge":311,"./DateUnitIndexes":382,"./LocaleHelpers":389,"./TIMEZONE_ABBREVIATION_REG":393}],386:[function(require,module,exports){
'use strict';

module.exports = {
  ISO_FIRST_DAY_OF_WEEK: 1,
  ISO_FIRST_DAY_OF_WEEK_YEAR: 4
};
},{}],387:[function(require,module,exports){
'use strict';

var LOCALE_ARRAY_FIELDS = [
  'months', 'weekdays', 'units', 'numerals', 'placeholders',
  'articles', 'tokens', 'timeMarkers', 'ampm', 'timeSuffixes',
  'parse', 'timeParse', 'timeFrontParse', 'modifiers'
];

module.exports = LOCALE_ARRAY_FIELDS;
},{}],388:[function(require,module,exports){
'use strict';

var BritishEnglishDefinition = require('./BritishEnglishDefinition'),
    AmericanEnglishDefinition = require('./AmericanEnglishDefinition'),
    CanadianEnglishDefinition = require('./CanadianEnglishDefinition');

var LazyLoadedLocales = {
  'en-US': AmericanEnglishDefinition,
  'en-GB': BritishEnglishDefinition,
  'en-AU': BritishEnglishDefinition,
  'en-CA': CanadianEnglishDefinition
};

module.exports = LazyLoadedLocales;
},{"./AmericanEnglishDefinition":376,"./BritishEnglishDefinition":377,"./CanadianEnglishDefinition":378}],389:[function(require,module,exports){
'use strict';

var LazyLoadedLocales = require('./LazyLoadedLocales'),
    AmericanEnglishDefinition = require('./AmericanEnglishDefinition'),
    getNewLocale = require('../internal/getNewLocale');

var English, localeManager;

function buildLocales() {

  function LocaleManager(loc) {
    this.locales = {};
    this.add(loc);
  }

  LocaleManager.prototype = {

    get: function(code, fallback) {
      var loc = this.locales[code];
      if (!loc && LazyLoadedLocales[code]) {
        loc = this.add(code, LazyLoadedLocales[code]);
      } else if (!loc && code) {
        loc = this.locales[code.slice(0, 2)];
      }
      return loc || fallback === false ? loc : this.current;
    },

    getAll: function() {
      return this.locales;
    },

    set: function(code) {
      var loc = this.get(code, false);
      if (!loc) {
        throw new TypeError('Invalid Locale: ' + code);
      }
      return this.current = loc;
    },

    add: function(code, def) {
      if (!def) {
        def = code;
        code = def.code;
      } else {
        def.code = code;
      }
      var loc = def.compiledFormats ? def : getNewLocale(def);
      this.locales[code] = loc;
      if (!this.current) {
        this.current = loc;
      }
      return loc;
    },

    remove: function(code) {
      if (this.current.code === code) {
        this.current = this.get('en');
      }
      return delete this.locales[code];
    }

  };

  // Sorry about this guys...
  English = getNewLocale(AmericanEnglishDefinition);
  localeManager = new LocaleManager(English);
}

buildLocales();

module.exports = {
  English: English,
  localeManager: localeManager
};
},{"../internal/getNewLocale":284,"./AmericanEnglishDefinition":376,"./LazyLoadedLocales":388}],390:[function(require,module,exports){
'use strict';

var LocalizedParsingTokens = {
  'year': {
    base: 'yyyy',
    requiresSuffix: true
  },
  'month': {
    base: 'MM',
    requiresSuffix: true
  },
  'date': {
    base: 'dd',
    requiresSuffix: true
  },
  'hour': {
    base: 'hh',
    requiresSuffixOr: ':'
  },
  'minute': {
    base: 'mm'
  },
  'second': {
    base: 'ss'
  },
  'num': {
    src: '\\d+',
    requiresNumerals: true
  }
};

module.exports = LocalizedParsingTokens;
},{}],391:[function(require,module,exports){
'use strict';

module.exports = 60 * 1000;
},{}],392:[function(require,module,exports){
'use strict';

var ParsingTokens = {
  'yyyy': {
    param: 'year',
    src: '\\d{4}'
  },
  'MM': {
    param: 'month',
    src: '[01]?\\d'
  },
  'dd': {
    param: 'date',
    src: '[0123]?\\d'
  },
  'hh': {
    param: 'hour',
    src: '[0-2]?\\d'
  },
  'mm': {
    param: 'minute',
    src: '[0-5]\\d'
  },
  'ss': {
    param: 'second',
    src: '[0-5]\\d(?:[,.]\\d+)?'
  },
  'yy': {
    param: 'year',
    src: '\\d{2}'
  },
  'y': {
    param: 'year',
    src: '\\d'
  },
  'yearSign': {
    src: '[+-]',
    sign: true
  },
  'tzHour': {
    src: '[0-1]\\d'
  },
  'tzMinute': {
    src: '[0-5]\\d'
  },
  'tzSign': {
    src: '[+−-]',
    sign: true
  },
  'ihh': {
    param: 'hour',
    src: '[0-2]?\\d(?:[,.]\\d+)?'
  },
  'imm': {
    param: 'minute',
    src: '[0-5]\\d(?:[,.]\\d+)?'
  },
  'GMT': {
    param: 'utc',
    src: 'GMT',
    val: 1
  },
  'Z': {
    param: 'utc',
    src: 'Z',
    val: 1
  },
  'timestamp': {
    src: '\\d+'
  }
};

module.exports = ParsingTokens;
},{}],393:[function(require,module,exports){
'use strict';

module.exports = /(\w{3})[()\s\d]*$/;
},{}],394:[function(require,module,exports){
'use strict';

var DATE_OPTIONS = require('./DATE_OPTIONS'),
    namespaceAliases = require('../../common/var/namespaceAliases'),
    defineOptionsAccessor = require('../../common/internal/defineOptionsAccessor');

var sugarDate = namespaceAliases.sugarDate;

module.exports = defineOptionsAccessor(sugarDate, DATE_OPTIONS);
},{"../../common/internal/defineOptionsAccessor":124,"../../common/var/namespaceAliases":197,"./DATE_OPTIONS":381}],395:[function(require,module,exports){
'use strict';

var LocaleHelpers = require('./LocaleHelpers'),
    FormatTokensBase = require('./FormatTokensBase'),
    CoreOutputFormats = require('./CoreOutputFormats'),
    forEach = require('../../common/internal/forEach'),
    padNumber = require('../../common/internal/padNumber'),
    spaceSplit = require('../../common/internal/spaceSplit'),
    namespaceAliases = require('../../common/var/namespaceAliases'),
    coreUtilityAliases = require('../../common/var/coreUtilityAliases'),
    createFormatMatcher = require('../../common/internal/createFormatMatcher'),
    defineInstanceSimilar = require('../../common/internal/defineInstanceSimilar');

var localeManager = LocaleHelpers.localeManager,
    hasOwn = coreUtilityAliases.hasOwn,
    getOwn = coreUtilityAliases.getOwn,
    forEachProperty = coreUtilityAliases.forEachProperty,
    sugarDate = namespaceAliases.sugarDate;

var ldmlTokens, strfTokens;

function buildDateFormatTokens() {

  function addFormats(target, tokens, fn) {
    if (tokens) {
      forEach(spaceSplit(tokens), function(token) {
        target[token] = fn;
      });
    }
  }

  function buildLowercase(get) {
    return function(d, localeCode) {
      return get(d, localeCode).toLowerCase();
    };
  }

  function buildOrdinal(get) {
    return function(d, localeCode) {
      var n = get(d, localeCode);
      return n + localeManager.get(localeCode).getOrdinal(n);
    };
  }

  function buildPadded(get, padding) {
    return function(d, localeCode) {
      return padNumber(get(d, localeCode), padding);
    };
  }

  function buildTwoDigits(get) {
    return function(d, localeCode) {
      return get(d, localeCode) % 100;
    };
  }

  function buildAlias(alias) {
    return function(d, localeCode) {
      return dateFormatMatcher(alias, d, localeCode);
    };
  }

  function buildAlternates(f) {
    for (var n = 1; n <= 5; n++) {
      buildAlternate(f, n);
    }
  }

  function buildAlternate(f, n) {
    var alternate = function(d, localeCode) {
      return f.get(d, localeCode, n);
    };
    addFormats(ldmlTokens, f.ldml + n, alternate);
    if (f.lowerToken) {
      ldmlTokens[f.lowerToken + n] = buildLowercase(alternate);
    }
  }

  function getIdentityFormat(name) {
    return function(d, localeCode) {
      var loc = localeManager.get(localeCode);
      return dateFormatMatcher(loc[name], d, localeCode);
    };
  }

  ldmlTokens = {};
  strfTokens = {};

  forEach(FormatTokensBase, function(f) {
    var get = f.get, getPadded;
    if (f.lowerToken) {
      ldmlTokens[f.lowerToken] = buildLowercase(get);
    }
    if (f.ordinalToken) {
      ldmlTokens[f.ordinalToken] = buildOrdinal(get, f);
    }
    if (f.ldmlPaddedToken) {
      ldmlTokens[f.ldmlPaddedToken] = buildPadded(get, f.ldmlPaddedToken.length);
    }
    if (f.ldmlTwoDigitToken) {
      ldmlTokens[f.ldmlTwoDigitToken] = buildPadded(buildTwoDigits(get), 2);
    }
    if (f.strfTwoDigitToken) {
      strfTokens[f.strfTwoDigitToken] = buildPadded(buildTwoDigits(get), 2);
    }
    if (f.strfPadding) {
      getPadded = buildPadded(get, f.strfPadding);
    }
    if (f.alias) {
      get = buildAlias(f.alias);
    }
    if (f.allowAlternates) {
      buildAlternates(f);
    }
    addFormats(ldmlTokens, f.ldml, get);
    addFormats(strfTokens, f.strf, getPadded || get);
  });

  forEachProperty(CoreOutputFormats, function(src, name) {
    addFormats(ldmlTokens, name, buildAlias(src));
  });

  defineInstanceSimilar(sugarDate, 'short medium long full', function(methods, name) {
    var fn = getIdentityFormat(name);
    addFormats(ldmlTokens, name, fn);
    methods[name] = fn;
  });

  addFormats(ldmlTokens, 'time', getIdentityFormat('time'));
  addFormats(ldmlTokens, 'stamp', getIdentityFormat('stamp'));
}

var dateFormatMatcher;

function buildDateFormatMatcher() {

  function getLdml(d, token, localeCode) {
    return getOwn(ldmlTokens, token)(d, localeCode);
  }

  function getStrf(d, token, localeCode) {
    return getOwn(strfTokens, token)(d, localeCode);
  }

  function checkDateToken(ldml, strf) {
    return hasOwn(ldmlTokens, ldml) || hasOwn(strfTokens, strf);
  }

  // Format matcher for LDML or STRF tokens.
  dateFormatMatcher = createFormatMatcher(getLdml, getStrf, checkDateToken);
}

buildDateFormatTokens();

buildDateFormatMatcher();

module.exports = {
  ldmlTokens: ldmlTokens,
  strfTokens: strfTokens,
  dateFormatMatcher: dateFormatMatcher
};
},{"../../common/internal/createFormatMatcher":114,"../../common/internal/defineInstanceSimilar":122,"../../common/internal/forEach":129,"../../common/internal/padNumber":162,"../../common/internal/spaceSplit":175,"../../common/var/coreUtilityAliases":193,"../../common/var/namespaceAliases":197,"./CoreOutputFormats":379,"./FormatTokensBase":385,"./LocaleHelpers":389}],396:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core');

require('./build/buildDateUnitMethodsCall');

module.exports = Sugar.Date.weeksAgo;
},{"./build/buildDateUnitMethodsCall":214,"sugar-core":809}],397:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core');

require('./build/buildDateUnitMethodsCall');

module.exports = Sugar.Date.weeksFromNow;
},{"./build/buildDateUnitMethodsCall":214,"sugar-core":809}],398:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core');

require('./build/buildDateUnitMethodsCall');

module.exports = Sugar.Date.weeksSince;
},{"./build/buildDateUnitMethodsCall":214,"sugar-core":809}],399:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core');

require('./build/buildDateUnitMethodsCall');

module.exports = Sugar.Date.weeksUntil;
},{"./build/buildDateUnitMethodsCall":214,"sugar-core":809}],400:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core');

require('./build/buildDateUnitMethodsCall');

module.exports = Sugar.Date.yearsAgo;
},{"./build/buildDateUnitMethodsCall":214,"sugar-core":809}],401:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core');

require('./build/buildDateUnitMethodsCall');

module.exports = Sugar.Date.yearsFromNow;
},{"./build/buildDateUnitMethodsCall":214,"sugar-core":809}],402:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core');

require('./build/buildDateUnitMethodsCall');

module.exports = Sugar.Date.yearsSince;
},{"./build/buildDateUnitMethodsCall":214,"sugar-core":809}],403:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core');

require('./build/buildDateUnitMethodsCall');

module.exports = Sugar.Date.yearsUntil;
},{"./build/buildDateUnitMethodsCall":214,"sugar-core":809}],404:[function(require,module,exports){
'use strict';

var buildFromIndexMethods = require('../internal/buildFromIndexMethods');

buildFromIndexMethods();
},{"../internal/buildFromIndexMethods":411}],405:[function(require,module,exports){
'use strict';

// Static Methods
require('../object/average');
require('../object/count');
require('../object/every');
require('../object/filter');
require('../object/find');
require('../object/forEach');
require('../object/least');
require('../object/map');
require('../object/max');
require('../object/median');
require('../object/min');
require('../object/most');
require('../object/none');
require('../object/reduce');
require('../object/some');
require('../object/sum');

// Instance Methods
require('../array/average');
require('../array/count');
require('../array/every');
require('../array/everyFromIndex');
require('../array/filter');
require('../array/filterFromIndex');
require('../array/find');
require('../array/findFromIndex');
require('../array/findIndex');
require('../array/findIndexFromIndex');
require('../array/forEachFromIndex');
require('../array/least');
require('../array/map');
require('../array/mapFromIndex');
require('../array/max');
require('../array/median');
require('../array/min');
require('../array/most');
require('../array/none');
require('../array/reduceFromIndex');
require('../array/reduceRightFromIndex');
require('../array/some');
require('../array/someFromIndex');
require('../array/sum');

module.exports = require('sugar-core');
},{"../array/average":22,"../array/count":27,"../array/every":29,"../array/everyFromIndex":30,"../array/filter":32,"../array/filterFromIndex":33,"../array/find":34,"../array/findFromIndex":35,"../array/findIndex":36,"../array/findIndexFromIndex":37,"../array/forEachFromIndex":40,"../array/least":75,"../array/map":76,"../array/mapFromIndex":77,"../array/max":78,"../array/median":79,"../array/min":80,"../array/most":81,"../array/none":82,"../array/reduceFromIndex":83,"../array/reduceRightFromIndex":84,"../array/some":90,"../array/someFromIndex":91,"../array/sum":94,"../object/average":585,"../object/count":588,"../object/every":590,"../object/filter":592,"../object/find":593,"../object/forEach":594,"../object/least":649,"../object/map":650,"../object/max":651,"../object/median":652,"../object/min":655,"../object/most":656,"../object/none":657,"../object/reduce":658,"../object/some":664,"../object/sum":666,"sugar-core":809}],406:[function(require,module,exports){
'use strict';

var isUndefined = require('../../common/internal/isUndefined'),
    enhancedMatcherMethods = require('../var/enhancedMatcherMethods');

var enhancedFilter = enhancedMatcherMethods.enhancedFilter;

function arrayCount(arr, f) {
  if (isUndefined(f)) {
    return arr.length;
  }
  return enhancedFilter.apply(this, arguments).length;
}

module.exports = arrayCount;
},{"../../common/internal/isUndefined":155,"../var/enhancedMatcherMethods":430}],407:[function(require,module,exports){
'use strict';

var enhancedMatcherMethods = require('../var/enhancedMatcherMethods');

var enhancedSome = enhancedMatcherMethods.enhancedSome;

function arrayNone() {
  return !enhancedSome.apply(this, arguments);
}

module.exports = arrayNone;
},{"../var/enhancedMatcherMethods":430}],408:[function(require,module,exports){
'use strict';

var enumerateWithMapping = require('./enumerateWithMapping');

function average(obj, map) {
  var sum = 0, count = 0;
  enumerateWithMapping(obj, map, function(val) {
    sum += val;
    count++;
  });
  // Prevent divide by 0
  return sum / (count || 1);
}

module.exports = average;
},{"./enumerateWithMapping":414}],409:[function(require,module,exports){
'use strict';

var enhancedMapping = require('./enhancedMapping'),
    wrapNativeArrayMethod = require('./wrapNativeArrayMethod');

function buildEnhancedMapping(name) {
  return wrapNativeArrayMethod(name, enhancedMapping);
}

module.exports = buildEnhancedMapping;
},{"./enhancedMapping":412,"./wrapNativeArrayMethod":426}],410:[function(require,module,exports){
'use strict';

var enhancedMatching = require('./enhancedMatching'),
    wrapNativeArrayMethod = require('./wrapNativeArrayMethod');

function buildEnhancedMatching(name) {
  return wrapNativeArrayMethod(name, enhancedMatching);
}

module.exports = buildEnhancedMatching;
},{"./enhancedMatching":413,"./wrapNativeArrayMethod":426}],411:[function(require,module,exports){
'use strict';

var forEach = require('../../common/internal/forEach'),
    spaceSplit = require('../../common/internal/spaceSplit'),
    classChecks = require('../../common/var/classChecks'),
    mathAliases = require('../../common/var/mathAliases'),
    assertArgument = require('../../common/internal/assertArgument'),
    enhancedMapping = require('./enhancedMapping'),
    namespaceAliases = require('../../common/var/namespaceAliases'),
    enhancedMatching = require('./enhancedMatching'),
    getNormalizedIndex = require('../../common/internal/getNormalizedIndex'),
    coreUtilityAliases = require('../../common/var/coreUtilityAliases'),
    methodDefineAliases = require('../../common/var/methodDefineAliases');

var forEachProperty = coreUtilityAliases.forEachProperty,
    defineInstanceWithArguments = methodDefineAliases.defineInstanceWithArguments,
    sugarArray = namespaceAliases.sugarArray,
    min = mathAliases.min,
    max = mathAliases.max,
    isBoolean = classChecks.isBoolean;

function buildFromIndexMethods() {

  var methods = {
    'forEach': {
      base: forEachAsNative
    },
    'map': {
      wrapper: enhancedMapping
    },
    'some every': {
      wrapper: enhancedMatching
    },
    'findIndex': {
      wrapper: enhancedMatching,
      result: indexResult
    },
    'reduce': {
      apply: applyReduce
    },
    'filter find': {
      wrapper: enhancedMatching
    },
    'reduceRight': {
      apply: applyReduce,
      slice: sliceArrayFromRight,
      clamp: clampStartIndexFromRight
    }
  };

  forEachProperty(methods, function(opts, key) {
    forEach(spaceSplit(key), function(baseName) {
      var methodName = baseName + 'FromIndex';
      var fn = createFromIndexWithOptions(baseName, opts);
      defineInstanceWithArguments(sugarArray, methodName, fn);
    });
  });

  function forEachAsNative(fn) {
    forEach(this, fn);
  }

  // Methods like filter and find have a direct association between the value
  // returned by the callback and the element of the current iteration. This
  // means that when looping, array elements must match the actual index for
  // which they are being called, so the array must be sliced. This is not the
  // case for methods like forEach and map, which either do not use return
  // values or use them in a way that simply getting the element at a shifted
  // index will not affect the final return value. However, these methods will
  // still fail on sparse arrays, so always slicing them here. For example, if
  // "forEachFromIndex" were to be called on [1,,2] from index 1, although the
  // actual index 1 would itself would be skipped, when the array loops back to
  // index 0, shifting it by adding 1 would result in the element for that
  // iteration being undefined. For shifting to work, all gaps in the array
  // between the actual index and the shifted index would have to be accounted
  // for. This is infeasible and is easily solved by simply slicing the actual
  // array instead so that gaps align. Note also that in the case of forEach,
  // we are using the internal function which handles sparse arrays in a way
  // that does not increment the index, and so is highly optimized compared to
  // the others here, which are simply going through the native implementation.
  function sliceArrayFromLeft(arr, startIndex, loop) {
    var result = arr;
    if (startIndex) {
      result = arr.slice(startIndex);
      if (loop) {
        result = result.concat(arr.slice(0, startIndex));
      }
    }
    return result;
  }

  // When iterating from the right, indexes are effectively shifted by 1.
  // For example, iterating from the right from index 2 in an array of 3
  // should also include the last element in the array. This matches the
  // "lastIndexOf" method which also iterates from the right.
  function sliceArrayFromRight(arr, startIndex, loop) {
    if (!loop) {
      startIndex += 1;
      arr = arr.slice(0, max(0, startIndex));
    }
    return arr;
  }

  function clampStartIndex(startIndex, len) {
    return min(len, max(0, startIndex));
  }

  // As indexes are shifted by 1 when starting from the right, clamping has to
  // go down to -1 to accommodate the full range of the sliced array.
  function clampStartIndexFromRight(startIndex, len) {
    return min(len, max(-1, startIndex));
  }

  function applyReduce(arr, startIndex, fn, context, len, loop) {
    return function(acc, val, i) {
      i = getNormalizedIndex(i + startIndex, len, loop);
      return fn.call(arr, acc, val, i, arr);
    };
  }

  function applyEach(arr, startIndex, fn, context, len, loop) {
    return function(el, i) {
      i = getNormalizedIndex(i + startIndex, len, loop);
      return fn.call(context, arr[i], i, arr);
    };
  }

  function indexResult(result, startIndex, len) {
    if (result !== -1) {
      result = (result + startIndex) % len;
    }
    return result;
  }

  function createFromIndexWithOptions(methodName, opts) {

    var baseFn = opts.base || Array.prototype[methodName],
        applyCallback = opts.apply || applyEach,
        sliceArray = opts.slice || sliceArrayFromLeft,
        clampIndex = opts.clamp || clampStartIndex,
        getResult = opts.result,
        wrapper = opts.wrapper;

    return function(arr, startIndex, args) {
      var callArgs = [], argIndex = 0, lastArg, result, len, loop, fn;
      len = arr.length;
      if (isBoolean(args[0])) {
        loop = args[argIndex++];
      }
      fn = args[argIndex++];
      lastArg = args[argIndex];
      if (startIndex < 0) {
        startIndex += len;
      }
      startIndex = clampIndex(startIndex, len);
      assertArgument(args.length);
      fn = wrapper ? wrapper(fn, lastArg) : fn;
      callArgs.push(applyCallback(arr, startIndex, fn, lastArg, len, loop));
      if (lastArg) {
        callArgs.push(lastArg);
      }
      result = baseFn.apply(sliceArray(arr, startIndex, loop), callArgs);
      if (getResult) {
        result = getResult(result, startIndex, len);
      }
      return result;
    };
  }
}

module.exports = buildFromIndexMethods;
},{"../../common/internal/assertArgument":104,"../../common/internal/forEach":129,"../../common/internal/getNormalizedIndex":137,"../../common/internal/spaceSplit":175,"../../common/var/classChecks":192,"../../common/var/coreUtilityAliases":193,"../../common/var/mathAliases":195,"../../common/var/methodDefineAliases":196,"../../common/var/namespaceAliases":197,"./enhancedMapping":412,"./enhancedMatching":413}],412:[function(require,module,exports){
'use strict';

var classChecks = require('../../common/var/classChecks'),
    mapWithShortcuts = require('../../common/internal/mapWithShortcuts');

var isFunction = classChecks.isFunction;

function enhancedMapping(map, context) {
  if (isFunction(map)) {
    return map;
  } else if (map) {
    return function(el, i, arr) {
      return mapWithShortcuts(el, map, context, [el, i, arr]);
    };
  }
}

module.exports = enhancedMapping;
},{"../../common/internal/mapWithShortcuts":160,"../../common/var/classChecks":192}],413:[function(require,module,exports){
'use strict';

var getMatcher = require('../../common/internal/getMatcher'),
    classChecks = require('../../common/var/classChecks');

var isFunction = classChecks.isFunction;

function enhancedMatching(f) {
  var matcher;
  if (isFunction(f)) {
    return f;
  }
  matcher = getMatcher(f);
  return function(el, i, arr) {
    return matcher(el, i, arr);
  };
}

module.exports = enhancedMatching;
},{"../../common/internal/getMatcher":136,"../../common/var/classChecks":192}],414:[function(require,module,exports){
'use strict';

var classChecks = require('../../common/var/classChecks'),
    isArrayIndex = require('../../common/internal/isArrayIndex'),
    mapWithShortcuts = require('../../common/internal/mapWithShortcuts'),
    coreUtilityAliases = require('../../common/var/coreUtilityAliases');

var isArray = classChecks.isArray,
    forEachProperty = coreUtilityAliases.forEachProperty;

function enumerateWithMapping(obj, map, fn) {
  var arrayIndexes = isArray(obj);
  forEachProperty(obj, function(val, key) {
    if (arrayIndexes) {
      if (!isArrayIndex(key)) {
        return;
      }
      key = +key;
    }
    var mapped = mapWithShortcuts(val, map, obj, [val, key, obj]);
    fn(mapped, key);
  });
}

module.exports = enumerateWithMapping;
},{"../../common/internal/isArrayIndex":147,"../../common/internal/mapWithShortcuts":160,"../../common/var/classChecks":192,"../../common/var/coreUtilityAliases":193}],415:[function(require,module,exports){
'use strict';

var classChecks = require('../../common/var/classChecks'),
    getMinOrMax = require('./getMinOrMax'),
    serializeInternal = require('../../common/internal/serializeInternal'),
    coreUtilityAliases = require('../../common/var/coreUtilityAliases'),
    enumerateWithMapping = require('./enumerateWithMapping'),
    getReducedMinMaxResult = require('./getReducedMinMaxResult');

var isBoolean = classChecks.isBoolean,
    getOwn = coreUtilityAliases.getOwn,
    forEachProperty = coreUtilityAliases.forEachProperty;

function getLeastOrMost(obj, arg1, arg2, most, asObject) {
  var group = {}, refs = [], minMaxResult, result, all, map;
  if (isBoolean(arg1)) {
    all = arg1;
    map = arg2;
  } else {
    map = arg1;
  }
  enumerateWithMapping(obj, map, function(val, key) {
    var groupKey = serializeInternal(val, refs);
    var arr = getOwn(group, groupKey) || [];
    arr.push(asObject ? key : obj[key]);
    group[groupKey] = arr;
  });
  minMaxResult = getMinOrMax(group, !!all, 'length', most, true);
  if (all) {
    result = [];
    // Flatten result
    forEachProperty(minMaxResult, function(val) {
      result = result.concat(val);
    });
  } else {
    result = getOwn(group, minMaxResult);
  }
  return getReducedMinMaxResult(result, obj, all, asObject);
}

module.exports = getLeastOrMost;
},{"../../common/internal/serializeInternal":168,"../../common/var/classChecks":192,"../../common/var/coreUtilityAliases":193,"./enumerateWithMapping":414,"./getMinOrMax":416,"./getReducedMinMaxResult":417}],416:[function(require,module,exports){
'use strict';

var classChecks = require('../../common/var/classChecks'),
    isUndefined = require('../../common/internal/isUndefined'),
    enumerateWithMapping = require('./enumerateWithMapping'),
    getReducedMinMaxResult = require('./getReducedMinMaxResult');

var isBoolean = classChecks.isBoolean;

function getMinOrMax(obj, arg1, arg2, max, asObject) {
  var result = [], pushVal, edge, all, map;
  if (isBoolean(arg1)) {
    all = arg1;
    map = arg2;
  } else {
    map = arg1;
  }
  enumerateWithMapping(obj, map, function(val, key) {
    if (isUndefined(val)) {
      throw new TypeError('Cannot compare with undefined');
    }
    pushVal = asObject ? key : obj[key];
    if (val === edge) {
      result.push(pushVal);
    } else if (isUndefined(edge) || (max && val > edge) || (!max && val < edge)) {
      result = [pushVal];
      edge = val;
    }
  });
  return getReducedMinMaxResult(result, obj, all, asObject);
}

module.exports = getMinOrMax;
},{"../../common/internal/isUndefined":155,"../../common/var/classChecks":192,"./enumerateWithMapping":414,"./getReducedMinMaxResult":417}],417:[function(require,module,exports){
'use strict';

function getReducedMinMaxResult(result, obj, all, asObject) {
  if (asObject && all) {
    // The method has returned an array of keys so use this array
    // to build up the resulting object in the form we want it in.
    return result.reduce(function(o, key) {
      o[key] = obj[key];
      return o;
    }, {});
  } else if (result && !all) {
    result = result[0];
  }
  return result;
}

module.exports = getReducedMinMaxResult;
},{}],418:[function(require,module,exports){
'use strict';

var trunc = require('../../common/var/trunc'),
    enumerateWithMapping = require('./enumerateWithMapping');

function median(obj, map) {
  var result = [], middle, len;
  enumerateWithMapping(obj, map, function(val) {
    result.push(val);
  });
  len = result.length;
  if (!len) return 0;
  result.sort(function(a, b) {
    // IE7 will throw errors on non-numbers!
    return (a || 0) - (b || 0);
  });
  middle = trunc(len / 2);
  return len % 2 ? result[middle] : (result[middle - 1] + result[middle]) / 2;
}

module.exports = median;
},{"../../common/var/trunc":198,"./enumerateWithMapping":414}],419:[function(require,module,exports){
'use strict';

var getMatcher = require('../../common/internal/getMatcher'),
    coreUtilityAliases = require('../../common/var/coreUtilityAliases');

var forEachProperty = coreUtilityAliases.forEachProperty;

function objectCount(obj, f) {
  var matcher = getMatcher(f), count = 0;
  forEachProperty(obj, function(val, key) {
    if (matcher(val, key, obj)) {
      count++;
    }
  });
  return count;
}

module.exports = objectCount;
},{"../../common/internal/getMatcher":136,"../../common/var/coreUtilityAliases":193}],420:[function(require,module,exports){
'use strict';

var getMatcher = require('../../common/internal/getMatcher'),
    coreUtilityAliases = require('../../common/var/coreUtilityAliases');

var forEachProperty = coreUtilityAliases.forEachProperty;

function objectFilter(obj, f) {
  var matcher = getMatcher(f), result = {};
  forEachProperty(obj, function(val, key) {
    if (matcher(val, key, obj)) {
      result[key] = val;
    }
  });
  return result;
}

module.exports = objectFilter;
},{"../../common/internal/getMatcher":136,"../../common/var/coreUtilityAliases":193}],421:[function(require,module,exports){
'use strict';

var assertCallable = require('../../common/internal/assertCallable'),
    coreUtilityAliases = require('../../common/var/coreUtilityAliases');

var forEachProperty = coreUtilityAliases.forEachProperty;

function objectForEach(obj, fn) {
  assertCallable(fn);
  forEachProperty(obj, function(val, key) {
    fn(val, key, obj);
  });
  return obj;
}

module.exports = objectForEach;
},{"../../common/internal/assertCallable":106,"../../common/var/coreUtilityAliases":193}],422:[function(require,module,exports){
'use strict';

var mapWithShortcuts = require('../../common/internal/mapWithShortcuts'),
    coreUtilityAliases = require('../../common/var/coreUtilityAliases');

var forEachProperty = coreUtilityAliases.forEachProperty;

function objectMap(obj, map) {
  var result = {};
  forEachProperty(obj, function(val, key) {
    result[key] = mapWithShortcuts(val, map, obj, [val, key, obj]);
  });
  return result;
}

module.exports = objectMap;
},{"../../common/internal/mapWithShortcuts":160,"../../common/var/coreUtilityAliases":193}],423:[function(require,module,exports){
'use strict';

var objectMatchers = require('../var/objectMatchers');

var objectSome = objectMatchers.objectSome;

function objectNone(obj, f) {
  return !objectSome(obj, f);
}

module.exports = objectNone;
},{"../var/objectMatchers":431}],424:[function(require,module,exports){
'use strict';

var isDefined = require('../../common/internal/isDefined'),
    coreUtilityAliases = require('../../common/var/coreUtilityAliases');

var forEachProperty = coreUtilityAliases.forEachProperty;

function objectReduce(obj, fn, acc) {
  var init = isDefined(acc);
  forEachProperty(obj, function(val, key) {
    if (!init) {
      acc = val;
      init = true;
      return;
    }
    acc = fn(acc, val, key, obj);
  });
  return acc;
}

module.exports = objectReduce;
},{"../../common/internal/isDefined":149,"../../common/var/coreUtilityAliases":193}],425:[function(require,module,exports){
'use strict';

var enumerateWithMapping = require('./enumerateWithMapping');

function sum(obj, map) {
  var sum = 0;
  enumerateWithMapping(obj, map, function(val) {
    sum += val;
  });
  return sum;
}

module.exports = sum;
},{"./enumerateWithMapping":414}],426:[function(require,module,exports){
'use strict';

var assertArgument = require('../../common/internal/assertArgument');

function wrapNativeArrayMethod(methodName, wrapper) {
  var nativeFn = Array.prototype[methodName];
  return function(arr, f, context, argsLen) {
    var args = new Array(2);
    assertArgument(argsLen > 0);
    args[0] = wrapper(f, context);
    args[1] = context;
    return nativeFn.apply(arr, args);
  };
}

module.exports = wrapNativeArrayMethod;
},{"../../common/internal/assertArgument":104}],427:[function(require,module,exports){
'use strict';

var getKeys = require('../../common/internal/getKeys'),
    getMatcher = require('../../common/internal/getMatcher');

function wrapObjectMatcher(name) {
  var nativeFn = Array.prototype[name];
  return function(obj, f) {
    var matcher = getMatcher(f);
    return nativeFn.call(getKeys(obj), function(key) {
      return matcher(obj[key], key, obj);
    });
  };
}

module.exports = wrapObjectMatcher;
},{"../../common/internal/getKeys":135,"../../common/internal/getMatcher":136}],428:[function(require,module,exports){
'use strict';

module.exports = 'enhanceArray';
},{}],429:[function(require,module,exports){
'use strict';

var buildEnhancedMapping = require('../internal/buildEnhancedMapping');

module.exports = buildEnhancedMapping('map');
},{"../internal/buildEnhancedMapping":409}],430:[function(require,module,exports){
'use strict';

var buildEnhancedMatching = require('../internal/buildEnhancedMatching');

module.exports = {
  enhancedFind: buildEnhancedMatching('find'),
  enhancedSome: buildEnhancedMatching('some'),
  enhancedEvery: buildEnhancedMatching('every'),
  enhancedFilter: buildEnhancedMatching('filter'),
  enhancedFindIndex: buildEnhancedMatching('findIndex')
};
},{"../internal/buildEnhancedMatching":410}],431:[function(require,module,exports){
'use strict';

var wrapObjectMatcher = require('../internal/wrapObjectMatcher');

module.exports = {
  objectSome: wrapObjectMatcher('some'),
  objectFind: wrapObjectMatcher('find'),
  objectEvery: wrapObjectMatcher('every')
};
},{"../internal/wrapObjectMatcher":427}],432:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core'),
    coercePositiveInteger = require('../common/internal/coercePositiveInteger');

Sugar.Function.defineInstance({

  'after': function(fn, num) {
    var count = 0, collectedArgs = [];
    num = coercePositiveInteger(num);
    return function() {
      // Optimized: no leaking arguments
      var args = []; for(var $i = 0, $len = arguments.length; $i < $len; $i++) args.push(arguments[$i]);
      collectedArgs.push(args);
      count++;
      if (count >= num) {
        return fn.call(this, collectedArgs);
      }
    };
  }

});

module.exports = Sugar.Function.after;
},{"../common/internal/coercePositiveInteger":110,"sugar-core":809}],433:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core'),
    cancelFunction = require('./internal/cancelFunction');

Sugar.Function.defineInstance({

  'cancel': function(fn) {
    return cancelFunction(fn);
  }

});

module.exports = Sugar.Function.cancel;
},{"./internal/cancelFunction":438,"sugar-core":809}],434:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core'),
    setDelay = require('./internal/setDelay'),
    cancelFunction = require('./internal/cancelFunction');

Sugar.Function.defineInstance({

  'debounce': function(fn, ms) {
    function debounced() {
      // Optimized: no leaking arguments
      var args = []; for(var $i = 0, $len = arguments.length; $i < $len; $i++) args.push(arguments[$i]);
      cancelFunction(debounced);
      setDelay(debounced, ms, fn, this, args);
    }
    return debounced;
  }

});

module.exports = Sugar.Function.debounce;
},{"./internal/cancelFunction":438,"./internal/setDelay":442,"sugar-core":809}],435:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core'),
    setDelay = require('./internal/setDelay');

Sugar.Function.defineInstanceWithArguments({

  'delay': function(fn, ms, args) {
    setDelay(fn, ms, fn, fn, args);
    return fn;
  }

});

module.exports = Sugar.Function.delay;
},{"./internal/setDelay":442,"sugar-core":809}],436:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core'),
    setDelay = require('./internal/setDelay');

Sugar.Function.defineInstanceWithArguments({

  'every': function(fn, ms, args) {
    function execute () {
      // Set the delay first here, so that cancel
      // can be called within the executing function.
      setDelay(fn, ms, execute);
      fn.apply(fn, args);
    }
    setDelay(fn, ms, execute);
    return fn;
  }

});

module.exports = Sugar.Function.every;
},{"./internal/setDelay":442,"sugar-core":809}],437:[function(require,module,exports){
'use strict';

// Instance Methods
require('./after');
require('./cancel');
require('./debounce');
require('./delay');
require('./every');
require('./lazy');
require('./lock');
require('./memoize');
require('./once');
require('./partial');
require('./throttle');

module.exports = require('sugar-core');
},{"./after":432,"./cancel":433,"./debounce":434,"./delay":435,"./every":436,"./lazy":443,"./lock":444,"./memoize":445,"./once":446,"./partial":447,"./throttle":448,"sugar-core":809}],438:[function(require,module,exports){
'use strict';

var _timers = require('../var/_timers'),
    _canceled = require('../var/_canceled'),
    classChecks = require('../../common/var/classChecks');

var isArray = classChecks.isArray;

function cancelFunction(fn) {
  var timers = _timers(fn), timer;
  if (isArray(timers)) {
    while(timer = timers.shift()) {
      clearTimeout(timer);
    }
  }
  _canceled(fn, true);
  return fn;
}

module.exports = cancelFunction;
},{"../../common/var/classChecks":192,"../var/_canceled":449,"../var/_timers":452}],439:[function(require,module,exports){
'use strict';

function collectArguments() {
  var args = arguments, i = args.length, arr = new Array(i);
  while (i--) {
    arr[i] = args[i];
  }
  return arr;
}

module.exports = collectArguments;
},{}],440:[function(require,module,exports){
'use strict';

var serializeInternal = require('../../common/internal/serializeInternal'),
    coreUtilityAliases = require('../../common/var/coreUtilityAliases');

var hasOwn = coreUtilityAliases.hasOwn,
    getOwn = coreUtilityAliases.getOwn;

function createHashedMemoizeFunction(fn, hashFn, limit) {
  var map = {}, refs = [], counter = 0;
  return function() {
    var hashObj = hashFn.apply(this, arguments);
    var key = serializeInternal(hashObj, refs);
    if (hasOwn(map, key)) {
      return getOwn(map, key);
    }
    if (counter === limit) {
      map = {};
      refs = [];
      counter = 0;
    }
    counter++;
    return map[key] = fn.apply(this, arguments);
  };
}

module.exports = createHashedMemoizeFunction;
},{"../../common/internal/serializeInternal":168,"../../common/var/coreUtilityAliases":193}],441:[function(require,module,exports){
'use strict';

var setDelay = require('./setDelay'),
    mathAliases = require('../../common/var/mathAliases');

var max = mathAliases.max,
    ceil = mathAliases.ceil,
    round = mathAliases.round;

function createLazyFunction(fn, ms, immediate, limit) {
  var queue = [], locked = false, execute, rounded, perExecution, result;
  ms = ms || 1;
  limit = limit || Infinity;
  rounded = ceil(ms);
  perExecution = round(rounded / ms) || 1;
  execute = function() {
    var queueLength = queue.length, maxPerRound;
    if (queueLength == 0) return;
    // Allow fractions of a millisecond by calling
    // multiple times per actual timeout execution
    maxPerRound = max(queueLength - perExecution, 0);
    while(queueLength > maxPerRound) {
      // Getting uber-meta here...
      result = Function.prototype.apply.apply(fn, queue.shift());
      queueLength--;
    }
    setDelay(lazy, rounded, function() {
      locked = false;
      execute();
    });
  };
  function lazy() {
    // If the execution has locked and it's immediate, then
    // allow 1 less in the queue as 1 call has already taken place.
    if (queue.length < limit - (locked && immediate ? 1 : 0)) {
      // Optimized: no leaking arguments
      var args = []; for(var $i = 0, $len = arguments.length; $i < $len; $i++) args.push(arguments[$i]);
      queue.push([this, args]);
    }
    if (!locked) {
      locked = true;
      if (immediate) {
        execute();
      } else {
        setDelay(lazy, rounded, execute);
      }
    }
    // Return the memoized result
    return result;
  }
  return lazy;
}

module.exports = createLazyFunction;
},{"../../common/var/mathAliases":195,"./setDelay":442}],442:[function(require,module,exports){
'use strict';

var _timers = require('../var/_timers'),
    _canceled = require('../var/_canceled'),
    coercePositiveInteger = require('../../common/internal/coercePositiveInteger');

function setDelay(fn, ms, after, scope, args) {
  // Delay of infinity is never called of course...
  ms = coercePositiveInteger(ms || 0);
  if (!_timers(fn)) {
    _timers(fn, []);
  }
  // This is a workaround for <= IE8, which apparently has the
  // ability to call timeouts in the queue on the same tick (ms?)
  // even if functionally they have already been cleared.
  _canceled(fn, false);
  _timers(fn).push(setTimeout(function() {
    if (!_canceled(fn)) {
      after.apply(scope, args || []);
    }
  }, ms));
}

module.exports = setDelay;
},{"../../common/internal/coercePositiveInteger":110,"../var/_canceled":449,"../var/_timers":452}],443:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core'),
    createLazyFunction = require('./internal/createLazyFunction');

Sugar.Function.defineInstance({

  'lazy': function(fn, ms, immediate, limit) {
    return createLazyFunction(fn, ms, immediate, limit);
  }

});

module.exports = Sugar.Function.lazy;
},{"./internal/createLazyFunction":441,"sugar-core":809}],444:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core'),
    _lock = require('./var/_lock'),
    _partial = require('./var/_partial'),
    classChecks = require('../common/var/classChecks'),
    mathAliases = require('../common/var/mathAliases');

var isNumber = classChecks.isNumber,
    min = mathAliases.min;

Sugar.Function.defineInstance({

  'lock': function(fn, n) {
    var lockedFn;
    if (_partial(fn)) {
      _lock(fn, isNumber(n) ? n : null);
      return fn;
    }
    lockedFn = function() {
      arguments.length = min(_lock(lockedFn), arguments.length);
      return fn.apply(this, arguments);
    };
    _lock(lockedFn, isNumber(n) ? n : fn.length);
    return lockedFn;
  }

});

module.exports = Sugar.Function.lock;
},{"../common/var/classChecks":192,"../common/var/mathAliases":195,"./var/_lock":450,"./var/_partial":451,"sugar-core":809}],445:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core'),
    classChecks = require('../common/var/classChecks'),
    deepGetProperty = require('../common/internal/deepGetProperty'),
    collectArguments = require('./internal/collectArguments'),
    createHashedMemoizeFunction = require('./internal/createHashedMemoizeFunction');

var isNumber = classChecks.isNumber,
    isString = classChecks.isString;

Sugar.Function.defineInstance({

  'memoize': function(fn, arg1, arg2) {
    var hashFn, limit, prop;
    if (isNumber(arg1)) {
      limit = arg1;
    } else {
      hashFn = arg1;
      limit  = arg2;
    }
    if (isString(hashFn)) {
      prop = hashFn;
      hashFn = function(obj) {
        return deepGetProperty(obj, prop);
      };
    } else if (!hashFn) {
      hashFn = collectArguments;
    }
    return createHashedMemoizeFunction(fn, hashFn, limit);
  }

});

module.exports = Sugar.Function.memoize;
},{"../common/internal/deepGetProperty":116,"../common/var/classChecks":192,"./internal/collectArguments":439,"./internal/createHashedMemoizeFunction":440,"sugar-core":809}],446:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core');

Sugar.Function.defineInstance({

  'once': function(fn) {
    var called = false, val;
    return function() {
      if (called) {
        return val;
      }
      called = true;
      return val = fn.apply(this, arguments);
    };
  }

});

module.exports = Sugar.Function.once;
},{"sugar-core":809}],447:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core'),
    _lock = require('./var/_lock'),
    _partial = require('./var/_partial'),
    isDefined = require('../common/internal/isDefined'),
    classChecks = require('../common/var/classChecks'),
    mathAliases = require('../common/var/mathAliases'),
    isObjectType = require('../common/internal/isObjectType'),
    createInstanceFromPrototype = require('./var/createInstanceFromPrototype');

var isNumber = classChecks.isNumber,
    min = mathAliases.min;

Sugar.Function.defineInstanceWithArguments({

  'partial': function(fn, curriedArgs) {
    var curriedLen = curriedArgs.length;
    var partialFn = function() {
      var argIndex = 0, applyArgs = [], self = this, lock = _lock(partialFn), result, i;
      for (i = 0; i < curriedLen; i++) {
        var arg = curriedArgs[i];
        if (isDefined(arg)) {
          applyArgs[i] = arg;
        } else {
          applyArgs[i] = arguments[argIndex++];
        }
      }
      for (i = argIndex; i < arguments.length; i++) {
        applyArgs.push(arguments[i]);
      }
      if (lock === null) {
        lock = curriedLen;
      }
      if (isNumber(lock)) {
        applyArgs.length = min(applyArgs.length, lock);
      }
      // If the bound "this" object is an instance of the partialed
      // function, then "new" was used, so preserve the prototype
      // so that constructor functions can also be partialed.
      if (self instanceof partialFn) {
        self = createInstanceFromPrototype(fn.prototype);
        result = fn.apply(self, applyArgs);
        // An explicit return value is allowed from constructors
        // as long as they are of "object" type, so return the
        // correct result here accordingly.
        return isObjectType(result) ? result : self;
      }
      return fn.apply(self, applyArgs);
    };
    _partial(partialFn, true);
    return partialFn;
  }

});

module.exports = Sugar.Function.partial;
},{"../common/internal/isDefined":149,"../common/internal/isObjectType":151,"../common/var/classChecks":192,"../common/var/mathAliases":195,"./var/_lock":450,"./var/_partial":451,"./var/createInstanceFromPrototype":453,"sugar-core":809}],448:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core'),
    createLazyFunction = require('./internal/createLazyFunction');

Sugar.Function.defineInstance({

  'throttle': function(fn, ms) {
    return createLazyFunction(fn, ms, true, 1);
  }

});

module.exports = Sugar.Function.throttle;
},{"./internal/createLazyFunction":441,"sugar-core":809}],449:[function(require,module,exports){
'use strict';

var privatePropertyAccessor = require('../../common/internal/privatePropertyAccessor');

module.exports = privatePropertyAccessor('canceled');
},{"../../common/internal/privatePropertyAccessor":164}],450:[function(require,module,exports){
'use strict';

var privatePropertyAccessor = require('../../common/internal/privatePropertyAccessor');

module.exports = privatePropertyAccessor('lock');
},{"../../common/internal/privatePropertyAccessor":164}],451:[function(require,module,exports){
'use strict';

var privatePropertyAccessor = require('../../common/internal/privatePropertyAccessor');

module.exports = privatePropertyAccessor('partial');
},{"../../common/internal/privatePropertyAccessor":164}],452:[function(require,module,exports){
'use strict';

var privatePropertyAccessor = require('../../common/internal/privatePropertyAccessor');

module.exports = privatePropertyAccessor('timers');
},{"../../common/internal/privatePropertyAccessor":164}],453:[function(require,module,exports){
'use strict';

var createInstanceFromPrototype = Object.create || function(prototype) {
  var ctor = function() {};
  ctor.prototype = prototype;
  return new ctor;
};

module.exports = createInstanceFromPrototype;
},{}],454:[function(require,module,exports){
'use strict';

require('./string');
require('./number');
require('./array');
require('./enumerable');
require('./object');
require('./date');
require('./range');
require('./function');
require('./regexp');

module.exports = require('sugar-core');
},{"./array":46,"./date":244,"./enumerable":405,"./function":437,"./number":494,"./object":598,"./range":683,"./regexp":724,"./string":743,"sugar-core":809}],455:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core'),
    AbbreviationUnits = require('./var/AbbreviationUnits'),
    abbreviateNumber = require('./internal/abbreviateNumber');

var BASIC_UNITS = AbbreviationUnits.BASIC_UNITS;

Sugar.Number.defineInstance({

  'abbr': function(n, precision) {
    return abbreviateNumber(n, precision, BASIC_UNITS);
  }

});

module.exports = Sugar.Number.abbr;
},{"./internal/abbreviateNumber":495,"./var/AbbreviationUnits":560,"sugar-core":809}],456:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core');

require('./build/buildMathAliasesCall');

module.exports = Sugar.Number.abs;
},{"./build/buildMathAliasesCall":460,"sugar-core":809}],457:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core');

require('./build/buildMathAliasesCall');

module.exports = Sugar.Number.acos;
},{"./build/buildMathAliasesCall":460,"sugar-core":809}],458:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core');

require('./build/buildMathAliasesCall');

module.exports = Sugar.Number.asin;
},{"./build/buildMathAliasesCall":460,"sugar-core":809}],459:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core');

require('./build/buildMathAliasesCall');

module.exports = Sugar.Number.atan;
},{"./build/buildMathAliasesCall":460,"sugar-core":809}],460:[function(require,module,exports){
'use strict';

var buildMathAliases = require('../internal/buildMathAliases');

buildMathAliases();
},{"../internal/buildMathAliases":496}],461:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core'),
    AbbreviationUnits = require('./var/AbbreviationUnits'),
    abbreviateNumber = require('./internal/abbreviateNumber');

var MEMORY_UNITS = AbbreviationUnits.MEMORY_UNITS,
    MEMORY_BINARY_UNITS = AbbreviationUnits.MEMORY_BINARY_UNITS;

Sugar.Number.defineInstance({

  'bytes': function(n, precision, binary, units) {
    if (units === 'binary' || (!units && binary)) {
      units = MEMORY_BINARY_UNITS;
    } else if(units === 'si' || !units) {
      units = MEMORY_UNITS;
    }
    return abbreviateNumber(n, precision, units, binary) + 'B';
  }

});

module.exports = Sugar.Number.bytes;
},{"./internal/abbreviateNumber":495,"./var/AbbreviationUnits":560,"sugar-core":809}],462:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core'),
    Range = require('../range/internal/Range'),
    rangeClamp = require('../range/internal/rangeClamp');

Sugar.Number.defineInstance({

  'cap': function(n, max) {
    return rangeClamp(new Range(undefined, max), n);
  }

});

module.exports = Sugar.Number.cap;
},{"../range/internal/Range":684,"../range/internal/rangeClamp":698,"sugar-core":809}],463:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core'),
    mathAliases = require('../common/var/mathAliases'),
    createRoundingFunction = require('./internal/createRoundingFunction');

var ceil = mathAliases.ceil;

Sugar.Number.defineInstance({

  'ceil': createRoundingFunction(ceil)

});

module.exports = Sugar.Number.ceil;
},{"../common/var/mathAliases":195,"./internal/createRoundingFunction":497,"sugar-core":809}],464:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core'),
    chr = require('../common/var/chr');

Sugar.Number.defineInstance({

  'chr': function(n) {
    return chr(n);
  }

});

module.exports = Sugar.Number.chr;
},{"../common/var/chr":191,"sugar-core":809}],465:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core'),
    Range = require('../range/internal/Range'),
    rangeClamp = require('../range/internal/rangeClamp');

Sugar.Number.defineInstance({

  'clamp': function(n, start, end) {
    return rangeClamp(new Range(start, end), n);
  }

});

module.exports = Sugar.Number.clamp;
},{"../range/internal/Range":684,"../range/internal/rangeClamp":698,"sugar-core":809}],466:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core');

require('./build/buildMathAliasesCall');

module.exports = Sugar.Number.cos;
},{"./build/buildMathAliasesCall":460,"sugar-core":809}],467:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core');

require('../date/build/buildNumberUnitMethodsCall');

module.exports = Sugar.Number.day;
},{"../date/build/buildNumberUnitMethodsCall":215,"sugar-core":809}],468:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core');

require('../date/build/buildNumberUnitMethodsCall');

module.exports = Sugar.Number.dayAfter;
},{"../date/build/buildNumberUnitMethodsCall":215,"sugar-core":809}],469:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core');

require('../date/build/buildNumberUnitMethodsCall');

module.exports = Sugar.Number.dayAgo;
},{"../date/build/buildNumberUnitMethodsCall":215,"sugar-core":809}],470:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core');

require('../date/build/buildNumberUnitMethodsCall');

module.exports = Sugar.Number.dayBefore;
},{"../date/build/buildNumberUnitMethodsCall":215,"sugar-core":809}],471:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core');

require('../date/build/buildNumberUnitMethodsCall');

module.exports = Sugar.Number.dayFromNow;
},{"../date/build/buildNumberUnitMethodsCall":215,"sugar-core":809}],472:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core');

require('../date/build/buildNumberUnitMethodsCall');

module.exports = Sugar.Number.days;
},{"../date/build/buildNumberUnitMethodsCall":215,"sugar-core":809}],473:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core');

require('../date/build/buildNumberUnitMethodsCall');

module.exports = Sugar.Number.daysAfter;
},{"../date/build/buildNumberUnitMethodsCall":215,"sugar-core":809}],474:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core');

require('../date/build/buildNumberUnitMethodsCall');

module.exports = Sugar.Number.daysAgo;
},{"../date/build/buildNumberUnitMethodsCall":215,"sugar-core":809}],475:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core');

require('../date/build/buildNumberUnitMethodsCall');

module.exports = Sugar.Number.daysBefore;
},{"../date/build/buildNumberUnitMethodsCall":215,"sugar-core":809}],476:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core');

require('../date/build/buildNumberUnitMethodsCall');

module.exports = Sugar.Number.daysFromNow;
},{"../date/build/buildNumberUnitMethodsCall":215,"sugar-core":809}],477:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core'),
    upto = require('./upto');

Sugar.Number.alias('downto', 'upto');

module.exports = Sugar.Number.downto;
},{"./upto":559,"sugar-core":809}],478:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core'),
    LocaleHelpers = require('../date/var/LocaleHelpers');

var localeManager = LocaleHelpers.localeManager;

Sugar.Number.defineInstance({

  'duration': function(n, localeCode) {
    return localeManager.get(localeCode).getDuration(n);
  }

});

module.exports = Sugar.Number.duration;
},{"../date/var/LocaleHelpers":389,"sugar-core":809}],479:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core');

require('./build/buildMathAliasesCall');

module.exports = Sugar.Number.exp;
},{"./build/buildMathAliasesCall":460,"sugar-core":809}],480:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core'),
    mathAliases = require('../common/var/mathAliases'),
    createRoundingFunction = require('./internal/createRoundingFunction');

var floor = mathAliases.floor;

Sugar.Number.defineInstance({

  'floor': createRoundingFunction(floor)

});

module.exports = Sugar.Number.floor;
},{"../common/var/mathAliases":195,"./internal/createRoundingFunction":497,"sugar-core":809}],481:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core'),
    numberFormat = require('./internal/numberFormat');

Sugar.Number.defineInstance({

  'format': function(n, place) {
    return numberFormat(n, place);
  }

});

module.exports = Sugar.Number.format;
},{"./internal/numberFormat":500,"sugar-core":809}],482:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core'),
    _numberOptions = require('./var/_numberOptions');

module.exports = Sugar.Number.getOption;
},{"./var/_numberOptions":562,"sugar-core":809}],483:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core'),
    padNumber = require('../common/internal/padNumber');

Sugar.Number.defineInstance({

  'hex': function(n, pad) {
    return padNumber(n, pad || 1, false, 16);
  }

});

module.exports = Sugar.Number.hex;
},{"../common/internal/padNumber":162,"sugar-core":809}],484:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core');

require('../date/build/buildNumberUnitMethodsCall');

module.exports = Sugar.Number.hour;
},{"../date/build/buildNumberUnitMethodsCall":215,"sugar-core":809}],485:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core');

require('../date/build/buildNumberUnitMethodsCall');

module.exports = Sugar.Number.hourAfter;
},{"../date/build/buildNumberUnitMethodsCall":215,"sugar-core":809}],486:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core');

require('../date/build/buildNumberUnitMethodsCall');

module.exports = Sugar.Number.hourAgo;
},{"../date/build/buildNumberUnitMethodsCall":215,"sugar-core":809}],487:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core');

require('../date/build/buildNumberUnitMethodsCall');

module.exports = Sugar.Number.hourBefore;
},{"../date/build/buildNumberUnitMethodsCall":215,"sugar-core":809}],488:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core');

require('../date/build/buildNumberUnitMethodsCall');

module.exports = Sugar.Number.hourFromNow;
},{"../date/build/buildNumberUnitMethodsCall":215,"sugar-core":809}],489:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core');

require('../date/build/buildNumberUnitMethodsCall');

module.exports = Sugar.Number.hours;
},{"../date/build/buildNumberUnitMethodsCall":215,"sugar-core":809}],490:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core');

require('../date/build/buildNumberUnitMethodsCall');

module.exports = Sugar.Number.hoursAfter;
},{"../date/build/buildNumberUnitMethodsCall":215,"sugar-core":809}],491:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core');

require('../date/build/buildNumberUnitMethodsCall');

module.exports = Sugar.Number.hoursAgo;
},{"../date/build/buildNumberUnitMethodsCall":215,"sugar-core":809}],492:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core');

require('../date/build/buildNumberUnitMethodsCall');

module.exports = Sugar.Number.hoursBefore;
},{"../date/build/buildNumberUnitMethodsCall":215,"sugar-core":809}],493:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core');

require('../date/build/buildNumberUnitMethodsCall');

module.exports = Sugar.Number.hoursFromNow;
},{"../date/build/buildNumberUnitMethodsCall":215,"sugar-core":809}],494:[function(require,module,exports){
'use strict';

// Static Methods
require('./random');

// Instance Methods
require('./abbr');
require('./abs');
require('./acos');
require('./asin');
require('./atan');
require('./bytes');
require('./ceil');
require('./chr');
require('./cos');
require('./exp');
require('./floor');
require('./format');
require('./hex');
require('./isEven');
require('./isInteger');
require('./isMultipleOf');
require('./isOdd');
require('./log');
require('./metric');
require('./ordinalize');
require('./pad');
require('./pow');
require('./round');
require('./sin');
require('./sqrt');
require('./tan');
require('./times');
require('./toNumber');

// Accessors
require('./getOption');
require('./setOption');

module.exports = require('sugar-core');
},{"./abbr":455,"./abs":456,"./acos":457,"./asin":458,"./atan":459,"./bytes":461,"./ceil":463,"./chr":464,"./cos":466,"./exp":479,"./floor":480,"./format":481,"./getOption":482,"./hex":483,"./isEven":501,"./isInteger":502,"./isMultipleOf":503,"./isOdd":504,"./log":505,"./metric":506,"./ordinalize":537,"./pad":538,"./pow":539,"./random":540,"./round":542,"./setOption":553,"./sin":554,"./sqrt":555,"./tan":556,"./times":557,"./toNumber":558,"sugar-core":809}],495:[function(require,module,exports){
'use strict';

var commaSplit = require('../../common/internal/commaSplit'),
    mathAliases = require('../../common/var/mathAliases'),
    numberFormat = require('./numberFormat'),
    withPrecision = require('../../common/internal/withPrecision');

var abs = mathAliases.abs,
    pow = mathAliases.pow,
    min = mathAliases.min,
    max = mathAliases.max,
    floor = mathAliases.floor;

function abbreviateNumber(num, precision, ustr, bytes) {
  var fixed        = num.toFixed(20),
      decimalPlace = fixed.search(/\./),
      numeralPlace = fixed.search(/[1-9]/),
      significant  = decimalPlace - numeralPlace,
      units, unit, mid, i, divisor;
  if (significant > 0) {
    significant -= 1;
  }
  units = commaSplit(ustr);
  if (units.length === 1) {
    units = ustr.split('');
  }
  mid = units.indexOf('|');
  if (mid === -1) {
    // Skipping the placeholder means the units should start from zero,
    // otherwise assume they end at zero.
    mid = units[0] === '_' ? 0 : units.length;
  }
  i = max(min(floor(significant / 3), units.length - mid - 1), -mid);
  unit = units[i + mid];
  while (unit === '_') {
    i += i < 0 ? -1 : 1;
    unit = units[i + mid];
  }
  if (unit === '|') {
    unit = '';
  }
  if (significant < -9) {
    precision = abs(significant) - 9;
  }
  divisor = bytes ? pow(2, 10 * i) : pow(10, i * 3);
  return numberFormat(withPrecision(num / divisor, precision || 0)) + unit;
}

module.exports = abbreviateNumber;
},{"../../common/internal/commaSplit":113,"../../common/internal/withPrecision":178,"../../common/var/mathAliases":195,"./numberFormat":500}],496:[function(require,module,exports){
'use strict';

var namespaceAliases = require('../../common/var/namespaceAliases'),
    defineInstanceSimilar = require('../../common/internal/defineInstanceSimilar');

var sugarNumber = namespaceAliases.sugarNumber;

function buildMathAliases() {
  defineInstanceSimilar(sugarNumber, 'abs pow sin asin cos acos tan atan exp pow sqrt', function(methods, name) {
    methods[name] = function(n, arg) {
      // Note that .valueOf() here is only required due to a
      // very strange bug in iOS7 that only occurs occasionally
      // in which Math.abs() called on non-primitive numbers
      // returns a completely different number (Issue #400)
      return Math[name](n.valueOf(), arg);
    };
  });
}

module.exports = buildMathAliases;
},{"../../common/internal/defineInstanceSimilar":122,"../../common/var/namespaceAliases":197}],497:[function(require,module,exports){
'use strict';

var withPrecision = require('../../common/internal/withPrecision');

function createRoundingFunction(fn) {
  return function(n, precision) {
    return precision ? withPrecision(n, precision, fn) : fn(n);
  };
}

module.exports = createRoundingFunction;
},{"../../common/internal/withPrecision":178}],498:[function(require,module,exports){
'use strict';

function isInteger(n) {
  return n % 1 === 0;
}

module.exports = isInteger;
},{}],499:[function(require,module,exports){
'use strict';

function isMultipleOf(n1, n2) {
  return n1 % n2 === 0;
}

module.exports = isMultipleOf;
},{}],500:[function(require,module,exports){
'use strict';

var classChecks = require('../../common/var/classChecks'),
    mathAliases = require('../../common/var/mathAliases'),
    periodSplit = require('../../common/internal/periodSplit'),
    repeatString = require('../../common/internal/repeatString'),
    withPrecision = require('../../common/internal/withPrecision'),
    _numberOptions = require('../var/_numberOptions');

var isNumber = classChecks.isNumber,
    max = mathAliases.max;

function numberFormat(num, place) {
  var result = '', thousands, decimal, fraction, integer, split, str;

  decimal   = _numberOptions('decimal');
  thousands = _numberOptions('thousands');

  if (isNumber(place)) {
    str = withPrecision(num, place || 0).toFixed(max(place, 0));
  } else {
    str = num.toString();
  }

  str = str.replace(/^-/, '');
  split    = periodSplit(str);
  integer  = split[0];
  fraction = split[1];
  if (/e/.test(str)) {
    result = str;
  } else {
    for(var i = integer.length; i > 0; i -= 3) {
      if (i < integer.length) {
        result = thousands + result;
      }
      result = integer.slice(max(0, i - 3), i) + result;
    }
  }
  if (fraction) {
    result += decimal + repeatString('0', (place || 0) - fraction.length) + fraction;
  }
  return (num < 0 ? '-' : '') + result;
}

module.exports = numberFormat;
},{"../../common/internal/periodSplit":163,"../../common/internal/repeatString":166,"../../common/internal/withPrecision":178,"../../common/var/classChecks":192,"../../common/var/mathAliases":195,"../var/_numberOptions":562}],501:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core'),
    isMultipleOf = require('./internal/isMultipleOf');

Sugar.Number.defineInstance({

  'isEven': function(n) {
    return isMultipleOf(n, 2);
  }

});

module.exports = Sugar.Number.isEven;
},{"./internal/isMultipleOf":499,"sugar-core":809}],502:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core'),
    isInteger = require('./internal/isInteger');

Sugar.Number.defineInstance({

  'isInteger': function(n) {
    return isInteger(n);
  }

});

module.exports = Sugar.Number.isInteger;
},{"./internal/isInteger":498,"sugar-core":809}],503:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core'),
    isMultipleOf = require('./internal/isMultipleOf');

Sugar.Number.defineInstance({

  'isMultipleOf': function(n, num) {
    return isMultipleOf(n, num);
  }

});

module.exports = Sugar.Number.isMultipleOf;
},{"./internal/isMultipleOf":499,"sugar-core":809}],504:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core'),
    isInteger = require('./internal/isInteger'),
    isMultipleOf = require('./internal/isMultipleOf');

Sugar.Number.defineInstance({

  'isOdd': function(n) {
    return isInteger(n) && !isMultipleOf(n, 2);
  }

});

module.exports = Sugar.Number.isOdd;
},{"./internal/isInteger":498,"./internal/isMultipleOf":499,"sugar-core":809}],505:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core');

Sugar.Number.defineInstance({

  'log': function(n, base) {
    return Math.log(n) / (base ? Math.log(base) : 1);
  }

});

module.exports = Sugar.Number.log;
},{"sugar-core":809}],506:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core'),
    AbbreviationUnits = require('./var/AbbreviationUnits'),
    abbreviateNumber = require('./internal/abbreviateNumber');

var METRIC_UNITS_SHORT = AbbreviationUnits.METRIC_UNITS_SHORT,
    METRIC_UNITS_FULL = AbbreviationUnits.METRIC_UNITS_FULL;

Sugar.Number.defineInstance({

  'metric': function(n, precision, units) {
    if (units === 'all') {
      units = METRIC_UNITS_FULL;
    } else if (!units) {
      units = METRIC_UNITS_SHORT;
    }
    return abbreviateNumber(n, precision, units);
  }

});

module.exports = Sugar.Number.metric;
},{"./internal/abbreviateNumber":495,"./var/AbbreviationUnits":560,"sugar-core":809}],507:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core');

require('../date/build/buildNumberUnitMethodsCall');

module.exports = Sugar.Number.millisecond;
},{"../date/build/buildNumberUnitMethodsCall":215,"sugar-core":809}],508:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core');

require('../date/build/buildNumberUnitMethodsCall');

module.exports = Sugar.Number.millisecondAfter;
},{"../date/build/buildNumberUnitMethodsCall":215,"sugar-core":809}],509:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core');

require('../date/build/buildNumberUnitMethodsCall');

module.exports = Sugar.Number.millisecondAgo;
},{"../date/build/buildNumberUnitMethodsCall":215,"sugar-core":809}],510:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core');

require('../date/build/buildNumberUnitMethodsCall');

module.exports = Sugar.Number.millisecondBefore;
},{"../date/build/buildNumberUnitMethodsCall":215,"sugar-core":809}],511:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core');

require('../date/build/buildNumberUnitMethodsCall');

module.exports = Sugar.Number.millisecondFromNow;
},{"../date/build/buildNumberUnitMethodsCall":215,"sugar-core":809}],512:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core');

require('../date/build/buildNumberUnitMethodsCall');

module.exports = Sugar.Number.milliseconds;
},{"../date/build/buildNumberUnitMethodsCall":215,"sugar-core":809}],513:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core');

require('../date/build/buildNumberUnitMethodsCall');

module.exports = Sugar.Number.millisecondsAfter;
},{"../date/build/buildNumberUnitMethodsCall":215,"sugar-core":809}],514:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core');

require('../date/build/buildNumberUnitMethodsCall');

module.exports = Sugar.Number.millisecondsAgo;
},{"../date/build/buildNumberUnitMethodsCall":215,"sugar-core":809}],515:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core');

require('../date/build/buildNumberUnitMethodsCall');

module.exports = Sugar.Number.millisecondsBefore;
},{"../date/build/buildNumberUnitMethodsCall":215,"sugar-core":809}],516:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core');

require('../date/build/buildNumberUnitMethodsCall');

module.exports = Sugar.Number.millisecondsFromNow;
},{"../date/build/buildNumberUnitMethodsCall":215,"sugar-core":809}],517:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core');

require('../date/build/buildNumberUnitMethodsCall');

module.exports = Sugar.Number.minute;
},{"../date/build/buildNumberUnitMethodsCall":215,"sugar-core":809}],518:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core');

require('../date/build/buildNumberUnitMethodsCall');

module.exports = Sugar.Number.minuteAfter;
},{"../date/build/buildNumberUnitMethodsCall":215,"sugar-core":809}],519:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core');

require('../date/build/buildNumberUnitMethodsCall');

module.exports = Sugar.Number.minuteAgo;
},{"../date/build/buildNumberUnitMethodsCall":215,"sugar-core":809}],520:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core');

require('../date/build/buildNumberUnitMethodsCall');

module.exports = Sugar.Number.minuteBefore;
},{"../date/build/buildNumberUnitMethodsCall":215,"sugar-core":809}],521:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core');

require('../date/build/buildNumberUnitMethodsCall');

module.exports = Sugar.Number.minuteFromNow;
},{"../date/build/buildNumberUnitMethodsCall":215,"sugar-core":809}],522:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core');

require('../date/build/buildNumberUnitMethodsCall');

module.exports = Sugar.Number.minutes;
},{"../date/build/buildNumberUnitMethodsCall":215,"sugar-core":809}],523:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core');

require('../date/build/buildNumberUnitMethodsCall');

module.exports = Sugar.Number.minutesAfter;
},{"../date/build/buildNumberUnitMethodsCall":215,"sugar-core":809}],524:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core');

require('../date/build/buildNumberUnitMethodsCall');

module.exports = Sugar.Number.minutesAgo;
},{"../date/build/buildNumberUnitMethodsCall":215,"sugar-core":809}],525:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core');

require('../date/build/buildNumberUnitMethodsCall');

module.exports = Sugar.Number.minutesBefore;
},{"../date/build/buildNumberUnitMethodsCall":215,"sugar-core":809}],526:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core');

require('../date/build/buildNumberUnitMethodsCall');

module.exports = Sugar.Number.minutesFromNow;
},{"../date/build/buildNumberUnitMethodsCall":215,"sugar-core":809}],527:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core');

require('../date/build/buildNumberUnitMethodsCall');

module.exports = Sugar.Number.month;
},{"../date/build/buildNumberUnitMethodsCall":215,"sugar-core":809}],528:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core');

require('../date/build/buildNumberUnitMethodsCall');

module.exports = Sugar.Number.monthAfter;
},{"../date/build/buildNumberUnitMethodsCall":215,"sugar-core":809}],529:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core');

require('../date/build/buildNumberUnitMethodsCall');

module.exports = Sugar.Number.monthAgo;
},{"../date/build/buildNumberUnitMethodsCall":215,"sugar-core":809}],530:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core');

require('../date/build/buildNumberUnitMethodsCall');

module.exports = Sugar.Number.monthBefore;
},{"../date/build/buildNumberUnitMethodsCall":215,"sugar-core":809}],531:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core');

require('../date/build/buildNumberUnitMethodsCall');

module.exports = Sugar.Number.monthFromNow;
},{"../date/build/buildNumberUnitMethodsCall":215,"sugar-core":809}],532:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core');

require('../date/build/buildNumberUnitMethodsCall');

module.exports = Sugar.Number.months;
},{"../date/build/buildNumberUnitMethodsCall":215,"sugar-core":809}],533:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core');

require('../date/build/buildNumberUnitMethodsCall');

module.exports = Sugar.Number.monthsAfter;
},{"../date/build/buildNumberUnitMethodsCall":215,"sugar-core":809}],534:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core');

require('../date/build/buildNumberUnitMethodsCall');

module.exports = Sugar.Number.monthsAgo;
},{"../date/build/buildNumberUnitMethodsCall":215,"sugar-core":809}],535:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core');

require('../date/build/buildNumberUnitMethodsCall');

module.exports = Sugar.Number.monthsBefore;
},{"../date/build/buildNumberUnitMethodsCall":215,"sugar-core":809}],536:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core');

require('../date/build/buildNumberUnitMethodsCall');

module.exports = Sugar.Number.monthsFromNow;
},{"../date/build/buildNumberUnitMethodsCall":215,"sugar-core":809}],537:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core'),
    mathAliases = require('../common/var/mathAliases'),
    getOrdinalSuffix = require('../common/internal/getOrdinalSuffix');

var abs = mathAliases.abs;

Sugar.Number.defineInstance({

  'ordinalize': function(n) {
    var num = abs(n), last = +num.toString().slice(-2);
    return n + getOrdinalSuffix(last);
  }

});

module.exports = Sugar.Number.ordinalize;
},{"../common/internal/getOrdinalSuffix":138,"../common/var/mathAliases":195,"sugar-core":809}],538:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core'),
    padNumber = require('../common/internal/padNumber');

Sugar.Number.defineInstance({

  'pad': function(n, place, sign, base) {
    return padNumber(n, place, sign, base);
  }

});

module.exports = Sugar.Number.pad;
},{"../common/internal/padNumber":162,"sugar-core":809}],539:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core');

require('./build/buildMathAliasesCall');

module.exports = Sugar.Number.pow;
},{"./build/buildMathAliasesCall":460,"sugar-core":809}],540:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core'),
    trunc = require('../common/var/trunc'),
    mathAliases = require('../common/var/mathAliases'),
    isUndefined = require('../common/internal/isUndefined');

var min = mathAliases.min,
    max = mathAliases.max;

Sugar.Number.defineStatic({

  'random': function(n1, n2) {
    var minNum, maxNum;
    if (arguments.length == 1) n2 = n1, n1 = 0;
    minNum = min(n1 || 0, isUndefined(n2) ? 1 : n2);
    maxNum = max(n1 || 0, isUndefined(n2) ? 1 : n2) + 1;
    return trunc((Math.random() * (maxNum - minNum)) + minNum);
  }

});

module.exports = Sugar.Number.random;
},{"../common/internal/isUndefined":155,"../common/var/mathAliases":195,"../common/var/trunc":198,"sugar-core":809}],541:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core'),
    PrimitiveRangeConstructor = require('../range/var/PrimitiveRangeConstructor');

Sugar.Number.defineStatic({

  'range': PrimitiveRangeConstructor

});

module.exports = Sugar.Number.range;
},{"../range/var/PrimitiveRangeConstructor":718,"sugar-core":809}],542:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core'),
    mathAliases = require('../common/var/mathAliases'),
    createRoundingFunction = require('./internal/createRoundingFunction');

var round = mathAliases.round;

Sugar.Number.defineInstance({

  'round': createRoundingFunction(round)

});

module.exports = Sugar.Number.round;
},{"../common/var/mathAliases":195,"./internal/createRoundingFunction":497,"sugar-core":809}],543:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core');

require('../date/build/buildNumberUnitMethodsCall');

module.exports = Sugar.Number.second;
},{"../date/build/buildNumberUnitMethodsCall":215,"sugar-core":809}],544:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core');

require('../date/build/buildNumberUnitMethodsCall');

module.exports = Sugar.Number.secondAfter;
},{"../date/build/buildNumberUnitMethodsCall":215,"sugar-core":809}],545:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core');

require('../date/build/buildNumberUnitMethodsCall');

module.exports = Sugar.Number.secondAgo;
},{"../date/build/buildNumberUnitMethodsCall":215,"sugar-core":809}],546:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core');

require('../date/build/buildNumberUnitMethodsCall');

module.exports = Sugar.Number.secondBefore;
},{"../date/build/buildNumberUnitMethodsCall":215,"sugar-core":809}],547:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core');

require('../date/build/buildNumberUnitMethodsCall');

module.exports = Sugar.Number.secondFromNow;
},{"../date/build/buildNumberUnitMethodsCall":215,"sugar-core":809}],548:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core');

require('../date/build/buildNumberUnitMethodsCall');

module.exports = Sugar.Number.seconds;
},{"../date/build/buildNumberUnitMethodsCall":215,"sugar-core":809}],549:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core');

require('../date/build/buildNumberUnitMethodsCall');

module.exports = Sugar.Number.secondsAfter;
},{"../date/build/buildNumberUnitMethodsCall":215,"sugar-core":809}],550:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core');

require('../date/build/buildNumberUnitMethodsCall');

module.exports = Sugar.Number.secondsAgo;
},{"../date/build/buildNumberUnitMethodsCall":215,"sugar-core":809}],551:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core');

require('../date/build/buildNumberUnitMethodsCall');

module.exports = Sugar.Number.secondsBefore;
},{"../date/build/buildNumberUnitMethodsCall":215,"sugar-core":809}],552:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core');

require('../date/build/buildNumberUnitMethodsCall');

module.exports = Sugar.Number.secondsFromNow;
},{"../date/build/buildNumberUnitMethodsCall":215,"sugar-core":809}],553:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core'),
    _numberOptions = require('./var/_numberOptions');

module.exports = Sugar.Number.setOption;
},{"./var/_numberOptions":562,"sugar-core":809}],554:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core');

require('./build/buildMathAliasesCall');

module.exports = Sugar.Number.sin;
},{"./build/buildMathAliasesCall":460,"sugar-core":809}],555:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core');

require('./build/buildMathAliasesCall');

module.exports = Sugar.Number.sqrt;
},{"./build/buildMathAliasesCall":460,"sugar-core":809}],556:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core');

require('./build/buildMathAliasesCall');

module.exports = Sugar.Number.tan;
},{"./build/buildMathAliasesCall":460,"sugar-core":809}],557:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core'),
    isDefined = require('../common/internal/isDefined');

Sugar.Number.defineInstance({

  'times': function(n, fn) {
    var arr, result;
    for(var i = 0; i < n; i++) {
      result = fn.call(n, i);
      if (isDefined(result)) {
        if (!arr) {
          arr = [];
        }
        arr.push(result);
      }
    }
    return arr;
  }

});

module.exports = Sugar.Number.times;
},{"../common/internal/isDefined":149,"sugar-core":809}],558:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core');

Sugar.Number.defineInstance({

  'toNumber': function(n) {
    return n.valueOf();
  }

});

module.exports = Sugar.Number.toNumber;
},{"sugar-core":809}],559:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core'),
    Range = require('../range/internal/Range'),
    rangeEvery = require('../range/internal/rangeEvery');

Sugar.Number.defineInstance({

  'upto': function(n, num, step, fn) {
    return rangeEvery(new Range(n, num), step, false, fn);
  }

});

module.exports = Sugar.Number.upto;
},{"../range/internal/Range":684,"../range/internal/rangeEvery":699,"sugar-core":809}],560:[function(require,module,exports){
'use strict';

module.exports = {
  BASIC_UNITS: '|kmbt',
  MEMORY_UNITS: '|KMGTPE',
  MEMORY_BINARY_UNITS: '|,Ki,Mi,Gi,Ti,Pi,Ei',
  METRIC_UNITS_SHORT: 'nμm|k',
  METRIC_UNITS_FULL: 'yzafpnμm|KMGTPEZY'
};
},{}],561:[function(require,module,exports){
'use strict';

var CommonChars = require('../../common/var/CommonChars');

var HALF_WIDTH_PERIOD = CommonChars.HALF_WIDTH_PERIOD,
    HALF_WIDTH_COMMA = CommonChars.HALF_WIDTH_COMMA;

var NUMBER_OPTIONS = {
  'decimal': HALF_WIDTH_PERIOD,
  'thousands': HALF_WIDTH_COMMA
};

module.exports = NUMBER_OPTIONS;
},{"../../common/var/CommonChars":180}],562:[function(require,module,exports){
'use strict';

var NUMBER_OPTIONS = require('./NUMBER_OPTIONS'),
    namespaceAliases = require('../../common/var/namespaceAliases'),
    defineOptionsAccessor = require('../../common/internal/defineOptionsAccessor');

var sugarNumber = namespaceAliases.sugarNumber;

module.exports = defineOptionsAccessor(sugarNumber, NUMBER_OPTIONS);
},{"../../common/internal/defineOptionsAccessor":124,"../../common/var/namespaceAliases":197,"./NUMBER_OPTIONS":561}],563:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core');

require('../date/build/buildNumberUnitMethodsCall');

module.exports = Sugar.Number.week;
},{"../date/build/buildNumberUnitMethodsCall":215,"sugar-core":809}],564:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core');

require('../date/build/buildNumberUnitMethodsCall');

module.exports = Sugar.Number.weekAfter;
},{"../date/build/buildNumberUnitMethodsCall":215,"sugar-core":809}],565:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core');

require('../date/build/buildNumberUnitMethodsCall');

module.exports = Sugar.Number.weekAgo;
},{"../date/build/buildNumberUnitMethodsCall":215,"sugar-core":809}],566:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core');

require('../date/build/buildNumberUnitMethodsCall');

module.exports = Sugar.Number.weekBefore;
},{"../date/build/buildNumberUnitMethodsCall":215,"sugar-core":809}],567:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core');

require('../date/build/buildNumberUnitMethodsCall');

module.exports = Sugar.Number.weekFromNow;
},{"../date/build/buildNumberUnitMethodsCall":215,"sugar-core":809}],568:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core');

require('../date/build/buildNumberUnitMethodsCall');

module.exports = Sugar.Number.weeks;
},{"../date/build/buildNumberUnitMethodsCall":215,"sugar-core":809}],569:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core');

require('../date/build/buildNumberUnitMethodsCall');

module.exports = Sugar.Number.weeksAfter;
},{"../date/build/buildNumberUnitMethodsCall":215,"sugar-core":809}],570:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core');

require('../date/build/buildNumberUnitMethodsCall');

module.exports = Sugar.Number.weeksAgo;
},{"../date/build/buildNumberUnitMethodsCall":215,"sugar-core":809}],571:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core');

require('../date/build/buildNumberUnitMethodsCall');

module.exports = Sugar.Number.weeksBefore;
},{"../date/build/buildNumberUnitMethodsCall":215,"sugar-core":809}],572:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core');

require('../date/build/buildNumberUnitMethodsCall');

module.exports = Sugar.Number.weeksFromNow;
},{"../date/build/buildNumberUnitMethodsCall":215,"sugar-core":809}],573:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core');

require('../date/build/buildNumberUnitMethodsCall');

module.exports = Sugar.Number.year;
},{"../date/build/buildNumberUnitMethodsCall":215,"sugar-core":809}],574:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core');

require('../date/build/buildNumberUnitMethodsCall');

module.exports = Sugar.Number.yearAfter;
},{"../date/build/buildNumberUnitMethodsCall":215,"sugar-core":809}],575:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core');

require('../date/build/buildNumberUnitMethodsCall');

module.exports = Sugar.Number.yearAgo;
},{"../date/build/buildNumberUnitMethodsCall":215,"sugar-core":809}],576:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core');

require('../date/build/buildNumberUnitMethodsCall');

module.exports = Sugar.Number.yearBefore;
},{"../date/build/buildNumberUnitMethodsCall":215,"sugar-core":809}],577:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core');

require('../date/build/buildNumberUnitMethodsCall');

module.exports = Sugar.Number.yearFromNow;
},{"../date/build/buildNumberUnitMethodsCall":215,"sugar-core":809}],578:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core');

require('../date/build/buildNumberUnitMethodsCall');

module.exports = Sugar.Number.years;
},{"../date/build/buildNumberUnitMethodsCall":215,"sugar-core":809}],579:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core');

require('../date/build/buildNumberUnitMethodsCall');

module.exports = Sugar.Number.yearsAfter;
},{"../date/build/buildNumberUnitMethodsCall":215,"sugar-core":809}],580:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core');

require('../date/build/buildNumberUnitMethodsCall');

module.exports = Sugar.Number.yearsAgo;
},{"../date/build/buildNumberUnitMethodsCall":215,"sugar-core":809}],581:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core');

require('../date/build/buildNumberUnitMethodsCall');

module.exports = Sugar.Number.yearsBefore;
},{"../date/build/buildNumberUnitMethodsCall":215,"sugar-core":809}],582:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core');

require('../date/build/buildNumberUnitMethodsCall');

module.exports = Sugar.Number.yearsFromNow;
},{"../date/build/buildNumberUnitMethodsCall":215,"sugar-core":809}],583:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core'),
    clone = require('./internal/clone'),
    mergeWithOptions = require('./internal/mergeWithOptions');

Sugar.Object.defineInstanceAndStatic({

  'add': function(obj1, obj2, opts) {
    return mergeWithOptions(clone(obj1), obj2, opts);
  }

});

module.exports = Sugar.Object.add;
},{"./internal/clone":600,"./internal/mergeWithOptions":615,"sugar-core":809}],584:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core'),
    clone = require('./internal/clone'),
    mergeAll = require('./internal/mergeAll');

Sugar.Object.defineInstanceAndStatic({

  'addAll': function(obj, sources, opts) {
    return mergeAll(clone(obj), sources, opts);
  }

});

module.exports = Sugar.Object.addAll;
},{"./internal/clone":600,"./internal/mergeAll":613,"sugar-core":809}],585:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core'),
    average = require('../enumerable/internal/average');

Sugar.Object.defineInstanceAndStatic({

  'average': function(obj, map) {
    return average(obj, map);
  }

});

module.exports = Sugar.Object.average;
},{"../enumerable/internal/average":408,"sugar-core":809}],586:[function(require,module,exports){
'use strict';

var buildClassCheckMethods = require('../internal/buildClassCheckMethods');

buildClassCheckMethods();
},{"../internal/buildClassCheckMethods":599}],587:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core'),
    clone = require('./internal/clone');

Sugar.Object.defineInstanceAndStatic({

  'clone': function(obj, deep) {
    return clone(obj, deep);
  }

});

module.exports = Sugar.Object.clone;
},{"./internal/clone":600,"sugar-core":809}],588:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core'),
    objectCount = require('../enumerable/internal/objectCount');

Sugar.Object.defineInstanceAndStatic({

  'count': function(obj, f) {
    return objectCount(obj, f);
  }

});

module.exports = Sugar.Object.count;
},{"../enumerable/internal/objectCount":419,"sugar-core":809}],589:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core'),
    defaults = require('./internal/defaults');

Sugar.Object.defineInstanceAndStatic({

  'defaults': function(target, sources, opts) {
    return defaults(target, sources, opts);
  }

});

module.exports = Sugar.Object.defaults;
},{"./internal/defaults":601,"sugar-core":809}],590:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core'),
    objectMatchers = require('../enumerable/var/objectMatchers');

var objectEvery = objectMatchers.objectEvery;

Sugar.Object.defineInstanceAndStatic({

  'every': objectEvery

});

module.exports = Sugar.Object.every;
},{"../enumerable/var/objectMatchers":431,"sugar-core":809}],591:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core'),
    objectExclude = require('./internal/objectExclude');

Sugar.Object.defineInstanceAndStatic({

  'exclude': function(obj, f) {
    return objectExclude(obj, f);
  }

});

module.exports = Sugar.Object.exclude;
},{"./internal/objectExclude":616,"sugar-core":809}],592:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core'),
    objectFilter = require('../enumerable/internal/objectFilter');

Sugar.Object.defineInstanceAndStatic({

  'filter': function(obj, f) {
    return objectFilter(obj, f);
  }

});

module.exports = Sugar.Object.filter;
},{"../enumerable/internal/objectFilter":420,"sugar-core":809}],593:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core'),
    objectMatchers = require('../enumerable/var/objectMatchers');

var objectFind = objectMatchers.objectFind;

Sugar.Object.defineInstanceAndStatic({

  'find': objectFind

});

module.exports = Sugar.Object.find;
},{"../enumerable/var/objectMatchers":431,"sugar-core":809}],594:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core'),
    objectForEach = require('../enumerable/internal/objectForEach');

Sugar.Object.defineInstanceAndStatic({

  'forEach': function(obj, fn) {
    return objectForEach(obj, fn);
  }

});

module.exports = Sugar.Object.forEach;
},{"../enumerable/internal/objectForEach":421,"sugar-core":809}],595:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core'),
    fromQueryStringWithOptions = require('./internal/fromQueryStringWithOptions');

Sugar.Object.defineStatic({

  'fromQueryString': function(obj, options) {
    return fromQueryStringWithOptions(obj, options);
  }

});

module.exports = Sugar.Object.fromQueryString;
},{"./internal/fromQueryStringWithOptions":602,"sugar-core":809}],596:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core'),
    deepGetProperty = require('../common/internal/deepGetProperty');

Sugar.Object.defineInstanceAndStatic({

  'get': function(obj, key, any) {
    return deepGetProperty(obj, key, any);
  }

});

module.exports = Sugar.Object.get;
},{"../common/internal/deepGetProperty":116,"sugar-core":809}],597:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core'),
    deepHasProperty = require('../common/internal/deepHasProperty');

Sugar.Object.defineInstanceAndStatic({

  'has': function(obj, key, any) {
    return deepHasProperty(obj, key, any);
  }

});

module.exports = Sugar.Object.has;
},{"../common/internal/deepHasProperty":117,"sugar-core":809}],598:[function(require,module,exports){
'use strict';

// Static Methods
require('./add');
require('./addAll');
require('./clone');
require('./defaults');
require('./exclude');
require('./fromQueryString');
require('./get');
require('./has');
require('./intersect');
require('./invert');
require('./isArguments');
require('./isArray');
require('./isBoolean');
require('./isDate');
require('./isEmpty');
require('./isEqual');
require('./isError');
require('./isFunction');
require('./isMap');
require('./isNumber');
require('./isObject');
require('./isRegExp');
require('./isSet');
require('./isString');
require('./merge');
require('./mergeAll');
require('./reject');
require('./remove');
require('./select');
require('./set');
require('./size');
require('./subtract');
require('./tap');
require('./toQueryString');
require('./values');

// Instance Methods
require('./keys');

module.exports = require('sugar-core');
},{"./add":583,"./addAll":584,"./clone":587,"./defaults":589,"./exclude":591,"./fromQueryString":595,"./get":596,"./has":597,"./intersect":632,"./invert":633,"./isArguments":634,"./isArray":635,"./isBoolean":636,"./isDate":637,"./isEmpty":638,"./isEqual":639,"./isError":640,"./isFunction":641,"./isMap":642,"./isNumber":643,"./isObject":644,"./isRegExp":645,"./isSet":646,"./isString":647,"./keys":648,"./merge":653,"./mergeAll":654,"./reject":659,"./remove":660,"./select":661,"./set":662,"./size":663,"./subtract":665,"./tap":667,"./toQueryString":668,"./values":669,"sugar-core":809}],599:[function(require,module,exports){
'use strict';

var NATIVE_TYPES = require('../../common/var/NATIVE_TYPES'),
    classChecks = require('../../common/var/classChecks'),
    namespaceAliases = require('../../common/var/namespaceAliases'),
    defineInstanceAndStaticSimilar = require('../../common/internal/defineInstanceAndStaticSimilar');

var isBoolean = classChecks.isBoolean,
    isNumber = classChecks.isNumber,
    isString = classChecks.isString,
    isDate = classChecks.isDate,
    isRegExp = classChecks.isRegExp,
    isFunction = classChecks.isFunction,
    isArray = classChecks.isArray,
    isSet = classChecks.isSet,
    isMap = classChecks.isMap,
    isError = classChecks.isError,
    sugarObject = namespaceAliases.sugarObject;

function buildClassCheckMethods() {
  var checks = [isBoolean, isNumber, isString, isDate, isRegExp, isFunction, isArray, isError, isSet, isMap];
  defineInstanceAndStaticSimilar(sugarObject, NATIVE_TYPES, function(methods, name, i) {
    methods['is' + name] = checks[i];
  });
}

module.exports = buildClassCheckMethods;
},{"../../common/internal/defineInstanceAndStaticSimilar":121,"../../common/var/NATIVE_TYPES":184,"../../common/var/classChecks":192,"../../common/var/namespaceAliases":197}],600:[function(require,module,exports){
'use strict';

var objectMerge = require('./objectMerge'),
    getNewObjectForMerge = require('./getNewObjectForMerge');

function clone(source, deep) {
  var target = getNewObjectForMerge(source);
  return objectMerge(target, source, deep, true, true, true);
}

module.exports = clone;
},{"./getNewObjectForMerge":604,"./objectMerge":618}],601:[function(require,module,exports){
'use strict';

var mergeAll = require('./mergeAll');

function defaults(target, sources, opts) {
  opts = opts || {};
  opts.resolve = opts.resolve || false;
  return mergeAll(target, sources, opts);
}

module.exports = defaults;
},{"./mergeAll":613}],602:[function(require,module,exports){
'use strict';

var forEach = require('../../common/internal/forEach'),
    parseQueryComponent = require('./parseQueryComponent');

function fromQueryStringWithOptions(obj, opts) {
  var str = String(obj || '').replace(/^.*?\?/, ''), result = {}, auto;
  opts = opts || {};
  if (str) {
    forEach(str.split('&'), function(p) {
      var split = p.split('=');
      var key = decodeURIComponent(split[0]);
      var val = split.length === 2 ? decodeURIComponent(split[1]) : '';
      auto = opts.auto !== false;
      parseQueryComponent(result, key, val, opts.deep, auto, opts.separator, opts.transform);
    });
  }
  return result;
}

module.exports = fromQueryStringWithOptions;
},{"../../common/internal/forEach":129,"./parseQueryComponent":624}],603:[function(require,module,exports){
'use strict';

var getKeys = require('../../common/internal/getKeys'),
    coercePrimitiveToObject = require('../../common/internal/coercePrimitiveToObject');

function getKeysWithObjectCoercion(obj) {
  return getKeys(coercePrimitiveToObject(obj));
}

module.exports = getKeysWithObjectCoercion;
},{"../../common/internal/coercePrimitiveToObject":111,"../../common/internal/getKeys":135}],604:[function(require,module,exports){
'use strict';

var classChecks = require('../../common/var/classChecks'),
    isPrimitive = require('../../common/internal/isPrimitive'),
    isPlainObject = require('../../common/internal/isPlainObject'),
    getRegExpFlags = require('../../common/internal/getRegExpFlags'),
    coreUtilityAliases = require('../../common/var/coreUtilityAliases');

var classToString = coreUtilityAliases.classToString,
    isDate = classChecks.isDate,
    isRegExp = classChecks.isRegExp,
    isArray = classChecks.isArray;

function getNewObjectForMerge(source) {
  var klass = classToString(source);
  // Primitive types, dates, and regexes have no "empty" state. If they exist
  // at all, then they have an associated value. As we are only creating new
  // objects when they don't exist in the target, these values can come alone
  // for the ride when created.
  if (isArray(source, klass)) {
    return [];
  } else if (isPlainObject(source, klass)) {
    return {};
  } else if (isDate(source, klass)) {
    return new Date(source.getTime());
  } else if (isRegExp(source, klass)) {
    return RegExp(source.source, getRegExpFlags(source));
  } else if (isPrimitive(source && source.valueOf())) {
    return source;
  }
  // If the object is not of a known type, then simply merging its
  // properties into a plain object will result in something different
  // (it will not respond to instanceof operator etc). Similarly we don't
  // want to call a constructor here as we can't know for sure what the
  // original constructor was called with (Events etc), so throw an
  // error here instead. Non-standard types can be handled if either they
  // already exist and simply have their properties merged, if the merge
  // is not deep so their references will simply be copied over, or if a
  // resolve function is used to assist the merge.
  throw new TypeError('Must be a basic data type');
}

module.exports = getNewObjectForMerge;
},{"../../common/internal/getRegExpFlags":140,"../../common/internal/isPlainObject":152,"../../common/internal/isPrimitive":153,"../../common/var/classChecks":192,"../../common/var/coreUtilityAliases":193}],605:[function(require,module,exports){
'use strict';

var classChecks = require('../../common/var/classChecks'),
    stringIsDecimal = require('./stringIsDecimal'),
    coreUtilityAliases = require('../../common/var/coreUtilityAliases');

var getOwn = coreUtilityAliases.getOwn,
    isArray = classChecks.isArray;

function getQueryValueAuto(obj, key, val) {
  if (!val) {
    return null;
  } else if (val === 'true') {
    return true;
  } else if (val === 'false') {
    return false;
  }
  var num = +val;
  if (!isNaN(num) && stringIsDecimal(val)) {
    return num;
  }
  var existing = getOwn(obj, key);
  if (val && existing) {
    return isArray(existing) ? existing.concat(val) : [existing, val];
  }
  return val;
}

module.exports = getQueryValueAuto;
},{"../../common/var/classChecks":192,"../../common/var/coreUtilityAliases":193,"./stringIsDecimal":628}],606:[function(require,module,exports){
'use strict';

var classChecks = require('../../common/var/classChecks'),
    sanitizeURIComponent = require('./sanitizeURIComponent');

var isDate = classChecks.isDate;

function getURIComponentValue(obj, prefix, transform) {
  var value;
  if (transform) {
    value = transform(obj, prefix);
  } else if (isDate(obj)) {
    value = obj.getTime();
  } else {
    value = obj;
  }
  return sanitizeURIComponent(prefix) + '=' + sanitizeURIComponent(value);
}

module.exports = getURIComponentValue;
},{"../../common/var/classChecks":192,"./sanitizeURIComponent":625}],607:[function(require,module,exports){
'use strict';

var coreUtilityAliases = require('../../common/var/coreUtilityAliases');

var forEachProperty = coreUtilityAliases.forEachProperty;

function getValues(obj) {
  var values = [];
  forEachProperty(obj, function(val) {
    values.push(val);
  });
  return values;
}

module.exports = getValues;
},{"../../common/var/coreUtilityAliases":193}],608:[function(require,module,exports){
'use strict';

var hasProperty = require('../../common/internal/hasProperty'),
    coreUtilityAliases = require('../../common/var/coreUtilityAliases');

var classToString = coreUtilityAliases.classToString;

function isArguments(obj, className) {
  className = className || classToString(obj);
  // .callee exists on Arguments objects in < IE8
  return hasProperty(obj, 'length') && (className === '[object Arguments]' || !!obj.callee);
}

module.exports = isArguments;
},{"../../common/internal/hasProperty":144,"../../common/var/coreUtilityAliases":193}],609:[function(require,module,exports){
'use strict';

var getOwnPropertyDescriptor = require('../var/getOwnPropertyDescriptor');

function iterateOverKeys(getFn, obj, fn, hidden) {
  var keys = getFn(obj), desc;
  for (var i = 0, key; key = keys[i]; i++) {
    desc = getOwnPropertyDescriptor(obj, key);
    if (desc.enumerable || hidden) {
      fn(obj[key], key);
    }
  }
}

module.exports = iterateOverKeys;
},{"../var/getOwnPropertyDescriptor":672}],610:[function(require,module,exports){
'use strict';

var iterateOverKeys = require('./iterateOverKeys'),
    coreUtilityAliases = require('../../common/var/coreUtilityAliases'),
    getOwnPropertyNames = require('../var/getOwnPropertyNames'),
    getOwnPropertySymbols = require('../var/getOwnPropertySymbols');

var forEachProperty = coreUtilityAliases.forEachProperty;

function iterateOverProperties(hidden, obj, fn) {
  if (getOwnPropertyNames && hidden) {
    iterateOverKeys(getOwnPropertyNames, obj, fn, hidden);
  } else {
    forEachProperty(obj, fn);
  }
  if (getOwnPropertySymbols) {
    iterateOverKeys(getOwnPropertySymbols, obj, fn, hidden);
  }
}

module.exports = iterateOverProperties;
},{"../../common/var/coreUtilityAliases":193,"../var/getOwnPropertyNames":673,"../var/getOwnPropertySymbols":674,"./iterateOverKeys":609}],611:[function(require,module,exports){
'use strict';

function mapQuerySeparatorToKeys(key, separator) {
  var split = key.split(separator), result = split[0];
  for (var i = 1, len = split.length; i < len; i++) {
    result += '[' + split[i] + ']';
  }
  return result;
}

module.exports = mapQuerySeparatorToKeys;
},{}],612:[function(require,module,exports){
'use strict';

var classChecks = require('../../common/var/classChecks'),
    isObjectType = require('../../common/internal/isObjectType');

var isRegExp = classChecks.isRegExp;

function matchInObject(match, key) {
  if (isRegExp(match)) {
    return match.test(key);
  } else if (isObjectType(match)) {
    return key in match;
  } else {
    return key === String(match);
  }
}

module.exports = matchInObject;
},{"../../common/internal/isObjectType":151,"../../common/var/classChecks":192}],613:[function(require,module,exports){
'use strict';

var forEach = require('../../common/internal/forEach'),
    classChecks = require('../../common/var/classChecks'),
    mergeWithOptions = require('./mergeWithOptions');

var isArray = classChecks.isArray;

function mergeAll(target, sources, opts) {
  if (!isArray(sources)) {
    sources = [sources];
  }
  forEach(sources, function(source) {
    return mergeWithOptions(target, source, opts);
  });
  return target;
}

module.exports = mergeAll;
},{"../../common/internal/forEach":129,"../../common/var/classChecks":192,"./mergeWithOptions":615}],614:[function(require,module,exports){
'use strict';

var isDefined = require('../../common/internal/isDefined'),
    coreUtilityAliases = require('../../common/var/coreUtilityAliases'),
    getOwnPropertyDescriptor = require('../var/getOwnPropertyDescriptor');

var defineProperty = coreUtilityAliases.defineProperty;

function mergeByPropertyDescriptor(target, source, prop, sourceVal) {
  var descriptor = getOwnPropertyDescriptor(source, prop);
  if (isDefined(descriptor.value)) {
    descriptor.value = sourceVal;
  }
  defineProperty(target, prop, descriptor);
}

module.exports = mergeByPropertyDescriptor;
},{"../../common/internal/isDefined":149,"../../common/var/coreUtilityAliases":193,"../var/getOwnPropertyDescriptor":672}],615:[function(require,module,exports){
'use strict';

var objectMerge = require('./objectMerge');

function mergeWithOptions(target, source, opts) {
  opts = opts || {};
  return objectMerge(target, source, opts.deep, opts.resolve, opts.hidden, opts.descriptor);
}

module.exports = mergeWithOptions;
},{"./objectMerge":618}],616:[function(require,module,exports){
'use strict';

var getMatcher = require('../../common/internal/getMatcher'),
    coreUtilityAliases = require('../../common/var/coreUtilityAliases');

var forEachProperty = coreUtilityAliases.forEachProperty;

function objectExclude(obj, f) {
  var result = {};
  var matcher = getMatcher(f);
  forEachProperty(obj, function(val, key) {
    if (!matcher(val, key, obj)) {
      result[key] = val;
    }
  });
  return result;
}

module.exports = objectExclude;
},{"../../common/internal/getMatcher":136,"../../common/var/coreUtilityAliases":193}],617:[function(require,module,exports){
'use strict';

var isEqual = require('../../common/internal/isEqual'),
    objectMerge = require('./objectMerge'),
    isObjectType = require('../../common/internal/isObjectType'),
    coercePrimitiveToObject = require('../../common/internal/coercePrimitiveToObject');

function objectIntersectOrSubtract(obj1, obj2, subtract) {
  if (!isObjectType(obj1)) {
    return subtract ? obj1 : {};
  }
  obj2 = coercePrimitiveToObject(obj2);
  function resolve(key, val, val1) {
    var exists = key in obj2 && isEqual(val1, obj2[key]);
    if (exists !== subtract) {
      return val1;
    }
  }
  return objectMerge({}, obj1, false, resolve);
}

module.exports = objectIntersectOrSubtract;
},{"../../common/internal/coercePrimitiveToObject":111,"../../common/internal/isEqual":150,"../../common/internal/isObjectType":151,"./objectMerge":618}],618:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core'),
    isDefined = require('../../common/internal/isDefined'),
    classChecks = require('../../common/var/classChecks'),
    isPrimitive = require('../../common/internal/isPrimitive'),
    isUndefined = require('../../common/internal/isUndefined'),
    isObjectType = require('../../common/internal/isObjectType'),
    coreUtilityAliases = require('../../common/var/coreUtilityAliases'),
    getOwnPropertyNames = require('../var/getOwnPropertyNames'),
    getNewObjectForMerge = require('./getNewObjectForMerge'),
    iterateOverProperties = require('./iterateOverProperties'),
    coercePrimitiveToObject = require('../../common/internal/coercePrimitiveToObject'),
    mergeByPropertyDescriptor = require('./mergeByPropertyDescriptor');

var isDate = classChecks.isDate,
    isRegExp = classChecks.isRegExp,
    isFunction = classChecks.isFunction,
    getOwn = coreUtilityAliases.getOwn;

function objectMerge(target, source, deep, resolve, hidden, descriptor) {
  var resolveByFunction = isFunction(resolve), resolveConflicts = resolve !== false;

  if (isUndefined(target)) {
    target = getNewObjectForMerge(source);
  } else if (resolveConflicts && isDate(target) && isDate(source)) {
    // A date's timestamp is a property that can only be reached through its
    // methods, so actively set it up front if both are dates.
    target.setTime(source.getTime());
  }

  if (isPrimitive(target)) {
    // Will not merge into a primitive type, so simply override.
    return source;
  }

  // If the source object is a primitive
  // type then coerce it into an object.
  if (isPrimitive(source)) {
    source = coercePrimitiveToObject(source);
  }

  iterateOverProperties(hidden, source, function(val, key) {
    var sourceVal, targetVal, resolved, goDeep, result;

    sourceVal = source[key];

    // We are iterating over properties of the source, so hasOwnProperty on
    // it is guaranteed to always be true. However, the target may happen to
    // have properties in its prototype chain that should not be considered
    // as conflicts.
    targetVal = getOwn(target, key);

    if (resolveByFunction) {
      result = resolve(key, targetVal, sourceVal, target, source);
      if (isUndefined(result)) {
        // Result is undefined so do not merge this property.
        return;
      } else if (isDefined(result) && result !== Sugar) {
        // If the source returns anything except undefined, then the conflict
        // has been resolved, so don't continue traversing into the object. If
        // the returned value is the Sugar global object, then allowing Sugar
        // to resolve the conflict, so continue on.
        sourceVal = result;
        resolved = true;
      }
    } else if (isUndefined(sourceVal)) {
      // Will not merge undefined.
      return;
    }

    // Regex properties are read-only, so intentionally disallowing deep
    // merging for now. Instead merge by reference even if deep.
    goDeep = !resolved && deep && isObjectType(sourceVal) && !isRegExp(sourceVal);

    if (!goDeep && !resolveConflicts && isDefined(targetVal)) {
      return;
    }

    if (goDeep) {
      sourceVal = objectMerge(targetVal, sourceVal, deep, resolve, hidden, descriptor);
    }

    // getOwnPropertyNames is standing in as
    // a test for property descriptor support
    if (getOwnPropertyNames && descriptor) {
      mergeByPropertyDescriptor(target, source, key, sourceVal);
    } else {
      target[key] = sourceVal;
    }

  });
  return target;
}

module.exports = objectMerge;
},{"../../common/internal/coercePrimitiveToObject":111,"../../common/internal/isDefined":149,"../../common/internal/isObjectType":151,"../../common/internal/isPrimitive":153,"../../common/internal/isUndefined":155,"../../common/var/classChecks":192,"../../common/var/coreUtilityAliases":193,"../var/getOwnPropertyNames":673,"./getNewObjectForMerge":604,"./iterateOverProperties":610,"./mergeByPropertyDescriptor":614,"sugar-core":809}],619:[function(require,module,exports){
'use strict';

var selectFromObject = require('./selectFromObject');

function objectReject(obj, f) {
  return selectFromObject(obj, f, false);
}

module.exports = objectReject;
},{"./selectFromObject":626}],620:[function(require,module,exports){
'use strict';

var getMatcher = require('../../common/internal/getMatcher'),
    coreUtilityAliases = require('../../common/var/coreUtilityAliases');

var forEachProperty = coreUtilityAliases.forEachProperty;

function objectRemove(obj, f) {
  var matcher = getMatcher(f);
  forEachProperty(obj, function(val, key) {
    if (matcher(val, key, obj)) {
      delete obj[key];
    }
  });
  return obj;
}

module.exports = objectRemove;
},{"../../common/internal/getMatcher":136,"../../common/var/coreUtilityAliases":193}],621:[function(require,module,exports){
'use strict';

var selectFromObject = require('./selectFromObject');

function objectSelect(obj, f) {
  return selectFromObject(obj, f, true);
}

module.exports = objectSelect;
},{"./selectFromObject":626}],622:[function(require,module,exports){
'use strict';

var getKeysWithObjectCoercion = require('./getKeysWithObjectCoercion');

function objectSize(obj) {
  return getKeysWithObjectCoercion(obj).length;
}

module.exports = objectSize;
},{"./getKeysWithObjectCoercion":603}],623:[function(require,module,exports){
'use strict';

var forEach = require('../../common/internal/forEach'),
    setQueryProperty = require('./setQueryProperty'),
    coreUtilityAliases = require('../../common/var/coreUtilityAliases');

var hasOwn = coreUtilityAliases.hasOwn,
    getOwn = coreUtilityAliases.getOwn;

function parseDeepQueryComponent(obj, match, val, deep, auto, separator, transform) {
  var key = match[1];
  var inner = match[2].slice(1, -1).split('][');
  forEach(inner, function(k) {
    if (!hasOwn(obj, key)) {
      obj[key] = k ? {} : [];
    }
    obj = getOwn(obj, key);
    key = k ? k : obj.length.toString();
  });
  setQueryProperty(obj, key, val, auto, transform);
}

module.exports = parseDeepQueryComponent;
},{"../../common/internal/forEach":129,"../../common/var/coreUtilityAliases":193,"./setQueryProperty":627}],624:[function(require,module,exports){
'use strict';

var DEEP_QUERY_STRING_REG = require('../var/DEEP_QUERY_STRING_REG'),
    setQueryProperty = require('./setQueryProperty'),
    mapQuerySeparatorToKeys = require('./mapQuerySeparatorToKeys'),
    parseDeepQueryComponent = require('./parseDeepQueryComponent');

function parseQueryComponent(obj, key, val, deep, auto, separator, transform) {
  var match;
  if (separator) {
    key = mapQuerySeparatorToKeys(key, separator);
    deep = true;
  }
  if (deep === true && (match = key.match(DEEP_QUERY_STRING_REG))) {
    parseDeepQueryComponent(obj, match, val, deep, auto, separator, transform);
  } else {
    setQueryProperty(obj, key, val, auto, transform);
  }
}

module.exports = parseQueryComponent;
},{"../var/DEEP_QUERY_STRING_REG":670,"./mapQuerySeparatorToKeys":611,"./parseDeepQueryComponent":623,"./setQueryProperty":627}],625:[function(require,module,exports){
'use strict';

function sanitizeURIComponent(obj) {
  // undefined, null, and NaN are represented as a blank string,
  // while false and 0 are stringified.
  return !obj && obj !== false && obj !== 0 ? '' : encodeURIComponent(obj);
}

module.exports = sanitizeURIComponent;
},{}],626:[function(require,module,exports){
'use strict';

var matchInObject = require('./matchInObject'),
    coreUtilityAliases = require('../../common/var/coreUtilityAliases');

var forEachProperty = coreUtilityAliases.forEachProperty;

function selectFromObject(obj, f, select) {
  var match, result = {};
  f = [].concat(f);
  forEachProperty(obj, function(val, key) {
    match = false;
    for (var i = 0; i < f.length; i++) {
      if (matchInObject(f[i], key)) {
        match = true;
      }
    }
    if (match === select) {
      result[key] = val;
    }
  });
  return result;
}

module.exports = selectFromObject;
},{"../../common/var/coreUtilityAliases":193,"./matchInObject":612}],627:[function(require,module,exports){
'use strict';

var isDefined = require('../../common/internal/isDefined'),
    getQueryValueAuto = require('./getQueryValueAuto');

function setQueryProperty(obj, key, val, auto, transform) {
  var fnValue;
  if (transform) {
    fnValue = transform(val, key, obj);
  }
  if (isDefined(fnValue)) {
    val = fnValue;
  } else if (auto) {
    val = getQueryValueAuto(obj, key, val);
  }
  obj[key] = val;
}

module.exports = setQueryProperty;
},{"../../common/internal/isDefined":149,"./getQueryValueAuto":605}],628:[function(require,module,exports){
'use strict';

var NON_DECIMAL_REG = require('../var/NON_DECIMAL_REG');

function stringIsDecimal(str) {
  return str !== '' && !NON_DECIMAL_REG.test(str);
}

module.exports = stringIsDecimal;
},{"../var/NON_DECIMAL_REG":671}],629:[function(require,module,exports){
'use strict';

var classChecks = require('../../common/var/classChecks');

var isFunction = classChecks.isFunction;

function tap(obj, arg) {
  var fn = arg;
  if (!isFunction(arg)) {
    fn = function() {
      if (arg) obj[arg]();
    };
  }
  fn.call(obj, obj);
  return obj;
}

module.exports = tap;
},{"../../common/var/classChecks":192}],630:[function(require,module,exports){
'use strict';

var classChecks = require('../../common/var/classChecks'),
    isObjectType = require('../../common/internal/isObjectType'),
    internalToString = require('../var/internalToString'),
    coreUtilityAliases = require('../../common/var/coreUtilityAliases'),
    getURIComponentValue = require('./getURIComponentValue'),
    sanitizeURIComponent = require('./sanitizeURIComponent');

var isArray = classChecks.isArray,
    forEachProperty = coreUtilityAliases.forEachProperty;

function toQueryString(obj, deep, transform, prefix, separator) {
  if (isArray(obj)) {
    return collectArrayAsQueryString(obj, deep, transform, prefix, separator);
  } else if (isObjectType(obj) && obj.toString === internalToString) {
    return collectObjectAsQueryString(obj, deep, transform, prefix, separator);
  } else if (prefix) {
    return getURIComponentValue(obj, prefix, transform);
  }
  return '';
}

function collectArrayAsQueryString(arr, deep, transform, prefix, separator) {
  var el, qc, key, result = [];
  // Intentionally treating sparse arrays as dense here by avoiding map,
  // otherwise indexes will shift during the process of serialization.
  for (var i = 0, len = arr.length; i < len; i++) {
    el = arr[i];
    key = prefix + (prefix && deep ? '[]' : '');
    if (!key && !isObjectType(el)) {
      // If there is no key, then the values of the array should be
      // considered as null keys, so use them instead;
      qc = sanitizeURIComponent(el);
    } else {
      qc = toQueryString(el, deep, transform, key, separator);
    }
    result.push(qc);
  }
  return result.join('&');
}

function collectObjectAsQueryString(obj, deep, transform, prefix, separator) {
  var result = [];
  forEachProperty(obj, function(val, key) {
    var fullKey;
    if (prefix && deep) {
      fullKey = prefix + '[' + key + ']';
    } else if (prefix) {
      fullKey = prefix + separator + key;
    } else {
      fullKey = key;
    }
    result.push(toQueryString(val, deep, transform, fullKey, separator));
  });
  return result.join('&');
}

module.exports = toQueryString;
},{"../../common/internal/isObjectType":151,"../../common/var/classChecks":192,"../../common/var/coreUtilityAliases":193,"../var/internalToString":675,"./getURIComponentValue":606,"./sanitizeURIComponent":625}],631:[function(require,module,exports){
'use strict';

var isUndefined = require('../../common/internal/isUndefined'),
    toQueryString = require('./toQueryString');

function toQueryStringWithOptions(obj, opts) {
  opts = opts || {};
  if (isUndefined(opts.separator)) {
    opts.separator = '_';
  }
  return toQueryString(obj, opts.deep, opts.transform, opts.prefix || '', opts.separator);
}

module.exports = toQueryStringWithOptions;
},{"../../common/internal/isUndefined":155,"./toQueryString":630}],632:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core'),
    objectIntersectOrSubtract = require('./internal/objectIntersectOrSubtract');

Sugar.Object.defineInstanceAndStatic({

  'intersect': function(obj1, obj2) {
    return objectIntersectOrSubtract(obj1, obj2, false);
  }

});

module.exports = Sugar.Object.intersect;
},{"./internal/objectIntersectOrSubtract":617,"sugar-core":809}],633:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core'),
    coreUtilityAliases = require('../common/var/coreUtilityAliases');

var hasOwn = coreUtilityAliases.hasOwn,
    forEachProperty = coreUtilityAliases.forEachProperty;

Sugar.Object.defineInstanceAndStatic({

  'invert': function(obj, multi) {
    var result = {};
    multi = multi === true;
    forEachProperty(obj, function(val, key) {
      if (hasOwn(result, val) && multi) {
        result[val].push(key);
      } else if (multi) {
        result[val] = [key];
      } else {
        result[val] = key;
      }
    });
    return result;
  }

});

module.exports = Sugar.Object.invert;
},{"../common/var/coreUtilityAliases":193,"sugar-core":809}],634:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core'),
    isArguments = require('./internal/isArguments');

Sugar.Object.defineInstanceAndStatic({

  'isArguments': function(obj) {
    return isArguments(obj);
  }

});

module.exports = Sugar.Object.isArguments;
},{"./internal/isArguments":608,"sugar-core":809}],635:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core');

require('./build/buildClassCheckMethodsCall');

module.exports = Sugar.Object.isArray;
},{"./build/buildClassCheckMethodsCall":586,"sugar-core":809}],636:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core');

require('./build/buildClassCheckMethodsCall');

module.exports = Sugar.Object.isBoolean;
},{"./build/buildClassCheckMethodsCall":586,"sugar-core":809}],637:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core');

require('./build/buildClassCheckMethodsCall');

module.exports = Sugar.Object.isDate;
},{"./build/buildClassCheckMethodsCall":586,"sugar-core":809}],638:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core'),
    objectSize = require('./internal/objectSize');

Sugar.Object.defineInstanceAndStatic({

  'isEmpty': function(obj) {
    return objectSize(obj) === 0;
  }

});

module.exports = Sugar.Object.isEmpty;
},{"./internal/objectSize":622,"sugar-core":809}],639:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core'),
    isEqual = require('../common/internal/isEqual');

Sugar.Object.defineInstanceAndStatic({

  'isEqual': function(obj1, obj2) {
    return isEqual(obj1, obj2);
  }

});

module.exports = Sugar.Object.isEqual;
},{"../common/internal/isEqual":150,"sugar-core":809}],640:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core');

require('./build/buildClassCheckMethodsCall');

module.exports = Sugar.Object.isError;
},{"./build/buildClassCheckMethodsCall":586,"sugar-core":809}],641:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core');

require('./build/buildClassCheckMethodsCall');

module.exports = Sugar.Object.isFunction;
},{"./build/buildClassCheckMethodsCall":586,"sugar-core":809}],642:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core');

require('./build/buildClassCheckMethodsCall');

module.exports = Sugar.Object.isMap;
},{"./build/buildClassCheckMethodsCall":586,"sugar-core":809}],643:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core');

require('./build/buildClassCheckMethodsCall');

module.exports = Sugar.Object.isNumber;
},{"./build/buildClassCheckMethodsCall":586,"sugar-core":809}],644:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core'),
    isPlainObject = require('../common/internal/isPlainObject');

Sugar.Object.defineInstanceAndStatic({

  'isObject': function(obj) {
    return isPlainObject(obj);
  }

});

module.exports = Sugar.Object.isObject;
},{"../common/internal/isPlainObject":152,"sugar-core":809}],645:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core');

require('./build/buildClassCheckMethodsCall');

module.exports = Sugar.Object.isRegExp;
},{"./build/buildClassCheckMethodsCall":586,"sugar-core":809}],646:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core');

require('./build/buildClassCheckMethodsCall');

module.exports = Sugar.Object.isSet;
},{"./build/buildClassCheckMethodsCall":586,"sugar-core":809}],647:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core');

require('./build/buildClassCheckMethodsCall');

module.exports = Sugar.Object.isString;
},{"./build/buildClassCheckMethodsCall":586,"sugar-core":809}],648:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core'),
    getKeys = require('../common/internal/getKeys');

Sugar.Object.defineInstance({

  'keys': function(obj) {
    return getKeys(obj);
  }

});

module.exports = Sugar.Object.keys;
},{"../common/internal/getKeys":135,"sugar-core":809}],649:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core'),
    getLeastOrMost = require('../enumerable/internal/getLeastOrMost');

Sugar.Object.defineInstanceAndStatic({

  'least': function(obj, all, map) {
    return getLeastOrMost(obj, all, map, false, true);
  }

});

module.exports = Sugar.Object.least;
},{"../enumerable/internal/getLeastOrMost":415,"sugar-core":809}],650:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core'),
    objectMap = require('../enumerable/internal/objectMap');

Sugar.Object.defineInstanceAndStatic({

  'map': function(obj, map) {
    return objectMap(obj, map);
  }

});

module.exports = Sugar.Object.map;
},{"../enumerable/internal/objectMap":422,"sugar-core":809}],651:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core'),
    getMinOrMax = require('../enumerable/internal/getMinOrMax');

Sugar.Object.defineInstanceAndStatic({

  'max': function(obj, all, map) {
    return getMinOrMax(obj, all, map, true, true);
  }

});

module.exports = Sugar.Object.max;
},{"../enumerable/internal/getMinOrMax":416,"sugar-core":809}],652:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core'),
    median = require('../enumerable/internal/median');

Sugar.Object.defineInstanceAndStatic({

  'median': function(obj, map) {
    return median(obj, map);
  }

});

module.exports = Sugar.Object.median;
},{"../enumerable/internal/median":418,"sugar-core":809}],653:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core'),
    mergeWithOptions = require('./internal/mergeWithOptions');

Sugar.Object.defineInstanceAndStatic({

  'merge': function(target, source, opts) {
    return mergeWithOptions(target, source, opts);
  }

});

module.exports = Sugar.Object.merge;
},{"./internal/mergeWithOptions":615,"sugar-core":809}],654:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core'),
    mergeAll = require('./internal/mergeAll');

Sugar.Object.defineInstanceAndStatic({

  'mergeAll': function(target, sources, opts) {
    return mergeAll(target, sources, opts);
  }

});

module.exports = Sugar.Object.mergeAll;
},{"./internal/mergeAll":613,"sugar-core":809}],655:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core'),
    getMinOrMax = require('../enumerable/internal/getMinOrMax');

Sugar.Object.defineInstanceAndStatic({

  'min': function(obj, all, map) {
    return getMinOrMax(obj, all, map, false, true);
  }

});

module.exports = Sugar.Object.min;
},{"../enumerable/internal/getMinOrMax":416,"sugar-core":809}],656:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core'),
    getLeastOrMost = require('../enumerable/internal/getLeastOrMost');

Sugar.Object.defineInstanceAndStatic({

  'most': function(obj, all, map) {
    return getLeastOrMost(obj, all, map, true, true);
  }

});

module.exports = Sugar.Object.most;
},{"../enumerable/internal/getLeastOrMost":415,"sugar-core":809}],657:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core'),
    objectNone = require('../enumerable/internal/objectNone');

Sugar.Object.defineInstanceAndStatic({

  'none': function(obj, f) {
    return objectNone(obj, f);
  }

});

module.exports = Sugar.Object.none;
},{"../enumerable/internal/objectNone":423,"sugar-core":809}],658:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core'),
    objectReduce = require('../enumerable/internal/objectReduce');

Sugar.Object.defineInstanceAndStatic({

  'reduce': function(obj, fn, init) {
    return objectReduce(obj, fn, init);
  }

});

module.exports = Sugar.Object.reduce;
},{"../enumerable/internal/objectReduce":424,"sugar-core":809}],659:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core'),
    objectReject = require('./internal/objectReject');

Sugar.Object.defineInstanceAndStatic({

  'reject': function(obj, f) {
    return objectReject(obj, f);
  }

});

module.exports = Sugar.Object.reject;
},{"./internal/objectReject":619,"sugar-core":809}],660:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core'),
    objectRemove = require('./internal/objectRemove');

Sugar.Object.defineInstanceAndStatic({

  'remove': function(obj, f) {
    return objectRemove(obj, f);
  }

});

module.exports = Sugar.Object.remove;
},{"./internal/objectRemove":620,"sugar-core":809}],661:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core'),
    objectSelect = require('./internal/objectSelect');

Sugar.Object.defineInstanceAndStatic({

  'select': function(obj, f) {
    return objectSelect(obj, f);
  }

});

module.exports = Sugar.Object.select;
},{"./internal/objectSelect":621,"sugar-core":809}],662:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core'),
    deepSetProperty = require('../common/internal/deepSetProperty');

Sugar.Object.defineInstanceAndStatic({

  'set': function(obj, key, val) {
    return deepSetProperty(obj, key, val);
  }

});

module.exports = Sugar.Object.set;
},{"../common/internal/deepSetProperty":118,"sugar-core":809}],663:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core'),
    objectSize = require('./internal/objectSize');

Sugar.Object.defineInstanceAndStatic({

  'size': function(obj) {
    return objectSize(obj);
  }

});

module.exports = Sugar.Object.size;
},{"./internal/objectSize":622,"sugar-core":809}],664:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core'),
    objectMatchers = require('../enumerable/var/objectMatchers');

var objectSome = objectMatchers.objectSome;

Sugar.Object.defineInstanceAndStatic({

  'some': objectSome

});

module.exports = Sugar.Object.some;
},{"../enumerable/var/objectMatchers":431,"sugar-core":809}],665:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core'),
    objectIntersectOrSubtract = require('./internal/objectIntersectOrSubtract');

Sugar.Object.defineInstanceAndStatic({

  'subtract': function(obj1, obj2) {
    return objectIntersectOrSubtract(obj1, obj2, true);
  }

});

module.exports = Sugar.Object.subtract;
},{"./internal/objectIntersectOrSubtract":617,"sugar-core":809}],666:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core'),
    sum = require('../enumerable/internal/sum');

Sugar.Object.defineInstanceAndStatic({

  'sum': function(obj, map) {
    return sum(obj, map);
  }

});

module.exports = Sugar.Object.sum;
},{"../enumerable/internal/sum":425,"sugar-core":809}],667:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core'),
    tap = require('./internal/tap');

Sugar.Object.defineInstanceAndStatic({

  'tap': function(obj, arg) {
    return tap(obj, arg);
  }

});

module.exports = Sugar.Object.tap;
},{"./internal/tap":629,"sugar-core":809}],668:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core'),
    toQueryStringWithOptions = require('./internal/toQueryStringWithOptions');

Sugar.Object.defineInstanceAndStatic({

  'toQueryString': function(obj, options) {
    return toQueryStringWithOptions(obj, options);
  }

});

module.exports = Sugar.Object.toQueryString;
},{"./internal/toQueryStringWithOptions":631,"sugar-core":809}],669:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core'),
    getValues = require('./internal/getValues');

Sugar.Object.defineInstanceAndStatic({

  'values': function(obj) {
    return getValues(obj);
  }

});

module.exports = Sugar.Object.values;
},{"./internal/getValues":607,"sugar-core":809}],670:[function(require,module,exports){
'use strict';

module.exports = /^(.+?)(\[.*\])$/;
},{}],671:[function(require,module,exports){
'use strict';

module.exports = /[^\d.-]/;
},{}],672:[function(require,module,exports){
'use strict';

module.exports = Object.getOwnPropertyDescriptor;
},{}],673:[function(require,module,exports){
'use strict';

module.exports = Object.getOwnPropertyNames;
},{}],674:[function(require,module,exports){
'use strict';

module.exports = Object.getOwnPropertySymbols;
},{}],675:[function(require,module,exports){
'use strict';

module.exports = Object.prototype.toString;
},{}],676:[function(require,module,exports){
'use strict';

var buildDateRangeUnits = require('../internal/buildDateRangeUnits');

buildDateRangeUnits();
},{"../internal/buildDateRangeUnits":685}],677:[function(require,module,exports){
'use strict';

var Range = require('./internal/Range'),
    rangeClamp = require('./internal/rangeClamp'),
    defineOnPrototype = require('../common/internal/defineOnPrototype');

defineOnPrototype(Range, {

  'clamp': function(el) {
    return rangeClamp(this, el);
  }

});

// This package does not export anything as it is
// simply defining "clamp" on Range.prototype.
},{"../common/internal/defineOnPrototype":123,"./internal/Range":684,"./internal/rangeClamp":698}],678:[function(require,module,exports){
'use strict';

var Range = require('./internal/Range'),
    defineOnPrototype = require('../common/internal/defineOnPrototype');

defineOnPrototype(Range, {

  'clone': function() {
    return new Range(this.start, this.end);
  }

});

// This package does not export anything as it is
// simply defining "clone" on Range.prototype.
},{"../common/internal/defineOnPrototype":123,"./internal/Range":684}],679:[function(require,module,exports){
'use strict';

var Range = require('./internal/Range'),
    defineOnPrototype = require('../common/internal/defineOnPrototype');

defineOnPrototype(Range, {

  'contains': function(el) {
    if (el == null) return false;
    if (el.start && el.end) {
      return el.start >= this.start && el.start <= this.end &&
             el.end   >= this.start && el.end   <= this.end;
    } else {
      return el >= this.start && el <= this.end;
    }
  }

});

// This package does not export anything as it is
// simply defining "contains" on Range.prototype.
},{"../common/internal/defineOnPrototype":123,"./internal/Range":684}],680:[function(require,module,exports){
'use strict';

require('./build/buildDateRangeUnitsCall');

// This package does not export anything as it is
// simply defining "days" on Range.prototype.
},{"./build/buildDateRangeUnitsCall":676}],681:[function(require,module,exports){
'use strict';

var Range = require('./internal/Range'),
    rangeEvery = require('./internal/rangeEvery'),
    defineOnPrototype = require('../common/internal/defineOnPrototype');

defineOnPrototype(Range, {

  'every': function(amount, fn) {
    return rangeEvery(this, amount, false, fn);
  }

});

// This package does not export anything as it is
// simply defining "every" on Range.prototype.
},{"../common/internal/defineOnPrototype":123,"./internal/Range":684,"./internal/rangeEvery":699}],682:[function(require,module,exports){
'use strict';

require('./build/buildDateRangeUnitsCall');

// This package does not export anything as it is
// simply defining "hours" on Range.prototype.
},{"./build/buildDateRangeUnitsCall":676}],683:[function(require,module,exports){
'use strict';

// Static Methods
require('../date/range');
require('../number/range');
require('../string/range');

// Instance Methods
require('../number/cap');
require('../number/clamp');
require('../number/upto');

// Prototype Methods
require('./clamp');
require('./clone');
require('./contains');
require('./days');
require('./every');
require('./hours');
require('./intersect');
require('./isValid');
require('./milliseconds');
require('./minutes');
require('./months');
require('./seconds');
require('./span');
require('./toArray');
require('./toString');
require('./union');
require('./weeks');
require('./years');

// Aliases
require('../number/downto');

module.exports = require('sugar-core');
},{"../date/range":360,"../number/cap":462,"../number/clamp":465,"../number/downto":477,"../number/range":541,"../number/upto":559,"../string/range":774,"./clamp":677,"./clone":678,"./contains":679,"./days":680,"./every":681,"./hours":682,"./intersect":702,"./isValid":703,"./milliseconds":704,"./minutes":705,"./months":706,"./seconds":707,"./span":708,"./toArray":709,"./toString":710,"./union":711,"./weeks":719,"./years":720,"sugar-core":809}],684:[function(require,module,exports){
'use strict';

var cloneRangeMember = require('./cloneRangeMember');

function Range(start, end) {
  this.start = cloneRangeMember(start);
  this.end   = cloneRangeMember(end);
}

module.exports = Range;
},{"./cloneRangeMember":686}],685:[function(require,module,exports){
'use strict';

var MULTIPLIERS = require('../var/MULTIPLIERS'),
    DURATION_UNITS = require('../var/DURATION_UNITS'),
    Range = require('./Range'),
    trunc = require('../../common/var/trunc'),
    forEach = require('../../common/internal/forEach'),
    rangeEvery = require('./rangeEvery'),
    simpleCapitalize = require('../../common/internal/simpleCapitalize'),
    defineOnPrototype = require('../../common/internal/defineOnPrototype');

function buildDateRangeUnits() {
  var methods = {};
  forEach(DURATION_UNITS.split('|'), function(unit, i) {
    var name = unit + 's', mult, fn;
    if (i < 4) {
      fn = function() {
        return rangeEvery(this, unit, true);
      };
    } else {
      mult = MULTIPLIERS[simpleCapitalize(name)];
      fn = function() {
        return trunc((this.end - this.start) / mult);
      };
    }
    methods[name] = fn;
  });
  defineOnPrototype(Range, methods);
}

module.exports = buildDateRangeUnits;
},{"../../common/internal/defineOnPrototype":123,"../../common/internal/forEach":129,"../../common/internal/simpleCapitalize":171,"../../common/var/trunc":198,"../var/DURATION_UNITS":713,"../var/MULTIPLIERS":717,"./Range":684,"./rangeEvery":699}],686:[function(require,module,exports){
'use strict';

var classChecks = require('../../common/var/classChecks'),
    getRangeMemberPrimitiveValue = require('./getRangeMemberPrimitiveValue');

var isDate = classChecks.isDate;

function cloneRangeMember(m) {
  if (isDate(m)) {
    return new Date(m.getTime());
  } else {
    return getRangeMemberPrimitiveValue(m);
  }
}

module.exports = cloneRangeMember;
},{"../../common/var/classChecks":192,"./getRangeMemberPrimitiveValue":693}],687:[function(require,module,exports){
'use strict';

var Range = require('./Range'),
    DurationTextFormats = require('../var/DurationTextFormats'),
    incrementDate = require('./incrementDate'),
    getDateForRange = require('./getDateForRange'),
    namespaceAliases = require('../../common/var/namespaceAliases'),
    getDateIncrementObject = require('./getDateIncrementObject');

var sugarDate = namespaceAliases.sugarDate,
    RANGE_REG_FROM_TO = DurationTextFormats.RANGE_REG_FROM_TO,
    RANGE_REG_REAR_DURATION = DurationTextFormats.RANGE_REG_REAR_DURATION,
    RANGE_REG_FRONT_DURATION = DurationTextFormats.RANGE_REG_FRONT_DURATION;

function createDateRangeFromString(str) {
  var match, datetime, duration, dio, start, end;
  if (sugarDate.get && (match = str.match(RANGE_REG_FROM_TO))) {
    start = getDateForRange(match[1].replace('from', 'at'));
    end = sugarDate.get(start, match[2]);
    return new Range(start, end);
  }
  if (match = str.match(RANGE_REG_FRONT_DURATION)) {
    duration = match[1];
    datetime = match[2];
  }
  if (match = str.match(RANGE_REG_REAR_DURATION)) {
    datetime = match[1];
    duration = match[2];
  }
  if (datetime && duration) {
    start = getDateForRange(datetime);
    dio = getDateIncrementObject(duration);
    end = incrementDate(start, dio[0], dio[1]);
  } else {
    start = str;
  }
  return new Range(getDateForRange(start), getDateForRange(end));
}

module.exports = createDateRangeFromString;
},{"../../common/var/namespaceAliases":197,"../var/DurationTextFormats":715,"./Range":684,"./getDateForRange":688,"./getDateIncrementObject":689,"./incrementDate":694}],688:[function(require,module,exports){
'use strict';

var classChecks = require('../../common/var/classChecks'),
    namespaceAliases = require('../../common/var/namespaceAliases');

var isDate = classChecks.isDate,
    sugarDate = namespaceAliases.sugarDate;

function getDateForRange(d) {
  if (isDate(d)) {
    return d;
  } else if (d == null) {
    return new Date();
  } else if (sugarDate.create) {
    return sugarDate.create(d);
  }
  return new Date(d);
}

module.exports = getDateForRange;
},{"../../common/var/classChecks":192,"../../common/var/namespaceAliases":197}],689:[function(require,module,exports){
'use strict';

var DURATION_REG = require('../var/DURATION_REG'),
    classChecks = require('../../common/var/classChecks'),
    simpleCapitalize = require('../../common/internal/simpleCapitalize');

var isNumber = classChecks.isNumber;

function getDateIncrementObject(amt) {
  var match, val, unit;
  if (isNumber(amt)) {
    return [amt, 'Milliseconds'];
  }
  match = amt.match(DURATION_REG);
  val = +match[1] || 1;
  unit = simpleCapitalize(match[2].toLowerCase());
  if (unit.match(/hour|minute|second/i)) {
    unit += 's';
  } else if (unit === 'Year') {
    unit = 'FullYear';
  } else if (unit === 'Week') {
    unit = 'Date';
    val *= 7;
  } else if (unit === 'Day') {
    unit = 'Date';
  }
  return [val, unit];
}

module.exports = getDateIncrementObject;
},{"../../common/internal/simpleCapitalize":171,"../../common/var/classChecks":192,"../var/DURATION_REG":712}],690:[function(require,module,exports){
'use strict';

var mathAliases = require('../../common/var/mathAliases'),
    getPrecision = require('./getPrecision');

var max = mathAliases.max;

function getGreaterPrecision(n1, n2) {
  return max(getPrecision(n1), getPrecision(n2));
}

module.exports = getGreaterPrecision;
},{"../../common/var/mathAliases":195,"./getPrecision":691}],691:[function(require,module,exports){
'use strict';

var periodSplit = require('../../common/internal/periodSplit');

function getPrecision(n) {
  var split = periodSplit(n.toString());
  return split[1] ? split[1].length : 0;
}

module.exports = getPrecision;
},{"../../common/internal/periodSplit":163}],692:[function(require,module,exports){
'use strict';

var classChecks = require('../../common/var/classChecks');

var isString = classChecks.isString;

function getRangeMemberNumericValue(m) {
  return isString(m) ? m.charCodeAt(0) : m;
}

module.exports = getRangeMemberNumericValue;
},{"../../common/var/classChecks":192}],693:[function(require,module,exports){
'use strict';

var classChecks = require('../../common/var/classChecks');

var isDate = classChecks.isDate;

function getRangeMemberPrimitiveValue(m) {
  if (m == null) return m;
  return isDate(m) ? m.getTime() : m.valueOf();
}

module.exports = getRangeMemberPrimitiveValue;
},{"../../common/var/classChecks":192}],694:[function(require,module,exports){
'use strict';

var MULTIPLIERS = require('../var/MULTIPLIERS'),
    callDateSet = require('../../common/internal/callDateSet'),
    callDateGet = require('../../common/internal/callDateGet');

function incrementDate(src, amount, unit) {
  var mult = MULTIPLIERS[unit], d;
  if (mult) {
    d = new Date(src.getTime() + (amount * mult));
  } else {
    d = new Date(src);
    callDateSet(d, unit, callDateGet(src, unit) + amount);
  }
  return d;
}

module.exports = incrementDate;
},{"../../common/internal/callDateGet":108,"../../common/internal/callDateSet":109,"../var/MULTIPLIERS":717}],695:[function(require,module,exports){
'use strict';

var withPrecision = require('../../common/internal/withPrecision');

function incrementNumber(current, amount, precision) {
  return withPrecision(current + amount, precision);
}

module.exports = incrementNumber;
},{"../../common/internal/withPrecision":178}],696:[function(require,module,exports){
'use strict';

var chr = require('../../common/var/chr');

function incrementString(current, amount) {
  return chr(current.charCodeAt(0) + amount);
}

module.exports = incrementString;
},{"../../common/var/chr":191}],697:[function(require,module,exports){
'use strict';

var valueIsNotInfinite = require('./valueIsNotInfinite'),
    getRangeMemberPrimitiveValue = require('./getRangeMemberPrimitiveValue');

function isValidRangeMember(m) {
  var val = getRangeMemberPrimitiveValue(m);
  return (!!val || val === 0) && valueIsNotInfinite(m);
}

module.exports = isValidRangeMember;
},{"./getRangeMemberPrimitiveValue":693,"./valueIsNotInfinite":701}],698:[function(require,module,exports){
'use strict';

var cloneRangeMember = require('./cloneRangeMember');

function rangeClamp(range, obj) {
  var clamped,
      start = range.start,
      end = range.end,
      min = end < start ? end : start,
      max = start > end ? start : end;
  if (obj < min) {
    clamped = min;
  } else if (obj > max) {
    clamped = max;
  } else {
    clamped = obj;
  }
  return cloneRangeMember(clamped);
}

module.exports = rangeClamp;
},{"./cloneRangeMember":686}],699:[function(require,module,exports){
'use strict';

var classChecks = require('../../common/var/classChecks'),
    rangeIsValid = require('./rangeIsValid'),
    incrementDate = require('./incrementDate'),
    incrementNumber = require('./incrementNumber'),
    incrementString = require('./incrementString'),
    getGreaterPrecision = require('./getGreaterPrecision'),
    getDateIncrementObject = require('./getDateIncrementObject');

var isNumber = classChecks.isNumber,
    isString = classChecks.isString,
    isDate = classChecks.isDate,
    isFunction = classChecks.isFunction;

function rangeEvery(range, step, countOnly, fn) {
  var increment,
      precision,
      dio,
      unit,
      start   = range.start,
      end     = range.end,
      inverse = end < start,
      current = start,
      index   = 0,
      result  = [];

  if (!rangeIsValid(range)) {
    return countOnly ? NaN : [];
  }
  if (isFunction(step)) {
    fn = step;
    step = null;
  }
  step = step || 1;
  if (isNumber(start)) {
    precision = getGreaterPrecision(start, step);
    increment = function() {
      return incrementNumber(current, step, precision);
    };
  } else if (isString(start)) {
    increment = function() {
      return incrementString(current, step);
    };
  } else if (isDate(start)) {
    dio  = getDateIncrementObject(step);
    step = dio[0];
    unit = dio[1];
    increment = function() {
      return incrementDate(current, step, unit);
    };
  }
  // Avoiding infinite loops
  if (inverse && step > 0) {
    step *= -1;
  }
  while(inverse ? current >= end : current <= end) {
    if (!countOnly) {
      result.push(current);
    }
    if (fn) {
      fn(current, index, range);
    }
    current = increment();
    index++;
  }
  return countOnly ? index - 1 : result;
}

module.exports = rangeEvery;
},{"../../common/var/classChecks":192,"./getDateIncrementObject":689,"./getGreaterPrecision":690,"./incrementDate":694,"./incrementNumber":695,"./incrementString":696,"./rangeIsValid":700}],700:[function(require,module,exports){
'use strict';

var isValidRangeMember = require('./isValidRangeMember');

function rangeIsValid(range) {
  return isValidRangeMember(range.start) &&
         isValidRangeMember(range.end) &&
         typeof range.start === typeof range.end;
}

module.exports = rangeIsValid;
},{"./isValidRangeMember":697}],701:[function(require,module,exports){
'use strict';

function valueIsNotInfinite(m) {
  return m !== -Infinity && m !== Infinity;
}

module.exports = valueIsNotInfinite;
},{}],702:[function(require,module,exports){
'use strict';

var Range = require('./internal/Range'),
    defineOnPrototype = require('../common/internal/defineOnPrototype');

defineOnPrototype(Range, {

  'intersect': function(range) {
    if (range.start > this.end || range.end < this.start) {
      return new Range(NaN, NaN);
    }
    return new Range(
      this.start > range.start ? this.start : range.start,
      this.end   < range.end   ? this.end   : range.end
    );
  }

});

// This package does not export anything as it is
// simply defining "intersect" on Range.prototype.
},{"../common/internal/defineOnPrototype":123,"./internal/Range":684}],703:[function(require,module,exports){
'use strict';

var Range = require('./internal/Range'),
    rangeIsValid = require('./internal/rangeIsValid'),
    defineOnPrototype = require('../common/internal/defineOnPrototype');

defineOnPrototype(Range, {

  'isValid': function() {
    return rangeIsValid(this);
  }

});

// This package does not export anything as it is
// simply defining "isValid" on Range.prototype.
},{"../common/internal/defineOnPrototype":123,"./internal/Range":684,"./internal/rangeIsValid":700}],704:[function(require,module,exports){
'use strict';

require('./build/buildDateRangeUnitsCall');

// This package does not export anything as it is
// simply defining "milliseconds" on Range.prototype.
},{"./build/buildDateRangeUnitsCall":676}],705:[function(require,module,exports){
'use strict';

require('./build/buildDateRangeUnitsCall');

// This package does not export anything as it is
// simply defining "minutes" on Range.prototype.
},{"./build/buildDateRangeUnitsCall":676}],706:[function(require,module,exports){
'use strict';

require('./build/buildDateRangeUnitsCall');

// This package does not export anything as it is
// simply defining "months" on Range.prototype.
},{"./build/buildDateRangeUnitsCall":676}],707:[function(require,module,exports){
'use strict';

require('./build/buildDateRangeUnitsCall');

// This package does not export anything as it is
// simply defining "seconds" on Range.prototype.
},{"./build/buildDateRangeUnitsCall":676}],708:[function(require,module,exports){
'use strict';

var Range = require('./internal/Range'),
    mathAliases = require('../common/var/mathAliases'),
    rangeIsValid = require('./internal/rangeIsValid'),
    defineOnPrototype = require('../common/internal/defineOnPrototype'),
    getRangeMemberNumericValue = require('./internal/getRangeMemberNumericValue');

var abs = mathAliases.abs;

defineOnPrototype(Range, {

  'span': function() {
    var n = getRangeMemberNumericValue(this.end) - getRangeMemberNumericValue(this.start);
    return rangeIsValid(this) ? abs(n) + 1 : NaN;
  }

});

// This package does not export anything as it is
// simply defining "span" on Range.prototype.
},{"../common/internal/defineOnPrototype":123,"../common/var/mathAliases":195,"./internal/Range":684,"./internal/getRangeMemberNumericValue":692,"./internal/rangeIsValid":700}],709:[function(require,module,exports){
'use strict';

var Range = require('./internal/Range'),
    rangeEvery = require('./internal/rangeEvery'),
    defineOnPrototype = require('../common/internal/defineOnPrototype');

defineOnPrototype(Range, {

  'toArray': function() {
    return rangeEvery(this);
  }

});

// This package does not export anything as it is
// simply defining "toArray" on Range.prototype.
},{"../common/internal/defineOnPrototype":123,"./internal/Range":684,"./internal/rangeEvery":699}],710:[function(require,module,exports){
'use strict';

var Range = require('./internal/Range'),
    rangeIsValid = require('./internal/rangeIsValid'),
    defineOnPrototype = require('../common/internal/defineOnPrototype');

defineOnPrototype(Range, {

  'toString': function() {
    return rangeIsValid(this) ? this.start + '..' + this.end : 'Invalid Range';
  }

});

// This package does not export anything as it is
// simply defining "toString" on Range.prototype.
},{"../common/internal/defineOnPrototype":123,"./internal/Range":684,"./internal/rangeIsValid":700}],711:[function(require,module,exports){
'use strict';

var Range = require('./internal/Range'),
    defineOnPrototype = require('../common/internal/defineOnPrototype');

defineOnPrototype(Range, {

  'union': function(range) {
    return new Range(
      this.start < range.start ? this.start : range.start,
      this.end   > range.end   ? this.end   : range.end
    );
  }

});

// This package does not export anything as it is
// simply defining "union" on Range.prototype.
},{"../common/internal/defineOnPrototype":123,"./internal/Range":684}],712:[function(require,module,exports){
'use strict';

var DURATION_UNITS = require('./DURATION_UNITS');

module.exports = RegExp('(\\d+)?\\s*('+ DURATION_UNITS +')s?', 'i');
},{"./DURATION_UNITS":713}],713:[function(require,module,exports){
'use strict';

module.exports = 'year|month|week|day|hour|minute|second|millisecond';
},{}],714:[function(require,module,exports){
'use strict';

var Range = require('../internal/Range'),
    classChecks = require('../../common/var/classChecks'),
    getDateForRange = require('../internal/getDateForRange'),
    createDateRangeFromString = require('../internal/createDateRangeFromString');

var isString = classChecks.isString;

var DateRangeConstructor = function(start, end) {
  if (arguments.length === 1 && isString(start)) {
    return createDateRangeFromString(start);
  }
  return new Range(getDateForRange(start), getDateForRange(end));
};

module.exports = DateRangeConstructor;
},{"../../common/var/classChecks":192,"../internal/Range":684,"../internal/createDateRangeFromString":687,"../internal/getDateForRange":688}],715:[function(require,module,exports){
'use strict';

var FULL_CAPTURED_DURATION = require('./FULL_CAPTURED_DURATION');

module.exports = {
  RANGE_REG_FROM_TO: /(?:from)?\s*(.+)\s+(?:to|until)\s+(.+)$/i,
  RANGE_REG_REAR_DURATION: RegExp('(.+)\\s*for\\s*' + FULL_CAPTURED_DURATION, 'i'),
  RANGE_REG_FRONT_DURATION: RegExp('(?:for)?\\s*'+ FULL_CAPTURED_DURATION +'\\s*(?:starting)?\\s(?:at\\s)?(.+)', 'i')
};
},{"./FULL_CAPTURED_DURATION":716}],716:[function(require,module,exports){
'use strict';

var DURATION_UNITS = require('./DURATION_UNITS');

module.exports = '((?:\\d+)?\\s*(?:' + DURATION_UNITS + '))s?';
},{"./DURATION_UNITS":713}],717:[function(require,module,exports){
'use strict';

var MULTIPLIERS = {
  'Hours': 60 * 60 * 1000,
  'Minutes': 60 * 1000,
  'Seconds': 1000,
  'Milliseconds': 1
};

module.exports = MULTIPLIERS;
},{}],718:[function(require,module,exports){
'use strict';

var Range = require('../internal/Range');

var PrimitiveRangeConstructor = function(start, end) {
  return new Range(start, end);
};

module.exports = PrimitiveRangeConstructor;
},{"../internal/Range":684}],719:[function(require,module,exports){
'use strict';

require('./build/buildDateRangeUnitsCall');

// This package does not export anything as it is
// simply defining "weeks" on Range.prototype.
},{"./build/buildDateRangeUnitsCall":676}],720:[function(require,module,exports){
'use strict';

require('./build/buildDateRangeUnitsCall');

// This package does not export anything as it is
// simply defining "years" on Range.prototype.
},{"./build/buildDateRangeUnitsCall":676}],721:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core'),
    getRegExpFlags = require('../common/internal/getRegExpFlags');

Sugar.RegExp.defineInstance({

  'addFlags': function(r, flags) {
    return RegExp(r.source, getRegExpFlags(r, flags));
  }

});

module.exports = Sugar.RegExp.addFlags;
},{"../common/internal/getRegExpFlags":140,"sugar-core":809}],722:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core'),
    escapeRegExp = require('../common/internal/escapeRegExp');

Sugar.RegExp.defineStatic({

  'escape': function(str) {
    return escapeRegExp(str);
  }

});

module.exports = Sugar.RegExp.escape;
},{"../common/internal/escapeRegExp":126,"sugar-core":809}],723:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core'),
    getRegExpFlags = require('../common/internal/getRegExpFlags');

Sugar.RegExp.defineInstance({

  'getFlags': function(r) {
    return getRegExpFlags(r);
  }

});

module.exports = Sugar.RegExp.getFlags;
},{"../common/internal/getRegExpFlags":140,"sugar-core":809}],724:[function(require,module,exports){
'use strict';

// Static Methods
require('./escape');

// Instance Methods
require('./addFlags');
require('./getFlags');
require('./removeFlags');
require('./setFlags');

module.exports = require('sugar-core');
},{"./addFlags":721,"./escape":722,"./getFlags":723,"./removeFlags":725,"./setFlags":726,"sugar-core":809}],725:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core'),
    allCharsReg = require('../common/internal/allCharsReg'),
    getRegExpFlags = require('../common/internal/getRegExpFlags');

Sugar.RegExp.defineInstance({

  'removeFlags': function(r, flags) {
    var reg = allCharsReg(flags);
    return RegExp(r.source, getRegExpFlags(r).replace(reg, ''));
  }

});

module.exports = Sugar.RegExp.removeFlags;
},{"../common/internal/allCharsReg":103,"../common/internal/getRegExpFlags":140,"sugar-core":809}],726:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core');

Sugar.RegExp.defineInstance({

  'setFlags': function(r, flags) {
    return RegExp(r.source, flags);
  }

});

module.exports = Sugar.RegExp.setFlags;
},{"sugar-core":809}],727:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core'),
    getEntriesForIndexes = require('../common/internal/getEntriesForIndexes');

Sugar.String.defineInstance({

  'at': function(str, index, loop) {
    return getEntriesForIndexes(str, index, loop, true);
  }

});

module.exports = Sugar.String.at;
},{"../common/internal/getEntriesForIndexes":133,"sugar-core":809}],728:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core'),
    stringCamelize = require('./internal/stringCamelize');

Sugar.String.defineInstance({

  'camelize': function(str, upper) {
    return stringCamelize(str, upper);
  }

});

module.exports = Sugar.String.camelize;
},{"./internal/stringCamelize":753,"sugar-core":809}],729:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core'),
    stringCapitalize = require('./internal/stringCapitalize');

Sugar.String.defineInstance({

  'capitalize': function(str, lower, all) {
    return stringCapitalize(str, lower, all);
  }

});

module.exports = Sugar.String.capitalize;
},{"./internal/stringCapitalize":754,"sugar-core":809}],730:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core'),
    stringEach = require('./internal/stringEach');

Sugar.String.defineInstance({

  'chars': function(str, search, fn) {
    return stringEach(str, search, fn);
  }

});

module.exports = Sugar.String.chars;
},{"./internal/stringEach":756,"sugar-core":809}],731:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core'),
    stringCodes = require('./internal/stringCodes');

Sugar.String.defineInstance({

  'codes': function(str, fn) {
    return stringCodes(str, fn);
  }

});

module.exports = Sugar.String.codes;
},{"./internal/stringCodes":755,"sugar-core":809}],732:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core'),
    trim = require('../common/internal/trim');

Sugar.String.defineInstance({

  'compact': function(str) {
    return trim(str).replace(/([\r\n\s　])+/g, function(match, whitespace) {
      return whitespace === '　' ? whitespace : ' ';
    });
  }

});

module.exports = Sugar.String.compact;
},{"../common/internal/trim":177,"sugar-core":809}],733:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core'),
    stringUnderscore = require('./internal/stringUnderscore');

Sugar.String.defineInstance({

  'dasherize': function(str) {
    return stringUnderscore(str).replace(/_/g, '-');
  }

});

module.exports = Sugar.String.dasherize;
},{"./internal/stringUnderscore":761,"sugar-core":809}],734:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core'),
    base64 = require('./var/base64');

var decodeBase64 = base64.decodeBase64;

Sugar.String.defineInstance({

  'decodeBase64': function(str) {
    return decodeBase64(str);
  }

});

module.exports = Sugar.String.decodeBase64;
},{"./var/base64":805,"sugar-core":809}],735:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core'),
    base64 = require('./var/base64');

var encodeBase64 = base64.encodeBase64;

Sugar.String.defineInstance({

  'encodeBase64': function(str) {
    return encodeBase64(str);
  }

});

module.exports = Sugar.String.encodeBase64;
},{"./var/base64":805,"sugar-core":809}],736:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core'),
    HTML_ESCAPE_REG = require('./var/HTML_ESCAPE_REG'),
    HTMLToEntityMap = require('./var/HTMLToEntityMap'),
    coreUtilityAliases = require('../common/var/coreUtilityAliases');

var getOwn = coreUtilityAliases.getOwn;

Sugar.String.defineInstance({

  'escapeHTML': function(str) {
    return str.replace(HTML_ESCAPE_REG, function(chr) {
      return getOwn(HTMLToEntityMap, chr);
    });
  }

});

module.exports = Sugar.String.escapeHTML;
},{"../common/var/coreUtilityAliases":193,"./var/HTMLToEntityMap":797,"./var/HTML_ESCAPE_REG":799,"sugar-core":809}],737:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core');

Sugar.String.defineInstance({

  'escapeURL': function(str, param) {
    return param ? encodeURIComponent(str) : encodeURI(str);
  }

});

module.exports = Sugar.String.escapeURL;
},{"sugar-core":809}],738:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core'),
    isUndefined = require('../common/internal/isUndefined');

Sugar.String.defineInstance({

  'first': function(str, num) {
    if (isUndefined(num)) num = 1;
    return str.substr(0, num);
  }

});

module.exports = Sugar.String.first;
},{"../common/internal/isUndefined":155,"sugar-core":809}],739:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core'),
    stringEach = require('./internal/stringEach');

Sugar.String.defineInstance({

  'forEach': function(str, search, fn) {
    return stringEach(str, search, fn);
  }

});

module.exports = Sugar.String.forEach;
},{"./internal/stringEach":756,"sugar-core":809}],740:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core'),
    isObjectType = require('../common/internal/isObjectType'),
    stringFormatMatcher = require('./var/stringFormatMatcher');

Sugar.String.defineInstanceWithArguments({

  'format': function(str, args) {
    var arg1 = args[0] && args[0].valueOf();
    // Unwrap if a single object is passed in.
    if (args.length === 1 && isObjectType(arg1)) {
      args = arg1;
    }
    return stringFormatMatcher(str, args);
  }

});

module.exports = Sugar.String.format;
},{"../common/internal/isObjectType":151,"./var/stringFormatMatcher":807,"sugar-core":809}],741:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core'),
    numberOrIndex = require('./internal/numberOrIndex');

Sugar.String.defineInstance({

  'from': function(str, from) {
    return str.slice(numberOrIndex(str, from, true));
  }

});

module.exports = Sugar.String.from;
},{"./internal/numberOrIndex":747,"sugar-core":809}],742:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core'),
    ENHANCEMENTS_FLAG = require('../common/var/ENHANCEMENTS_FLAG'),
    STRING_ENHANCEMENTS_FLAG = require('./var/STRING_ENHANCEMENTS_FLAG'),
    fixArgumentLength = require('../common/internal/fixArgumentLength'),
    callIncludesWithRegexSupport = require('./internal/callIncludesWithRegexSupport');

Sugar.String.defineInstance({

  'includes': fixArgumentLength(callIncludesWithRegexSupport)

}, [ENHANCEMENTS_FLAG, STRING_ENHANCEMENTS_FLAG]);

module.exports = Sugar.String.includes;
},{"../common/internal/fixArgumentLength":128,"../common/var/ENHANCEMENTS_FLAG":181,"./internal/callIncludesWithRegexSupport":745,"./var/STRING_ENHANCEMENTS_FLAG":803,"sugar-core":809}],743:[function(require,module,exports){
'use strict';

// Instance Methods
require('./at');
require('./camelize');
require('./capitalize');
require('./chars');
require('./codes');
require('./compact');
require('./dasherize');
require('./decodeBase64');
require('./encodeBase64');
require('./escapeHTML');
require('./escapeURL');
require('./first');
require('./forEach');
require('./format');
require('./from');
require('./includes');
require('./insert');
require('./isBlank');
require('./isEmpty');
require('./last');
require('./lines');
require('./pad');
require('./padLeft');
require('./padRight');
require('./parameterize');
require('./remove');
require('./removeAll');
require('./removeTags');
require('./replaceAll');
require('./reverse');
require('./shift');
require('./spacify');
require('./stripTags');
require('./titleize');
require('./to');
require('./toNumber');
require('./trimLeft');
require('./trimRight');
require('./truncate');
require('./truncateOnWord');
require('./underscore');
require('./unescapeHTML');
require('./unescapeURL');
require('./words');

module.exports = require('sugar-core');
},{"./at":727,"./camelize":728,"./capitalize":729,"./chars":730,"./codes":731,"./compact":732,"./dasherize":733,"./decodeBase64":734,"./encodeBase64":735,"./escapeHTML":736,"./escapeURL":737,"./first":738,"./forEach":739,"./format":740,"./from":741,"./includes":742,"./insert":744,"./isBlank":766,"./isEmpty":767,"./last":768,"./lines":769,"./pad":770,"./padLeft":771,"./padRight":772,"./parameterize":773,"./remove":775,"./removeAll":776,"./removeTags":777,"./replaceAll":778,"./reverse":779,"./shift":780,"./spacify":781,"./stripTags":782,"./titleize":783,"./to":784,"./toNumber":785,"./trimLeft":786,"./trimRight":787,"./truncate":788,"./truncateOnWord":789,"./underscore":790,"./unescapeHTML":791,"./unescapeURL":792,"./words":808,"sugar-core":809}],744:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core'),
    isUndefined = require('../common/internal/isUndefined');

Sugar.String.defineInstance({

  'insert': function(str, substr, index) {
    index = isUndefined(index) ? str.length : index;
    return str.slice(0, index) + substr + str.slice(index);
  }

});

module.exports = Sugar.String.insert;
},{"../common/internal/isUndefined":155,"sugar-core":809}],745:[function(require,module,exports){
'use strict';

var classChecks = require('../../common/var/classChecks'),
    nativeIncludes = require('../var/nativeIncludes');

var isRegExp = classChecks.isRegExp;

function callIncludesWithRegexSupport(str, search, position) {
  if (!isRegExp(search)) {
    return nativeIncludes.call(str, search, position);
  }
  if (position) {
    str = str.slice(position);
  }
  return search.test(str);
}

module.exports = callIncludesWithRegexSupport;
},{"../../common/var/classChecks":192,"../var/nativeIncludes":806}],746:[function(require,module,exports){
'use strict';

var trim = require('../../common/internal/trim'),
    stringEach = require('./stringEach');

function eachWord(str, fn) {
  return stringEach(trim(str), /\S+/g, fn);
}

module.exports = eachWord;
},{"../../common/internal/trim":177,"./stringEach":756}],747:[function(require,module,exports){
'use strict';

var classChecks = require('../../common/var/classChecks');

var isString = classChecks.isString;

function numberOrIndex(str, n, from) {
  if (isString(n)) {
    n = str.indexOf(n);
    if (n === -1) {
      n = from ? str.length : 0;
    }
  }
  return n;
}

module.exports = numberOrIndex;
},{"../../common/var/classChecks":192}],748:[function(require,module,exports){
'use strict';

var isDefined = require('../../common/internal/isDefined'),
    repeatString = require('../../common/internal/repeatString');

function padString(num, padding) {
  return repeatString(isDefined(padding) ? padding : ' ', num);
}

module.exports = padString;
},{"../../common/internal/isDefined":149,"../../common/internal/repeatString":166}],749:[function(require,module,exports){
'use strict';

var map = require('../../common/internal/map'),
    classChecks = require('../../common/var/classChecks'),
    escapeRegExp = require('../../common/internal/escapeRegExp'),
    runTagReplacements = require('./runTagReplacements');

var isString = classChecks.isString;

function replaceTags(str, find, replacement, strip) {
  var tags = isString(find) ? [find] : find, reg, src;
  tags = map(tags || [], function(t) {
    return escapeRegExp(t);
  }).join('|');
  src = tags.replace('all', '') || '[^\\s>]+';
  src = '<(\\/)?(' + src + ')(\\s+[^<>]*?)?\\s*(\\/)?>';
  reg = RegExp(src, 'gi');
  return runTagReplacements(str.toString(), reg, strip, replacement);
}

module.exports = replaceTags;
},{"../../common/internal/escapeRegExp":126,"../../common/internal/map":158,"../../common/var/classChecks":192,"./runTagReplacements":752}],750:[function(require,module,exports){
'use strict';

function reverseString(str) {
  return str.split('').reverse().join('');
}

module.exports = reverseString;
},{}],751:[function(require,module,exports){
'use strict';

function runGlobalMatch(str, reg) {
  var result = [], match, lastLastIndex;
  while ((match = reg.exec(str)) != null) {
    if (reg.lastIndex === lastLastIndex) {
      reg.lastIndex += 1;
    } else {
      result.push(match[0]);
    }
    lastLastIndex = reg.lastIndex;
  }
  return result;
}

module.exports = runGlobalMatch;
},{}],752:[function(require,module,exports){
'use strict';

var tagIsVoid = require('./tagIsVoid'),
    classChecks = require('../../common/var/classChecks');

var isString = classChecks.isString;

function runTagReplacements(str, reg, strip, replacement, fullString) {

  var match;
  var result = '';
  var currentIndex = 0;
  var openTagName;
  var openTagAttributes;
  var openTagCount = 0;

  function processTag(index, tagName, attributes, tagLength, isVoid) {
    var content = str.slice(currentIndex, index), s = '', r = '';
    if (isString(replacement)) {
      r = replacement;
    } else if (replacement) {
      r = replacement.call(fullString, tagName, content, attributes, fullString) || '';
    }
    if (strip) {
      s = r;
    } else {
      content = r;
    }
    if (content) {
      content = runTagReplacements(content, reg, strip, replacement, fullString);
    }
    result += s + content + (isVoid ? '' : s);
    currentIndex = index + (tagLength || 0);
  }

  fullString = fullString || str;
  reg = RegExp(reg.source, 'gi');

  while(match = reg.exec(str)) {

    var tagName         = match[2];
    var attributes      = (match[3]|| '').slice(1);
    var isClosingTag    = !!match[1];
    var isSelfClosing   = !!match[4];
    var tagLength       = match[0].length;
    var isVoid          = tagIsVoid(tagName);
    var isOpeningTag    = !isClosingTag && !isSelfClosing && !isVoid;
    var isSameAsCurrent = tagName === openTagName;

    if (!openTagName) {
      result += str.slice(currentIndex, match.index);
      currentIndex = match.index;
    }

    if (isOpeningTag) {
      if (!openTagName) {
        openTagName = tagName;
        openTagAttributes = attributes;
        openTagCount++;
        currentIndex += tagLength;
      } else if (isSameAsCurrent) {
        openTagCount++;
      }
    } else if (isClosingTag && isSameAsCurrent) {
      openTagCount--;
      if (openTagCount === 0) {
        processTag(match.index, openTagName, openTagAttributes, tagLength, isVoid);
        openTagName       = null;
        openTagAttributes = null;
      }
    } else if (!openTagName) {
      processTag(match.index, tagName, attributes, tagLength, isVoid);
    }
  }
  if (openTagName) {
    processTag(str.length, openTagName, openTagAttributes);
  }
  result += str.slice(currentIndex);
  return result;
}

module.exports = runTagReplacements;
},{"../../common/var/classChecks":192,"./tagIsVoid":762}],753:[function(require,module,exports){
'use strict';

var CAMELIZE_REG = require('../var/CAMELIZE_REG'),
    getAcronym = require('../../common/internal/getAcronym'),
    stringUnderscore = require('./stringUnderscore'),
    stringCapitalize = require('./stringCapitalize');

function stringCamelize(str, upper) {
  str = stringUnderscore(str);
  return str.replace(CAMELIZE_REG, function(match, pre, word, index) {
    var cap = upper !== false || index > 0, acronym;
    acronym = getAcronym(word);
    if (acronym && cap) {
      return acronym;
    }
    return cap ? stringCapitalize(word, true) : word;
  });
}

module.exports = stringCamelize;
},{"../../common/internal/getAcronym":132,"../var/CAMELIZE_REG":793,"./stringCapitalize":754,"./stringUnderscore":761}],754:[function(require,module,exports){
'use strict';

var CAPITALIZE_REG = require('../var/CAPITALIZE_REG'),
    simpleCapitalize = require('../../common/internal/simpleCapitalize');

function stringCapitalize(str, downcase, all) {
  if (downcase) {
    str = str.toLowerCase();
  }
  return all ? str.replace(CAPITALIZE_REG, simpleCapitalize) : simpleCapitalize(str);
}

module.exports = stringCapitalize;
},{"../../common/internal/simpleCapitalize":171,"../var/CAPITALIZE_REG":794}],755:[function(require,module,exports){
'use strict';

function stringCodes(str, fn) {
  var codes = new Array(str.length), i, len;
  for(i = 0, len = str.length; i < len; i++) {
    var code = str.charCodeAt(i);
    codes[i] = code;
    if (fn) {
      fn.call(str, code, i, str);
    }
  }
  return codes;
}

module.exports = stringCodes;
},{}],756:[function(require,module,exports){
'use strict';

var isDefined = require('../../common/internal/isDefined'),
    classChecks = require('../../common/var/classChecks'),
    escapeRegExp = require('../../common/internal/escapeRegExp'),
    getRegExpFlags = require('../../common/internal/getRegExpFlags'),
    runGlobalMatch = require('./runGlobalMatch');

var isString = classChecks.isString,
    isRegExp = classChecks.isRegExp,
    isFunction = classChecks.isFunction;

function stringEach(str, search, fn) {
  var chunks, chunk, reg, result = [];
  if (isFunction(search)) {
    fn = search;
    reg = /[\s\S]/g;
  } else if (!search) {
    reg = /[\s\S]/g;
  } else if (isString(search)) {
    reg = RegExp(escapeRegExp(search), 'gi');
  } else if (isRegExp(search)) {
    reg = RegExp(search.source, getRegExpFlags(search, 'g'));
  }
  // Getting the entire array of chunks up front as we need to
  // pass this into the callback function as an argument.
  chunks = runGlobalMatch(str, reg);

  if (chunks) {
    for(var i = 0, len = chunks.length, r; i < len; i++) {
      chunk = chunks[i];
      result[i] = chunk;
      if (fn) {
        r = fn.call(str, chunk, i, chunks);
        if (r === false) {
          break;
        } else if (isDefined(r)) {
          result[i] = r;
        }
      }
    }
  }
  return result;
}

module.exports = stringEach;
},{"../../common/internal/escapeRegExp":126,"../../common/internal/getRegExpFlags":140,"../../common/internal/isDefined":149,"../../common/var/classChecks":192,"./runGlobalMatch":751}],757:[function(require,module,exports){
'use strict';

var escapeRegExp = require('../../common/internal/escapeRegExp');

function stringParameterize(str, separator) {
  if (separator === undefined) separator = '-';
  str = str.replace(/[^a-z0-9\-_]+/gi, separator);
  if (separator) {
    var reg = RegExp('^{s}+|{s}+$|({s}){s}+'.split('{s}').join(escapeRegExp(separator)), 'g');
    str = str.replace(reg, '$1');
  }
  return encodeURI(str.toLowerCase());
}

module.exports = stringParameterize;
},{"../../common/internal/escapeRegExp":126}],758:[function(require,module,exports){
'use strict';

var classChecks = require('../../common/var/classChecks'),
    escapeRegExp = require('../../common/internal/escapeRegExp'),
    getRegExpFlags = require('../../common/internal/getRegExpFlags');

var isString = classChecks.isString;

function stringReplaceAll(str, f, replace) {
  var i = 0, tokens;
  if (isString(f)) {
    f = RegExp(escapeRegExp(f), 'g');
  } else if (f && !f.global) {
    f = RegExp(f.source, getRegExpFlags(f, 'g'));
  }
  if (!replace) {
    replace = '';
  } else {
    tokens = replace;
    replace = function() {
      var t = tokens[i++];
      return t != null ? t : '';
    };
  }
  return str.replace(f, replace);
}

module.exports = stringReplaceAll;
},{"../../common/internal/escapeRegExp":126,"../../common/internal/getRegExpFlags":140,"../../common/var/classChecks":192}],759:[function(require,module,exports){
'use strict';

var stringUnderscore = require('./stringUnderscore');

function stringSpacify(str) {
  return stringUnderscore(str).replace(/_/g, ' ');
}

module.exports = stringSpacify;
},{"./stringUnderscore":761}],760:[function(require,module,exports){
'use strict';

var DOWNCASED_WORDS = require('../var/DOWNCASED_WORDS'),
    indexOf = require('../../common/internal/indexOf'),
    eachWord = require('./eachWord'),
    getAcronym = require('../../common/internal/getAcronym'),
    getHumanWord = require('../../common/internal/getHumanWord'),
    runHumanRules = require('../../common/internal/runHumanRules'),
    stringSpacify = require('./stringSpacify'),
    stringCapitalize = require('./stringCapitalize');

function stringTitleize(str) {
  var fullStopPunctuation = /[.:;!]$/, lastHadPunctuation;
  str = runHumanRules(str);
  str = stringSpacify(str);
  return eachWord(str, function(word, index, words) {
    word = getHumanWord(word) || word;
    word = getAcronym(word) || word;
    var hasPunctuation, isFirstOrLast;
    var first = index == 0, last = index == words.length - 1;
    hasPunctuation = fullStopPunctuation.test(word);
    isFirstOrLast = first || last || hasPunctuation || lastHadPunctuation;
    lastHadPunctuation = hasPunctuation;
    if (isFirstOrLast || indexOf(DOWNCASED_WORDS, word) === -1) {
      return stringCapitalize(word, false, true);
    } else {
      return word;
    }
  }).join(' ');
}

module.exports = stringTitleize;
},{"../../common/internal/getAcronym":132,"../../common/internal/getHumanWord":134,"../../common/internal/indexOf":146,"../../common/internal/runHumanRules":167,"../var/DOWNCASED_WORDS":795,"./eachWord":746,"./stringCapitalize":754,"./stringSpacify":759}],761:[function(require,module,exports){
'use strict';

var Inflections = require('../../common/var/Inflections');

function stringUnderscore(str) {
  var areg = Inflections.acronyms && Inflections.acronyms.reg;
  return str
    .replace(/[-\s]+/g, '_')
    .replace(areg, function(acronym, index) {
      return (index > 0 ? '_' : '') + acronym.toLowerCase();
    })
    .replace(/([A-Z\d]+)([A-Z][a-z])/g,'$1_$2')
    .replace(/([a-z\d])([A-Z])/g,'$1_$2')
    .toLowerCase();
}

module.exports = stringUnderscore;
},{"../../common/var/Inflections":183}],762:[function(require,module,exports){
'use strict';

var HTML_VOID_ELEMENTS = require('../var/HTML_VOID_ELEMENTS'),
    indexOf = require('../../common/internal/indexOf');

function tagIsVoid(tag) {
  return indexOf(HTML_VOID_ELEMENTS, tag.toLowerCase()) !== -1;
}

module.exports = tagIsVoid;
},{"../../common/internal/indexOf":146,"../var/HTML_VOID_ELEMENTS":800}],763:[function(require,module,exports){
'use strict';

var TRUNC_REG = require('../var/TRUNC_REG'),
    filter = require('../../common/internal/filter'),
    reverseString = require('./reverseString');

function truncateOnWord(str, limit, fromLeft) {
  if (fromLeft) {
    return reverseString(truncateOnWord(reverseString(str), limit));
  }
  var words = str.split(TRUNC_REG);
  var count = 0;
  return filter(words, function(word) {
    count += word.length;
    return count <= limit;
  }).join('');
}

module.exports = truncateOnWord;
},{"../../common/internal/filter":127,"../var/TRUNC_REG":804,"./reverseString":750}],764:[function(require,module,exports){
'use strict';

var isUndefined = require('../../common/internal/isUndefined'),
    mathAliases = require('../../common/var/mathAliases'),
    truncateOnWord = require('./truncateOnWord');

var ceil = mathAliases.ceil,
    floor = mathAliases.floor;

function truncateString(str, length, from, ellipsis, split) {
  var str1, str2, len1, len2;
  if (str.length <= length) {
    return str.toString();
  }
  ellipsis = isUndefined(ellipsis) ? '...' : ellipsis;
  switch(from) {
    case 'left':
      str2 = split ? truncateOnWord(str, length, true) : str.slice(str.length - length);
      return ellipsis + str2;
    case 'middle':
      len1 = ceil(length / 2);
      len2 = floor(length / 2);
      str1 = split ? truncateOnWord(str, len1) : str.slice(0, len1);
      str2 = split ? truncateOnWord(str, len2, true) : str.slice(str.length - len2);
      return str1 + ellipsis + str2;
    default:
      str1 = split ? truncateOnWord(str, length) : str.slice(0, length);
      return str1 + ellipsis;
  }
}

module.exports = truncateString;
},{"../../common/internal/isUndefined":155,"../../common/var/mathAliases":195,"./truncateOnWord":763}],765:[function(require,module,exports){
'use strict';

var HTML_ENTITY_REG = require('../var/HTML_ENTITY_REG'),
    HTMLFromEntityMap = require('../var/HTMLFromEntityMap'),
    chr = require('../../common/var/chr');

function unescapeHTML(str) {
  return str.replace(HTML_ENTITY_REG, function(full, hex, code) {
    var special = HTMLFromEntityMap[code];
    return special || chr(hex ? parseInt(code, 16) : +code);
  });
}

module.exports = unescapeHTML;
},{"../../common/var/chr":191,"../var/HTMLFromEntityMap":796,"../var/HTML_ENTITY_REG":798}],766:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core'),
    trim = require('../common/internal/trim');

Sugar.String.defineInstance({

  'isBlank': function(str) {
    return trim(str).length === 0;
  }

});

module.exports = Sugar.String.isBlank;
},{"../common/internal/trim":177,"sugar-core":809}],767:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core');

Sugar.String.defineInstance({

  'isEmpty': function(str) {
    return str.length === 0;
  }

});

module.exports = Sugar.String.isEmpty;
},{"sugar-core":809}],768:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core'),
    isUndefined = require('../common/internal/isUndefined');

Sugar.String.defineInstance({

  'last': function(str, num) {
    if (isUndefined(num)) num = 1;
    var start = str.length - num < 0 ? 0 : str.length - num;
    return str.substr(start);
  }

});

module.exports = Sugar.String.last;
},{"../common/internal/isUndefined":155,"sugar-core":809}],769:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core'),
    trim = require('../common/internal/trim'),
    stringEach = require('./internal/stringEach');

Sugar.String.defineInstance({

  'lines': function(str, fn) {
    return stringEach(trim(str), /^.*$/gm, fn);
  }

});

module.exports = Sugar.String.lines;
},{"../common/internal/trim":177,"./internal/stringEach":756,"sugar-core":809}],770:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core'),
    padString = require('./internal/padString'),
    mathAliases = require('../common/var/mathAliases'),
    coercePositiveInteger = require('../common/internal/coercePositiveInteger');

var max = mathAliases.max,
    ceil = mathAliases.ceil,
    floor = mathAliases.floor;

Sugar.String.defineInstance({

  'pad': function(str, num, padding) {
    var half, front, back;
    num   = coercePositiveInteger(num);
    half  = max(0, num - str.length) / 2;
    front = floor(half);
    back  = ceil(half);
    return padString(front, padding) + str + padString(back, padding);
  }

});

module.exports = Sugar.String.pad;
},{"../common/internal/coercePositiveInteger":110,"../common/var/mathAliases":195,"./internal/padString":748,"sugar-core":809}],771:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core'),
    padString = require('./internal/padString'),
    mathAliases = require('../common/var/mathAliases'),
    coercePositiveInteger = require('../common/internal/coercePositiveInteger');

var max = mathAliases.max;

Sugar.String.defineInstance({

  'padLeft': function(str, num, padding) {
    num = coercePositiveInteger(num);
    return padString(max(0, num - str.length), padding) + str;
  }

});

module.exports = Sugar.String.padLeft;
},{"../common/internal/coercePositiveInteger":110,"../common/var/mathAliases":195,"./internal/padString":748,"sugar-core":809}],772:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core'),
    padString = require('./internal/padString'),
    mathAliases = require('../common/var/mathAliases'),
    coercePositiveInteger = require('../common/internal/coercePositiveInteger');

var max = mathAliases.max;

Sugar.String.defineInstance({

  'padRight': function(str, num, padding) {
    num = coercePositiveInteger(num);
    return str + padString(max(0, num - str.length), padding);
  }

});

module.exports = Sugar.String.padRight;
},{"../common/internal/coercePositiveInteger":110,"../common/var/mathAliases":195,"./internal/padString":748,"sugar-core":809}],773:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core'),
    stringParameterize = require('./internal/stringParameterize');

Sugar.String.defineInstance({

  'parameterize': function(str, separator) {
    return stringParameterize(str, separator);
  }

});

module.exports = Sugar.String.parameterize;
},{"./internal/stringParameterize":757,"sugar-core":809}],774:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core'),
    PrimitiveRangeConstructor = require('../range/var/PrimitiveRangeConstructor');

Sugar.String.defineStatic({

  'range': PrimitiveRangeConstructor

});

module.exports = Sugar.String.range;
},{"../range/var/PrimitiveRangeConstructor":718,"sugar-core":809}],775:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core');

Sugar.String.defineInstance({

  'remove': function(str, f) {
    return str.replace(f, '');
  }

});

module.exports = Sugar.String.remove;
},{"sugar-core":809}],776:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core'),
    stringReplaceAll = require('./internal/stringReplaceAll');

Sugar.String.defineInstance({

  'removeAll': function(str, f) {
    return stringReplaceAll(str, f);
  }

});

module.exports = Sugar.String.removeAll;
},{"./internal/stringReplaceAll":758,"sugar-core":809}],777:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core'),
    replaceTags = require('./internal/replaceTags');

Sugar.String.defineInstance({

  'removeTags': function(str, tag, replace) {
    return replaceTags(str, tag, replace, false);
  }

});

module.exports = Sugar.String.removeTags;
},{"./internal/replaceTags":749,"sugar-core":809}],778:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core'),
    stringReplaceAll = require('./internal/stringReplaceAll');

Sugar.String.defineInstanceWithArguments({

  'replaceAll': function(str, f, args) {
    return stringReplaceAll(str, f, args);
  }

});

module.exports = Sugar.String.replaceAll;
},{"./internal/stringReplaceAll":758,"sugar-core":809}],779:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core'),
    reverseString = require('./internal/reverseString');

Sugar.String.defineInstance({

  'reverse': function(str) {
    return reverseString(str);
  }

});

module.exports = Sugar.String.reverse;
},{"./internal/reverseString":750,"sugar-core":809}],780:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core'),
    chr = require('../common/var/chr'),
    stringCodes = require('./internal/stringCodes');

Sugar.String.defineInstance({

  'shift': function(str, n) {
    var result = '';
    n = n || 0;
    stringCodes(str, function(c) {
      result += chr(c + n);
    });
    return result;
  }

});

module.exports = Sugar.String.shift;
},{"../common/var/chr":191,"./internal/stringCodes":755,"sugar-core":809}],781:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core'),
    stringSpacify = require('./internal/stringSpacify');

Sugar.String.defineInstance({

  'spacify': function(str) {
    return stringSpacify(str);
  }

});

module.exports = Sugar.String.spacify;
},{"./internal/stringSpacify":759,"sugar-core":809}],782:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core'),
    replaceTags = require('./internal/replaceTags');

Sugar.String.defineInstance({

  'stripTags': function(str, tag, replace) {
    return replaceTags(str, tag, replace, true);
  }

});

module.exports = Sugar.String.stripTags;
},{"./internal/replaceTags":749,"sugar-core":809}],783:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core'),
    stringTitleize = require('./internal/stringTitleize');

Sugar.String.defineInstance({

  'titleize': function(str) {
    return stringTitleize(str);
  }

});

module.exports = Sugar.String.titleize;
},{"./internal/stringTitleize":760,"sugar-core":809}],784:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core'),
    isUndefined = require('../common/internal/isUndefined'),
    numberOrIndex = require('./internal/numberOrIndex');

Sugar.String.defineInstance({

  'to': function(str, to) {
    if (isUndefined(to)) to = str.length;
    return str.slice(0, numberOrIndex(str, to));
  }

});

module.exports = Sugar.String.to;
},{"../common/internal/isUndefined":155,"./internal/numberOrIndex":747,"sugar-core":809}],785:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core'),
    stringToNumber = require('../common/internal/stringToNumber');

Sugar.String.defineInstance({

  'toNumber': function(str, base) {
    return stringToNumber(str, base);
  }

});

module.exports = Sugar.String.toNumber;
},{"../common/internal/stringToNumber":176,"sugar-core":809}],786:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core'),
    LEFT_TRIM_REG = require('./var/LEFT_TRIM_REG');

Sugar.String.defineInstance({

  'trimLeft': function(str) {
    return str.replace(LEFT_TRIM_REG, '');
  }

});

module.exports = Sugar.String.trimLeft;
},{"./var/LEFT_TRIM_REG":801,"sugar-core":809}],787:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core'),
    RIGHT_TRIM_REG = require('./var/RIGHT_TRIM_REG');

Sugar.String.defineInstance({

  'trimRight': function(str) {
    return str.replace(RIGHT_TRIM_REG, '');
  }

});

module.exports = Sugar.String.trimRight;
},{"./var/RIGHT_TRIM_REG":802,"sugar-core":809}],788:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core'),
    truncateString = require('./internal/truncateString');

Sugar.String.defineInstance({

  'truncate': function(str, length, from, ellipsis) {
    return truncateString(str, length, from, ellipsis);
  }

});

module.exports = Sugar.String.truncate;
},{"./internal/truncateString":764,"sugar-core":809}],789:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core'),
    truncateString = require('./internal/truncateString');

Sugar.String.defineInstance({

  'truncateOnWord': function(str, length, from, ellipsis) {
    return truncateString(str, length, from, ellipsis, true);
  }

});

module.exports = Sugar.String.truncateOnWord;
},{"./internal/truncateString":764,"sugar-core":809}],790:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core'),
    stringUnderscore = require('./internal/stringUnderscore');

Sugar.String.defineInstance({

  'underscore': function(str) {
    return stringUnderscore(str);
  }

});

module.exports = Sugar.String.underscore;
},{"./internal/stringUnderscore":761,"sugar-core":809}],791:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core'),
    unescapeHTML = require('./internal/unescapeHTML');

Sugar.String.defineInstance({

  'unescapeHTML': function(str) {
    return unescapeHTML(str);
  }

});

module.exports = Sugar.String.unescapeHTML;
},{"./internal/unescapeHTML":765,"sugar-core":809}],792:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core');

Sugar.String.defineInstance({

  'unescapeURL': function(str, param) {
    return param ? decodeURI(str) : decodeURIComponent(str);
  }

});

module.exports = Sugar.String.unescapeURL;
},{"sugar-core":809}],793:[function(require,module,exports){
'use strict';

module.exports = /(^|_)([^_]+)/g;
},{}],794:[function(require,module,exports){
'use strict';

module.exports = /[^\u0000-\u0040\u005B-\u0060\u007B-\u007F]+('s)?/g;
},{}],795:[function(require,module,exports){
'use strict';

var DOWNCASED_WORDS = [
  'and', 'or', 'nor', 'a', 'an', 'the', 'so', 'but', 'to', 'of', 'at',
  'by', 'from', 'into', 'on', 'onto', 'off', 'out', 'in', 'over',
  'with', 'for'
];

module.exports = DOWNCASED_WORDS;
},{}],796:[function(require,module,exports){
'use strict';

var HTMLFromEntityMap = {
  'lt':    '<',
  'gt':    '>',
  'amp':   '&',
  'nbsp':  ' ',
  'quot':  '"',
  'apos':  "'"
};

module.exports = HTMLFromEntityMap;
},{}],797:[function(require,module,exports){
'use strict';

var HTMLFromEntityMap = require('./HTMLFromEntityMap'),
    coreUtilityAliases = require('../../common/var/coreUtilityAliases');

var forEachProperty = coreUtilityAliases.forEachProperty;

var HTMLToEntityMap;

function buildEntities() {
  HTMLToEntityMap = {};
  forEachProperty(HTMLFromEntityMap, function(val, key) {
    HTMLToEntityMap[val] = '&' + key + ';';
  });
}

buildEntities();

module.exports = HTMLToEntityMap;
},{"../../common/var/coreUtilityAliases":193,"./HTMLFromEntityMap":796}],798:[function(require,module,exports){
'use strict';

module.exports = /&#?(x)?([\w\d]{0,5});/gi;
},{}],799:[function(require,module,exports){
'use strict';

module.exports = /[&<>]/g;
},{}],800:[function(require,module,exports){
'use strict';

var HTML_VOID_ELEMENTS = [
  'area','base','br','col','command','embed','hr','img',
  'input','keygen','link','meta','param','source','track','wbr'
];

module.exports = HTML_VOID_ELEMENTS;
},{}],801:[function(require,module,exports){
'use strict';

var TRIM_CHARS = require('../../common/var/TRIM_CHARS');

module.exports = RegExp('^['+ TRIM_CHARS +']+');
},{"../../common/var/TRIM_CHARS":189}],802:[function(require,module,exports){
'use strict';

var TRIM_CHARS = require('../../common/var/TRIM_CHARS');

module.exports = RegExp('['+ TRIM_CHARS +']+$');
},{"../../common/var/TRIM_CHARS":189}],803:[function(require,module,exports){
'use strict';

module.exports = 'enhanceString';
},{}],804:[function(require,module,exports){
'use strict';

var TRIM_CHARS = require('../../common/var/TRIM_CHARS');

module.exports = RegExp('(?=[' + TRIM_CHARS + '])');
},{"../../common/var/TRIM_CHARS":189}],805:[function(require,module,exports){
(function (Buffer){
'use strict';

var chr = require('../../common/var/chr');

var encodeBase64, decodeBase64;

function buildBase64() {
  var encodeAscii, decodeAscii;

  function catchEncodingError(fn) {
    return function(str) {
      try {
        return fn(str);
      } catch(e) {
        return '';
      }
    };
  }

  if (typeof Buffer !== 'undefined') {
    encodeBase64 = function(str) {
      return new Buffer(str).toString('base64');
    };
    decodeBase64 = function(str) {
      return new Buffer(str, 'base64').toString('utf8');
    };
    return;
  }
  if (typeof btoa !== 'undefined') {
    encodeAscii = catchEncodingError(btoa);
    decodeAscii = catchEncodingError(atob);
  } else {
    var key = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=';
    var base64reg = /[^A-Za-z0-9\+\/\=]/g;
    encodeAscii = function(str) {
      var output = '';
      var chr1, chr2, chr3;
      var enc1, enc2, enc3, enc4;
      var i = 0;
      do {
        chr1 = str.charCodeAt(i++);
        chr2 = str.charCodeAt(i++);
        chr3 = str.charCodeAt(i++);
        enc1 = chr1 >> 2;
        enc2 = ((chr1 & 3) << 4) | (chr2 >> 4);
        enc3 = ((chr2 & 15) << 2) | (chr3 >> 6);
        enc4 = chr3 & 63;
        if (isNaN(chr2)) {
          enc3 = enc4 = 64;
        } else if (isNaN(chr3)) {
          enc4 = 64;
        }
        output += key.charAt(enc1);
        output += key.charAt(enc2);
        output += key.charAt(enc3);
        output += key.charAt(enc4);
        chr1 = chr2 = chr3 = '';
        enc1 = enc2 = enc3 = enc4 = '';
      } while (i < str.length);
      return output;
    };
    decodeAscii = function(input) {
      var output = '';
      var chr1, chr2, chr3;
      var enc1, enc2, enc3, enc4;
      var i = 0;
      if (input.match(base64reg)) {
        return '';
      }
      input = input.replace(/[^A-Za-z0-9\+\/\=]/g, '');
      do {
        enc1 = key.indexOf(input.charAt(i++));
        enc2 = key.indexOf(input.charAt(i++));
        enc3 = key.indexOf(input.charAt(i++));
        enc4 = key.indexOf(input.charAt(i++));
        chr1 = (enc1 << 2) | (enc2 >> 4);
        chr2 = ((enc2 & 15) << 4) | (enc3 >> 2);
        chr3 = ((enc3 & 3) << 6) | enc4;
        output = output + chr(chr1);
        if (enc3 != 64) {
          output = output + chr(chr2);
        }
        if (enc4 != 64) {
          output = output + chr(chr3);
        }
        chr1 = chr2 = chr3 = '';
        enc1 = enc2 = enc3 = enc4 = '';
      } while (i < input.length);
      return output;
    };
  }
  encodeBase64 = function(str) {
    return encodeAscii(unescape(encodeURIComponent(str)));
  };
  decodeBase64 = function(str) {
    return decodeURIComponent(escape(decodeAscii(str)));
  };
}

buildBase64();

module.exports = {
  encodeBase64: encodeBase64,
  decodeBase64: decodeBase64
};
}).call(this,require("buffer").Buffer)
},{"../../common/var/chr":191,"buffer":1604}],806:[function(require,module,exports){
'use strict';

module.exports = String.prototype.includes;
},{}],807:[function(require,module,exports){
'use strict';

var deepGetProperty = require('../../common/internal/deepGetProperty'),
    createFormatMatcher = require('../../common/internal/createFormatMatcher');

module.exports = createFormatMatcher(deepGetProperty);
},{"../../common/internal/createFormatMatcher":114,"../../common/internal/deepGetProperty":116}],808:[function(require,module,exports){
'use strict';

var Sugar = require('sugar-core'),
    trim = require('../common/internal/trim'),
    stringEach = require('./internal/stringEach');

Sugar.String.defineInstance({

  'words': function(str, fn) {
    return stringEach(trim(str), /\S+/g, fn);
  }

});

module.exports = Sugar.String.words;
},{"../common/internal/trim":177,"./internal/stringEach":756,"sugar-core":809}],809:[function(require,module,exports){
(function (global){
/*
 *  Sugar v2.0.4
 *
 *  Freely distributable and licensed under the MIT-style license.
 *  Copyright (c) Andrew Plummer
 *  https://sugarjs.com/
 *
 * ---------------------------- */
(function() {
  'use strict';

  /***
   * @module Core
   * @description Core functionality including the ability to define methods and
   *              extend onto natives.
   *
   ***/

  // The global to export.
  var Sugar;

  // The name of Sugar in the global namespace.
  var SUGAR_GLOBAL = 'Sugar';

  // Natives available on initialization. Letting Object go first to ensure its
  // global is set by the time the rest are checking for chainable Object methods.
  var NATIVE_NAMES = 'Object Number String Array Date RegExp Function';

  // Static method flag
  var STATIC   = 0x1;

  // Instance method flag
  var INSTANCE = 0x2;

  // IE8 has a broken defineProperty but no defineProperties so this saves a try/catch.
  var PROPERTY_DESCRIPTOR_SUPPORT = !!(Object.defineProperty && Object.defineProperties);

  // The global context. Rhino uses a different "global" keyword so
  // do an extra check to be sure that it's actually the global context.
  var globalContext = typeof global !== 'undefined' && global.Object === Object ? global : this;

  // Is the environment node?
  var hasExports = typeof module !== 'undefined' && module.exports;

  // Whether object instance methods can be mapped to the prototype.
  var allowObjectPrototype = false;

  // A map from Array to SugarArray.
  var namespacesByName = {};

  // A map from [object Object] to namespace.
  var namespacesByClassString = {};

  // Defining properties.
  var defineProperty = PROPERTY_DESCRIPTOR_SUPPORT ?  Object.defineProperty : definePropertyShim;

  // A default chainable class for unknown types.
  var DefaultChainable = getNewChainableClass('Chainable');


  // Global methods

  function setupGlobal() {
    Sugar = globalContext[SUGAR_GLOBAL];
    if (Sugar) {
      // Reuse already defined Sugar global object.
      return;
    }
    Sugar = function(arg) {
      forEachProperty(Sugar, function(sugarNamespace, name) {
        // Although only the only enumerable properties on the global
        // object are Sugar namespaces, environments that can't set
        // non-enumerable properties will step through the utility methods
        // as well here, so use this check to only allow true namespaces.
        if (hasOwn(namespacesByName, name)) {
          sugarNamespace.extend(arg);
        }
      });
      return Sugar;
    };
    if (hasExports) {
      module.exports = Sugar;
    } else {
      try {
        globalContext[SUGAR_GLOBAL] = Sugar;
      } catch (e) {
        // Contexts such as QML have a read-only global context.
      }
    }
    forEachProperty(NATIVE_NAMES.split(' '), function(name) {
      createNamespace(name);
    });
    setGlobalProperties();
  }

  /***
   * @method createNamespace(name)
   * @returns SugarNamespace
   * @namespace Sugar
   * @short Creates a new Sugar namespace.
   * @extra This method is for plugin developers who want to define methods to be
   *        used with natives that Sugar does not handle by default. The new
   *        namespace will appear on the `Sugar` global with all the methods of
   *        normal namespaces, including the ability to define new methods. When
   *        extended, any defined methods will be mapped to `name` in the global
   *        context.
   *
   * @example
   *
   *   Sugar.createNamespace('Boolean');
   *
   * @param {string} name - The namespace name.
   *
   ***/
  function createNamespace(name) {

    // Is the current namespace Object?
    var isObject = name === 'Object';

    // A Sugar namespace is also a chainable class: Sugar.Array, etc.
    var sugarNamespace = getNewChainableClass(name, true);

    /***
     * @method extend([opts])
     * @returns Sugar
     * @namespace Sugar
     * @short Extends Sugar defined methods onto natives.
     * @extra This method can be called on individual namespaces like
     *        `Sugar.Array` or on the `Sugar` global itself, in which case
     *        [opts] will be forwarded to each `extend` call. For more,
     *        see `extending`.
     *
     * @options
     *
     *   methods           An array of method names to explicitly extend.
     *
     *   except            An array of method names or global namespaces (`Array`,
     *                     `String`) to explicitly exclude. Namespaces should be the
     *                     actual global objects, not strings.
     *
     *   namespaces        An array of global namespaces (`Array`, `String`) to
     *                     explicitly extend. Namespaces should be the actual
     *                     global objects, not strings.
     *
     *   enhance           A shortcut to disallow all "enhance" flags at once
     *                     (flags listed below). For more, see `enhanced methods`.
     *                     Default is `true`.
     *
     *   enhanceString     A boolean allowing String enhancements. Default is `true`.
     *
     *   enhanceArray      A boolean allowing Array enhancements. Default is `true`.
     *
     *   objectPrototype   A boolean allowing Sugar to extend Object.prototype
     *                     with instance methods. This option is off by default
     *                     and should generally not be used except with caution.
     *                     For more, see `object methods`.
     *
     * @example
     *
     *   Sugar.Array.extend();
     *   Sugar.extend();
     *
     * @option {Array<string>} [methods]
     * @option {Array<string|NativeConstructor>} [except]
     * @option {Array<NativeConstructor>} [namespaces]
     * @option {boolean} [enhance]
     * @option {boolean} [enhanceString]
     * @option {boolean} [enhanceArray]
     * @option {boolean} [objectPrototype]
     * @param {ExtendOptions} [opts]
     *
     ***
     * @method extend([opts])
     * @returns SugarNamespace
     * @namespace SugarNamespace
     * @short Extends Sugar defined methods for a specific namespace onto natives.
     * @param {ExtendOptions} [opts]
     *
     ***/
    var extend = function (opts) {

      var nativeClass = globalContext[name], nativeProto = nativeClass.prototype;
      var staticMethods = {}, instanceMethods = {}, methodsByName;

      function objectRestricted(name, target) {
        return isObject && target === nativeProto &&
               (!allowObjectPrototype || name === 'get' || name === 'set');
      }

      function arrayOptionExists(field, val) {
        var arr = opts[field];
        if (arr) {
          for (var i = 0, el; el = arr[i]; i++) {
            if (el === val) {
              return true;
            }
          }
        }
        return false;
      }

      function arrayOptionExcludes(field, val) {
        return opts[field] && !arrayOptionExists(field, val);
      }

      function disallowedByFlags(methodName, target, flags) {
        // Disallowing methods by flag currently only applies if methods already
        // exist to avoid enhancing native methods, as aliases should still be
        // extended (i.e. Array#all should still be extended even if Array#every
        // is being disallowed by a flag).
        if (!target[methodName] || !flags) {
          return false;
        }
        for (var i = 0; i < flags.length; i++) {
          if (opts[flags[i]] === false) {
            return true;
          }
        }
      }

      function namespaceIsExcepted() {
        return arrayOptionExists('except', nativeClass) ||
               arrayOptionExcludes('namespaces', nativeClass);
      }

      function methodIsExcepted(methodName) {
        return arrayOptionExists('except', methodName);
      }

      function canExtend(methodName, method, target) {
        return !objectRestricted(methodName, target) &&
               !disallowedByFlags(methodName, target, method.flags) &&
               !methodIsExcepted(methodName);
      }

      opts = opts || {};
      methodsByName = opts.methods;

      if (namespaceIsExcepted()) {
        return;
      } else if (isObject && typeof opts.objectPrototype === 'boolean') {
        // Store "objectPrototype" flag for future reference.
        allowObjectPrototype = opts.objectPrototype;
      }

      forEachProperty(methodsByName || sugarNamespace, function(method, methodName) {
        if (methodsByName) {
          // If we have method names passed in an array,
          // then we need to flip the key and value here
          // and find the method in the Sugar namespace.
          methodName = method;
          method = sugarNamespace[methodName];
        }
        if (hasOwn(method, 'instance') && canExtend(methodName, method, nativeProto)) {
          instanceMethods[methodName] = method.instance;
        }
        if(hasOwn(method, 'static') && canExtend(methodName, method, nativeClass)) {
          staticMethods[methodName] = method;
        }
      });

      // Accessing the extend target each time instead of holding a reference as
      // it may have been overwritten (for example Date by Sinon). Also need to
      // access through the global to allow extension of user-defined namespaces.
      extendNative(nativeClass, staticMethods);
      extendNative(nativeProto, instanceMethods);

      if (!methodsByName) {
        // If there are no method names passed, then
        // all methods in the namespace will be extended
        // to the native. This includes all future defined
        // methods, so add a flag here to check later.
        setProperty(sugarNamespace, 'active', true);
      }
      return sugarNamespace;
    };

    function defineWithOptionCollect(methodName, instance, args) {
      setProperty(sugarNamespace, methodName, function(arg1, arg2, arg3) {
        var opts = collectDefineOptions(arg1, arg2, arg3);
        defineMethods(sugarNamespace, opts.methods, instance, args, opts.last);
        return sugarNamespace;
      });
    }

    /***
     * @method defineStatic(methods)
     * @returns SugarNamespace
     * @namespace SugarNamespace
     * @short Defines static methods on the namespace that can later be extended
     *        onto the native globals.
     * @extra Accepts either a single object mapping names to functions, or name
     *        and function as two arguments. If `extend` was previously called
     *        with no arguments, the method will be immediately mapped to its
     *        native when defined.
     *
     * @example
     *
     *   Sugar.Number.defineStatic({
     *     isOdd: function (num) {
     *       return num % 2 === 1;
     *     }
     *   });
     *
     * @signature defineStatic(methodName, methodFn)
     * @param {Object} methods - Methods to be defined.
     * @param {string} methodName - Name of a single method to be defined.
     * @param {Function} methodFn - Function body of a single method to be defined.
     ***/
    defineWithOptionCollect('defineStatic', STATIC);

    /***
     * @method defineInstance(methods)
     * @returns SugarNamespace
     * @namespace SugarNamespace
     * @short Defines methods on the namespace that can later be extended as
     *        instance methods onto the native prototype.
     * @extra Accepts either a single object mapping names to functions, or name
     *        and function as two arguments. All functions should accept the
     *        native for which they are mapped as their first argument, and should
     *        never refer to `this`. If `extend` was previously called with no
     *        arguments, the method will be immediately mapped to its native when
     *        defined.
     *
     *        Methods cannot accept more than 4 arguments in addition to the
     *        native (5 arguments total). Any additional arguments will not be
     *        mapped. If the method needs to accept unlimited arguments, use
     *        `defineInstanceWithArguments`. Otherwise if more options are
     *        required, use an options object instead.
     *
     * @example
     *
     *   Sugar.Number.defineInstance({
     *     square: function (num) {
     *       return num * num;
     *     }
     *   });
     *
     * @signature defineInstance(methodName, methodFn)
     * @param {Object} methods - Methods to be defined.
     * @param {string} methodName - Name of a single method to be defined.
     * @param {Function} methodFn - Function body of a single method to be defined.
     ***/
    defineWithOptionCollect('defineInstance', INSTANCE);

    /***
     * @method defineInstanceAndStatic(methods)
     * @returns SugarNamespace
     * @namespace SugarNamespace
     * @short A shortcut to define both static and instance methods on the namespace.
     * @extra This method is intended for use with `Object` instance methods. Sugar
     *        will not map any methods to `Object.prototype` by default, so defining
     *        instance methods as static helps facilitate their proper use.
     *
     * @example
     *
     *   Sugar.Object.defineInstanceAndStatic({
     *     isAwesome: function (obj) {
     *       // check if obj is awesome!
     *     }
     *   });
     *
     * @signature defineInstanceAndStatic(methodName, methodFn)
     * @param {Object} methods - Methods to be defined.
     * @param {string} methodName - Name of a single method to be defined.
     * @param {Function} methodFn - Function body of a single method to be defined.
     ***/
    defineWithOptionCollect('defineInstanceAndStatic', INSTANCE | STATIC);


    /***
     * @method defineStaticWithArguments(methods)
     * @returns SugarNamespace
     * @namespace SugarNamespace
     * @short Defines static methods that collect arguments.
     * @extra This method is identical to `defineStatic`, except that when defined
     *        methods are called, they will collect any arguments past `n - 1`,
     *        where `n` is the number of arguments that the method accepts.
     *        Collected arguments will be passed to the method in an array
     *        as the last argument defined on the function.
     *
     * @example
     *
     *   Sugar.Number.defineStaticWithArguments({
     *     addAll: function (num, args) {
     *       for (var i = 0; i < args.length; i++) {
     *         num += args[i];
     *       }
     *       return num;
     *     }
     *   });
     *
     * @signature defineStaticWithArguments(methodName, methodFn)
     * @param {Object} methods - Methods to be defined.
     * @param {string} methodName - Name of a single method to be defined.
     * @param {Function} methodFn - Function body of a single method to be defined.
     ***/
    defineWithOptionCollect('defineStaticWithArguments', STATIC, true);

    /***
     * @method defineInstanceWithArguments(methods)
     * @returns SugarNamespace
     * @namespace SugarNamespace
     * @short Defines instance methods that collect arguments.
     * @extra This method is identical to `defineInstance`, except that when
     *        defined methods are called, they will collect any arguments past
     *        `n - 1`, where `n` is the number of arguments that the method
     *        accepts. Collected arguments will be passed to the method as the
     *        last argument defined on the function.
     *
     * @example
     *
     *   Sugar.Number.defineInstanceWithArguments({
     *     addAll: function (num, args) {
     *       for (var i = 0; i < args.length; i++) {
     *         num += args[i];
     *       }
     *       return num;
     *     }
     *   });
     *
     * @signature defineInstanceWithArguments(methodName, methodFn)
     * @param {Object} methods - Methods to be defined.
     * @param {string} methodName - Name of a single method to be defined.
     * @param {Function} methodFn - Function body of a single method to be defined.
     ***/
    defineWithOptionCollect('defineInstanceWithArguments', INSTANCE, true);

    /***
     * @method defineStaticPolyfill(methods)
     * @returns SugarNamespace
     * @namespace SugarNamespace
     * @short Defines static methods that are mapped onto the native if they do
     *        not already exist.
     * @extra Intended only for use creating polyfills that follow the ECMAScript
     *        spec. Accepts either a single object mapping names to functions, or
     *        name and function as two arguments.
     *
     * @example
     *
     *   Sugar.Object.defineStaticPolyfill({
     *     keys: function (obj) {
     *       // get keys!
     *     }
     *   });
     *
     * @signature defineStaticPolyfill(methodName, methodFn)
     * @param {Object} methods - Methods to be defined.
     * @param {string} methodName - Name of a single method to be defined.
     * @param {Function} methodFn - Function body of a single method to be defined.
     ***/
    setProperty(sugarNamespace, 'defineStaticPolyfill', function(arg1, arg2, arg3) {
      var opts = collectDefineOptions(arg1, arg2, arg3);
      extendNative(globalContext[name], opts.methods, true, opts.last);
      return sugarNamespace;
    });

    /***
     * @method defineInstancePolyfill(methods)
     * @returns SugarNamespace
     * @namespace SugarNamespace
     * @short Defines instance methods that are mapped onto the native prototype
     *        if they do not already exist.
     * @extra Intended only for use creating polyfills that follow the ECMAScript
     *        spec. Accepts either a single object mapping names to functions, or
     *        name and function as two arguments. This method differs from
     *        `defineInstance` as there is no static signature (as the method
     *        is mapped as-is to the native), so it should refer to its `this`
     *        object.
     *
     * @example
     *
     *   Sugar.Array.defineInstancePolyfill({
     *     indexOf: function (arr, el) {
     *       // index finding code here!
     *     }
     *   });
     *
     * @signature defineInstancePolyfill(methodName, methodFn)
     * @param {Object} methods - Methods to be defined.
     * @param {string} methodName - Name of a single method to be defined.
     * @param {Function} methodFn - Function body of a single method to be defined.
     ***/
    setProperty(sugarNamespace, 'defineInstancePolyfill', function(arg1, arg2, arg3) {
      var opts = collectDefineOptions(arg1, arg2, arg3);
      extendNative(globalContext[name].prototype, opts.methods, true, opts.last);
      // Map instance polyfills to chainable as well.
      forEachProperty(opts.methods, function(fn, methodName) {
        defineChainableMethod(sugarNamespace, methodName, fn);
      });
      return sugarNamespace;
    });

    /***
     * @method alias(toName, from)
     * @returns SugarNamespace
     * @namespace SugarNamespace
     * @short Aliases one Sugar method to another.
     *
     * @example
     *
     *   Sugar.Array.alias('all', 'every');
     *
     * @signature alias(toName, fn)
     * @param {string} toName - Name for new method.
     * @param {string|Function} from - Method to alias, or string shortcut.
     ***/
    setProperty(sugarNamespace, 'alias', function(name, source) {
      var method = typeof source === 'string' ? sugarNamespace[source] : source;
      setMethod(sugarNamespace, name, method);
      return sugarNamespace;
    });

    // Each namespace can extend only itself through its .extend method.
    setProperty(sugarNamespace, 'extend', extend);

    // Cache the class to namespace relationship for later use.
    namespacesByName[name] = sugarNamespace;
    namespacesByClassString['[object ' + name + ']'] = sugarNamespace;

    mapNativeToChainable(name);
    mapObjectChainablesToNamespace(sugarNamespace);


    // Export
    return Sugar[name] = sugarNamespace;
  }

  function setGlobalProperties() {
    setProperty(Sugar, 'extend', Sugar);
    setProperty(Sugar, 'toString', toString);
    setProperty(Sugar, 'createNamespace', createNamespace);

    setProperty(Sugar, 'util', {
      'hasOwn': hasOwn,
      'getOwn': getOwn,
      'setProperty': setProperty,
      'classToString': classToString,
      'defineProperty': defineProperty,
      'forEachProperty': forEachProperty,
      'mapNativeToChainable': mapNativeToChainable
    });
  }

  function toString() {
    return SUGAR_GLOBAL;
  }


  // Defining Methods

  function defineMethods(sugarNamespace, methods, type, args, flags) {
    forEachProperty(methods, function(method, methodName) {
      var instanceMethod, staticMethod = method;
      if (args) {
        staticMethod = wrapMethodWithArguments(method);
      }
      if (flags) {
        staticMethod.flags = flags;
      }

      // A method may define its own custom implementation, so
      // make sure that's not the case before creating one.
      if (type & INSTANCE && !method.instance) {
        instanceMethod = wrapInstanceMethod(method, args);
        setProperty(staticMethod, 'instance', instanceMethod);
      }

      if (type & STATIC) {
        setProperty(staticMethod, 'static', true);
      }

      setMethod(sugarNamespace, methodName, staticMethod);

      if (sugarNamespace.active) {
        // If the namespace has been activated (.extend has been called),
        // then map this method as well.
        sugarNamespace.extend(methodName);
      }
    });
  }

  function collectDefineOptions(arg1, arg2, arg3) {
    var methods, last;
    if (typeof arg1 === 'string') {
      methods = {};
      methods[arg1] = arg2;
      last = arg3;
    } else {
      methods = arg1;
      last = arg2;
    }
    return {
      last: last,
      methods: methods
    };
  }

  function wrapInstanceMethod(fn, args) {
    return args ? wrapMethodWithArguments(fn, true) : wrapInstanceMethodFixed(fn);
  }

  function wrapMethodWithArguments(fn, instance) {
    // Functions accepting enumerated arguments will always have "args" as the
    // last argument, so subtract one from the function length to get the point
    // at which to start collecting arguments. If this is an instance method on
    // a prototype, then "this" will be pushed into the arguments array so start
    // collecting 1 argument earlier.
    var startCollect = fn.length - 1 - (instance ? 1 : 0);
    return function() {
      var args = [], collectedArgs = [], len;
      if (instance) {
        args.push(this);
      }
      len = Math.max(arguments.length, startCollect);
      // Optimized: no leaking arguments
      for (var i = 0; i < len; i++) {
        if (i < startCollect) {
          args.push(arguments[i]);
        } else {
          collectedArgs.push(arguments[i]);
        }
      }
      args.push(collectedArgs);
      return fn.apply(this, args);
    };
  }

  function wrapInstanceMethodFixed(fn) {
    switch(fn.length) {
      // Wrapped instance methods will always be passed the instance
      // as the first argument, but requiring the argument to be defined
      // may cause confusion here, so return the same wrapped function regardless.
      case 0:
      case 1:
        return function() {
          return fn(this);
        };
      case 2:
        return function(a) {
          return fn(this, a);
        };
      case 3:
        return function(a, b) {
          return fn(this, a, b);
        };
      case 4:
        return function(a, b, c) {
          return fn(this, a, b, c);
        };
      case 5:
        return function(a, b, c, d) {
          return fn(this, a, b, c, d);
        };
    }
  }

  // Method helpers

  function extendNative(target, source, polyfill, override) {
    forEachProperty(source, function(method, name) {
      if (polyfill && !override && target[name]) {
        // Method exists, so bail.
        return;
      }
      setProperty(target, name, method);
    });
  }

  function setMethod(sugarNamespace, methodName, method) {
    sugarNamespace[methodName] = method;
    if (method.instance) {
      defineChainableMethod(sugarNamespace, methodName, method.instance, true);
    }
  }


  // Chainables

  function getNewChainableClass(name) {
    var fn = function SugarChainable(obj, arg) {
      if (!(this instanceof fn)) {
        return new fn(obj, arg);
      }
      if (this.constructor !== fn) {
        // Allow modules to define their own constructors.
        obj = this.constructor.apply(obj, arguments);
      }
      this.raw = obj;
    };
    setProperty(fn, 'toString', function() {
      return SUGAR_GLOBAL + name;
    });
    setProperty(fn.prototype, 'valueOf', function() {
      return this.raw;
    });
    return fn;
  }

  function defineChainableMethod(sugarNamespace, methodName, fn) {
    var wrapped = wrapWithChainableResult(fn), existing, collision, dcp;
    dcp = DefaultChainable.prototype;
    existing = dcp[methodName];

    // If the method was previously defined on the default chainable, then a
    // collision exists, so set the method to a disambiguation function that will
    // lazily evaluate the object and find it's associated chainable. An extra
    // check is required to avoid false positives from Object inherited methods.
    collision = existing && existing !== Object.prototype[methodName];

    // The disambiguation function is only required once.
    if (!existing || !existing.disambiguate) {
      dcp[methodName] = collision ? disambiguateMethod(methodName) : wrapped;
    }

    // The target chainable always receives the wrapped method. Additionally,
    // if the target chainable is Sugar.Object, then map the wrapped method
    // to all other namespaces as well if they do not define their own method
    // of the same name. This way, a Sugar.Number will have methods like
    // isEqual that can be called on any object without having to traverse up
    // the prototype chain and perform disambiguation, which costs cycles.
    // Note that the "if" block below actually does nothing on init as Object
    // goes first and no other namespaces exist yet. However it needs to be
    // here as Object instance methods defined later also need to be mapped
    // back onto existing namespaces.
    sugarNamespace.prototype[methodName] = wrapped;
    if (sugarNamespace === Sugar.Object) {
      mapObjectChainableToAllNamespaces(methodName, wrapped);
    }
  }

  function mapObjectChainablesToNamespace(sugarNamespace) {
    forEachProperty(Sugar.Object && Sugar.Object.prototype, function(val, methodName) {
      if (typeof val === 'function') {
        setObjectChainableOnNamespace(sugarNamespace, methodName, val);
      }
    });
  }

  function mapObjectChainableToAllNamespaces(methodName, fn) {
    forEachProperty(namespacesByName, function(sugarNamespace) {
      setObjectChainableOnNamespace(sugarNamespace, methodName, fn);
    });
  }

  function setObjectChainableOnNamespace(sugarNamespace, methodName, fn) {
    var proto = sugarNamespace.prototype;
    if (!hasOwn(proto, methodName)) {
      proto[methodName] = fn;
    }
  }

  function wrapWithChainableResult(fn) {
    return function() {
      return new DefaultChainable(fn.apply(this.raw, arguments));
    };
  }

  function disambiguateMethod(methodName) {
    var fn = function() {
      var raw = this.raw, sugarNamespace, fn;
      if (raw != null) {
        // Find the Sugar namespace for this unknown.
        sugarNamespace = namespacesByClassString[classToString(raw)];
      }
      if (!sugarNamespace) {
        // If no sugarNamespace can be resolved, then default
        // back to Sugar.Object so that undefined and other
        // non-supported types can still have basic object
        // methods called on them, such as type checks.
        sugarNamespace = Sugar.Object;
      }

      fn = new sugarNamespace(raw)[methodName];

      if (fn.disambiguate) {
        // If the method about to be called on this chainable is
        // itself a disambiguation method, then throw an error to
        // prevent infinite recursion.
        throw new TypeError('Cannot resolve namespace for ' + raw);
      }

      return fn.apply(this, arguments);
    };
    fn.disambiguate = true;
    return fn;
  }

  function mapNativeToChainable(name, methodNames) {
    var sugarNamespace = namespacesByName[name],
        nativeProto = globalContext[name].prototype;

    if (!methodNames && ownPropertyNames) {
      methodNames = ownPropertyNames(nativeProto);
    }

    forEachProperty(methodNames, function(methodName) {
      if (nativeMethodProhibited(methodName)) {
        // Sugar chainables have their own constructors as well as "valueOf"
        // methods, so exclude them here. The __proto__ argument should be trapped
        // by the function check below, however simply accessing this property on
        // Object.prototype causes QML to segfault, so pre-emptively excluding it.
        return;
      }
      try {
        var fn = nativeProto[methodName];
        if (typeof fn !== 'function') {
          // Bail on anything not a function.
          return;
        }
      } catch (e) {
        // Function.prototype has properties that
        // will throw errors when accessed.
        return;
      }
      defineChainableMethod(sugarNamespace, methodName, fn);
    });
  }

  function nativeMethodProhibited(methodName) {
    return methodName === 'constructor' ||
           methodName === 'valueOf' ||
           methodName === '__proto__';
  }


  // Util

  // Internal references
  var ownPropertyNames = Object.getOwnPropertyNames,
      internalToString = Object.prototype.toString,
      internalHasOwnProperty = Object.prototype.hasOwnProperty;

  // Defining this as a variable here as the ES5 module
  // overwrites it to patch DONTENUM.
  var forEachProperty = function (obj, fn) {
    for(var key in obj) {
      if (!hasOwn(obj, key)) continue;
      if (fn.call(obj, obj[key], key, obj) === false) break;
    }
  };

  function definePropertyShim(obj, prop, descriptor) {
    obj[prop] = descriptor.value;
  }

  function setProperty(target, name, value, enumerable) {
    defineProperty(target, name, {
      value: value,
      enumerable: !!enumerable,
      configurable: true,
      writable: true
    });
  }

  // PERF: Attempts to speed this method up get very Heisenbergy. Quickly
  // returning based on typeof works for primitives, but slows down object
  // types. Even === checks on null and undefined (no typeof) will end up
  // basically breaking even. This seems to be as fast as it can go.
  function classToString(obj) {
    return internalToString.call(obj);
  }

  function hasOwn(obj, prop) {
    return !!obj && internalHasOwnProperty.call(obj, prop);
  }

  function getOwn(obj, prop) {
    if (hasOwn(obj, prop)) {
      return obj[prop];
    }
  }

  setupGlobal();

}).call(this);
}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{}],810:[function(require,module,exports){
arguments[4][19][0].apply(exports,arguments)
},{"./internal/arrayAppend":839,"./internal/arrayClone":840,"dup":19,"sugar-core":809}],811:[function(require,module,exports){
arguments[4][20][0].apply(exports,arguments)
},{"./internal/arrayAppend":839,"dup":20,"sugar-core":809}],812:[function(require,module,exports){
arguments[4][21][0].apply(exports,arguments)
},{"../common/internal/getEntriesForIndexes":924,"dup":21,"sugar-core":809}],813:[function(require,module,exports){
arguments[4][22][0].apply(exports,arguments)
},{"../enumerable/internal/average":1199,"dup":22,"sugar-core":809}],814:[function(require,module,exports){
arguments[4][23][0].apply(exports,arguments)
},{"../internal/setArrayChainableConstructor":861,"dup":23}],815:[function(require,module,exports){
arguments[4][24][0].apply(exports,arguments)
},{"./internal/arrayClone":840,"dup":24,"sugar-core":809}],816:[function(require,module,exports){
arguments[4][25][0].apply(exports,arguments)
},{"./internal/arrayCompact":841,"dup":25,"sugar-core":809}],817:[function(require,module,exports){
arguments[4][26][0].apply(exports,arguments)
},{"../common/internal/coercePositiveInteger":901,"dup":26,"sugar-core":809}],818:[function(require,module,exports){
arguments[4][27][0].apply(exports,arguments)
},{"../common/internal/fixArgumentLength":919,"../enumerable/internal/arrayCount":1197,"dup":27,"sugar-core":809}],819:[function(require,module,exports){
arguments[4][28][0].apply(exports,arguments)
},{"./build/setArrayChainableConstructorCall":814,"./internal/arrayCreate":843,"dup":28,"sugar-core":809}],820:[function(require,module,exports){
arguments[4][29][0].apply(exports,arguments)
},{"../common/internal/fixArgumentLength":919,"../common/var/ENHANCEMENTS_FLAG":972,"../enumerable/var/ARRAY_ENHANCEMENTS_FLAG":1219,"../enumerable/var/enhancedMatcherMethods":1221,"dup":29,"sugar-core":809}],821:[function(require,module,exports){
arguments[4][30][0].apply(exports,arguments)
},{"../enumerable/build/buildFromIndexMethodsCall":1195,"dup":30,"sugar-core":809}],822:[function(require,module,exports){
arguments[4][31][0].apply(exports,arguments)
},{"./internal/arrayExclude":844,"dup":31,"sugar-core":809}],823:[function(require,module,exports){
arguments[4][32][0].apply(exports,arguments)
},{"../common/internal/fixArgumentLength":919,"../common/var/ENHANCEMENTS_FLAG":972,"../enumerable/var/ARRAY_ENHANCEMENTS_FLAG":1219,"../enumerable/var/enhancedMatcherMethods":1221,"dup":32,"sugar-core":809}],824:[function(require,module,exports){
arguments[4][33][0].apply(exports,arguments)
},{"../enumerable/build/buildFromIndexMethodsCall":1195,"dup":33,"sugar-core":809}],825:[function(require,module,exports){
arguments[4][34][0].apply(exports,arguments)
},{"../common/internal/fixArgumentLength":919,"../common/var/ENHANCEMENTS_FLAG":972,"../enumerable/var/ARRAY_ENHANCEMENTS_FLAG":1219,"../enumerable/var/enhancedMatcherMethods":1221,"dup":34,"sugar-core":809}],826:[function(require,module,exports){
arguments[4][35][0].apply(exports,arguments)
},{"../enumerable/build/buildFromIndexMethodsCall":1195,"dup":35,"sugar-core":809}],827:[function(require,module,exports){
arguments[4][36][0].apply(exports,arguments)
},{"../common/internal/fixArgumentLength":919,"../common/var/ENHANCEMENTS_FLAG":972,"../enumerable/var/ARRAY_ENHANCEMENTS_FLAG":1219,"../enumerable/var/enhancedMatcherMethods":1221,"dup":36,"sugar-core":809}],828:[function(require,module,exports){
arguments[4][37][0].apply(exports,arguments)
},{"../enumerable/build/buildFromIndexMethodsCall":1195,"dup":37,"sugar-core":809}],829:[function(require,module,exports){
arguments[4][38][0].apply(exports,arguments)
},{"../common/internal/isUndefined":946,"dup":38,"sugar-core":809}],830:[function(require,module,exports){
arguments[4][39][0].apply(exports,arguments)
},{"./internal/arrayFlatten":845,"dup":39,"sugar-core":809}],831:[function(require,module,exports){
arguments[4][40][0].apply(exports,arguments)
},{"../enumerable/build/buildFromIndexMethodsCall":1195,"dup":40,"sugar-core":809}],832:[function(require,module,exports){
arguments[4][41][0].apply(exports,arguments)
},{"dup":41,"sugar-core":809}],833:[function(require,module,exports){
arguments[4][42][0].apply(exports,arguments)
},{"./var/ARRAY_OPTIONS":889,"dup":42,"sugar-core":809}],834:[function(require,module,exports){
arguments[4][43][0].apply(exports,arguments)
},{"./internal/arrayGroupBy":846,"dup":43,"sugar-core":809}],835:[function(require,module,exports){
arguments[4][44][0].apply(exports,arguments)
},{"../common/internal/isDefined":940,"../common/internal/simpleRepeat":965,"../common/var/mathAliases":986,"dup":44,"sugar-core":809}],836:[function(require,module,exports){
arguments[4][45][0].apply(exports,arguments)
},{"../common/internal/isUndefined":946,"../common/internal/simpleRepeat":965,"../common/var/mathAliases":986,"dup":45,"sugar-core":809}],837:[function(require,module,exports){
arguments[4][46][0].apply(exports,arguments)
},{"./add":810,"./append":811,"./at":812,"./clone":815,"./compact":816,"./construct":817,"./create":819,"./exclude":822,"./first":829,"./flatten":830,"./from":832,"./getOption":833,"./groupBy":834,"./inGroups":835,"./inGroupsOf":836,"./insert":838,"./intersect":862,"./isEmpty":863,"./isEqual":864,"./last":865,"./remove":876,"./removeAt":877,"./sample":878,"./setOption":879,"./shuffle":880,"./sortBy":883,"./subtract":884,"./to":886,"./union":887,"./unique":888,"./zip":893,"dup":46,"sugar-core":809}],838:[function(require,module,exports){
arguments[4][47][0].apply(exports,arguments)
},{"./append":811,"dup":47,"sugar-core":809}],839:[function(require,module,exports){
arguments[4][48][0].apply(exports,arguments)
},{"../../common/internal/isDefined":940,"dup":48}],840:[function(require,module,exports){
arguments[4][49][0].apply(exports,arguments)
},{"../../common/internal/forEach":920,"dup":49}],841:[function(require,module,exports){
arguments[4][50][0].apply(exports,arguments)
},{"../../common/internal/filter":918,"dup":50}],842:[function(require,module,exports){
arguments[4][51][0].apply(exports,arguments)
},{"../var/HAS_CONCAT_BUG":892,"./arraySafeConcat":849,"dup":51}],843:[function(require,module,exports){
arguments[4][52][0].apply(exports,arguments)
},{"../../common/internal/isDefined":940,"../../common/internal/isObjectType":942,"../../common/var/classChecks":983,"./arrayClone":840,"./isArrayOrInherited":860,"dup":52}],844:[function(require,module,exports){
arguments[4][53][0].apply(exports,arguments)
},{"../../common/internal/getMatcher":927,"dup":53}],845:[function(require,module,exports){
arguments[4][54][0].apply(exports,arguments)
},{"../../common/internal/forEach":920,"../../common/var/classChecks":983,"dup":54}],846:[function(require,module,exports){
arguments[4][55][0].apply(exports,arguments)
},{"../../common/internal/forEach":920,"../../common/internal/mapWithShortcuts":951,"../../common/var/coreUtilityAliases":984,"dup":55}],847:[function(require,module,exports){
arguments[4][56][0].apply(exports,arguments)
},{"../../common/internal/forEach":920,"../../common/internal/serializeInternal":959,"../../common/var/classChecks":983,"../../common/var/coreUtilityAliases":984,"./arrayWrap":852,"dup":56}],848:[function(require,module,exports){
arguments[4][57][0].apply(exports,arguments)
},{"../../common/internal/getMatcher":927,"dup":57}],849:[function(require,module,exports){
arguments[4][58][0].apply(exports,arguments)
},{"../../common/internal/forEach":920,"../../common/var/classChecks":983,"./arrayClone":840,"dup":58}],850:[function(require,module,exports){
arguments[4][59][0].apply(exports,arguments)
},{"./arrayClone":840,"dup":59}],851:[function(require,module,exports){
arguments[4][60][0].apply(exports,arguments)
},{"../../common/internal/forEach":920,"../../common/internal/mapWithShortcuts":951,"../../common/internal/serializeInternal":959,"../../common/var/coreUtilityAliases":984,"dup":60}],852:[function(require,module,exports){
arguments[4][61][0].apply(exports,arguments)
},{"dup":61}],853:[function(require,module,exports){
arguments[4][62][0].apply(exports,arguments)
},{"../../common/var/CommonChars":971,"../var/FULL_WIDTH_NINE":890,"../var/HALF_WIDTH_NINE":891,"dup":62}],854:[function(require,module,exports){
arguments[4][63][0].apply(exports,arguments)
},{"../../common/var/classChecks":983,"../var/ARRAY_OPTIONS":889,"dup":63}],855:[function(require,module,exports){
arguments[4][64][0].apply(exports,arguments)
},{"../../common/var/coreUtilityAliases":984,"dup":64}],856:[function(require,module,exports){
arguments[4][65][0].apply(exports,arguments)
},{"../../common/var/classChecks":983,"dup":65}],857:[function(require,module,exports){
arguments[4][66][0].apply(exports,arguments)
},{"../../common/internal/forEach":920,"../../common/internal/spaceSplit":966,"dup":66}],858:[function(require,module,exports){
arguments[4][67][0].apply(exports,arguments)
},{"../../common/internal/map":949,"dup":67}],859:[function(require,module,exports){
arguments[4][68][0].apply(exports,arguments)
},{"dup":68}],860:[function(require,module,exports){
arguments[4][69][0].apply(exports,arguments)
},{"../../common/var/classChecks":983,"dup":69}],861:[function(require,module,exports){
arguments[4][70][0].apply(exports,arguments)
},{"../../common/internal/setChainableConstructor":960,"../../common/var/namespaceAliases":988,"./arrayCreate":843,"dup":70}],862:[function(require,module,exports){
arguments[4][71][0].apply(exports,arguments)
},{"./internal/arrayIntersectOrSubtract":847,"dup":71,"sugar-core":809}],863:[function(require,module,exports){
arguments[4][72][0].apply(exports,arguments)
},{"dup":72,"sugar-core":809}],864:[function(require,module,exports){
arguments[4][73][0].apply(exports,arguments)
},{"../common/internal/isEqual":941,"dup":73,"sugar-core":809}],865:[function(require,module,exports){
arguments[4][74][0].apply(exports,arguments)
},{"../common/internal/isUndefined":946,"dup":74,"sugar-core":809}],866:[function(require,module,exports){
arguments[4][75][0].apply(exports,arguments)
},{"../enumerable/internal/getLeastOrMost":1206,"dup":75,"sugar-core":809}],867:[function(require,module,exports){
arguments[4][76][0].apply(exports,arguments)
},{"../common/internal/fixArgumentLength":919,"../common/var/ENHANCEMENTS_FLAG":972,"../enumerable/var/ARRAY_ENHANCEMENTS_FLAG":1219,"../enumerable/var/enhancedMap":1220,"dup":76,"sugar-core":809}],868:[function(require,module,exports){
arguments[4][77][0].apply(exports,arguments)
},{"../enumerable/build/buildFromIndexMethodsCall":1195,"dup":77,"sugar-core":809}],869:[function(require,module,exports){
arguments[4][78][0].apply(exports,arguments)
},{"../enumerable/internal/getMinOrMax":1207,"dup":78,"sugar-core":809}],870:[function(require,module,exports){
arguments[4][79][0].apply(exports,arguments)
},{"../enumerable/internal/median":1209,"dup":79,"sugar-core":809}],871:[function(require,module,exports){
arguments[4][80][0].apply(exports,arguments)
},{"../enumerable/internal/getMinOrMax":1207,"dup":80,"sugar-core":809}],872:[function(require,module,exports){
arguments[4][81][0].apply(exports,arguments)
},{"../enumerable/internal/getLeastOrMost":1206,"dup":81,"sugar-core":809}],873:[function(require,module,exports){
arguments[4][82][0].apply(exports,arguments)
},{"../common/internal/fixArgumentLength":919,"../enumerable/internal/arrayNone":1198,"dup":82,"sugar-core":809}],874:[function(require,module,exports){
arguments[4][83][0].apply(exports,arguments)
},{"../enumerable/build/buildFromIndexMethodsCall":1195,"dup":83,"sugar-core":809}],875:[function(require,module,exports){
arguments[4][84][0].apply(exports,arguments)
},{"../enumerable/build/buildFromIndexMethodsCall":1195,"dup":84,"sugar-core":809}],876:[function(require,module,exports){
arguments[4][85][0].apply(exports,arguments)
},{"./internal/arrayRemove":848,"dup":85,"sugar-core":809}],877:[function(require,module,exports){
arguments[4][86][0].apply(exports,arguments)
},{"../common/internal/isUndefined":946,"dup":86,"sugar-core":809}],878:[function(require,module,exports){
arguments[4][87][0].apply(exports,arguments)
},{"../common/internal/isUndefined":946,"../common/var/classChecks":983,"../common/var/mathAliases":986,"../common/var/trunc":989,"./internal/arrayClone":840,"dup":87,"sugar-core":809}],879:[function(require,module,exports){
arguments[4][88][0].apply(exports,arguments)
},{"./var/ARRAY_OPTIONS":889,"dup":88,"sugar-core":809}],880:[function(require,module,exports){
arguments[4][89][0].apply(exports,arguments)
},{"./internal/arrayShuffle":850,"dup":89,"sugar-core":809}],881:[function(require,module,exports){
arguments[4][90][0].apply(exports,arguments)
},{"../common/internal/fixArgumentLength":919,"../common/var/ENHANCEMENTS_FLAG":972,"../enumerable/var/ARRAY_ENHANCEMENTS_FLAG":1219,"../enumerable/var/enhancedMatcherMethods":1221,"dup":90,"sugar-core":809}],882:[function(require,module,exports){
arguments[4][91][0].apply(exports,arguments)
},{"../enumerable/build/buildFromIndexMethodsCall":1195,"dup":91,"sugar-core":809}],883:[function(require,module,exports){
arguments[4][92][0].apply(exports,arguments)
},{"../common/internal/mapWithShortcuts":951,"./internal/compareValue":854,"dup":92,"sugar-core":809}],884:[function(require,module,exports){
arguments[4][93][0].apply(exports,arguments)
},{"./internal/arrayIntersectOrSubtract":847,"dup":93,"sugar-core":809}],885:[function(require,module,exports){
arguments[4][94][0].apply(exports,arguments)
},{"../enumerable/internal/sum":1216,"dup":94,"sugar-core":809}],886:[function(require,module,exports){
arguments[4][95][0].apply(exports,arguments)
},{"../common/internal/isUndefined":946,"dup":95,"sugar-core":809}],887:[function(require,module,exports){
arguments[4][96][0].apply(exports,arguments)
},{"./internal/arrayConcat":842,"./internal/arrayUnique":851,"dup":96,"sugar-core":809}],888:[function(require,module,exports){
arguments[4][97][0].apply(exports,arguments)
},{"./internal/arrayUnique":851,"dup":97,"sugar-core":809}],889:[function(require,module,exports){
arguments[4][98][0].apply(exports,arguments)
},{"../../common/internal/defineOptionsAccessor":915,"../../common/internal/stringToNumber":967,"../../common/var/namespaceAliases":988,"../internal/codeIsNumeral":853,"../internal/getCollationCharacter":855,"../internal/getCollationReadyString":856,"../internal/getSortEquivalents":857,"../internal/getSortOrder":858,"../internal/getSortOrderIndex":859,"dup":98}],890:[function(require,module,exports){
arguments[4][99][0].apply(exports,arguments)
},{"dup":99}],891:[function(require,module,exports){
arguments[4][100][0].apply(exports,arguments)
},{"dup":100}],892:[function(require,module,exports){
arguments[4][101][0].apply(exports,arguments)
},{"dup":101}],893:[function(require,module,exports){
arguments[4][102][0].apply(exports,arguments)
},{"../common/internal/map":949,"dup":102,"sugar-core":809}],894:[function(require,module,exports){
arguments[4][103][0].apply(exports,arguments)
},{"dup":103}],895:[function(require,module,exports){
arguments[4][104][0].apply(exports,arguments)
},{"dup":104}],896:[function(require,module,exports){
arguments[4][105][0].apply(exports,arguments)
},{"../var/classChecks":983,"dup":105}],897:[function(require,module,exports){
arguments[4][106][0].apply(exports,arguments)
},{"../var/classChecks":983,"dup":106}],898:[function(require,module,exports){
arguments[4][107][0].apply(exports,arguments)
},{"./isPrimitive":944,"dup":107}],899:[function(require,module,exports){
arguments[4][108][0].apply(exports,arguments)
},{"../var/_utc":981,"dup":108}],900:[function(require,module,exports){
arguments[4][109][0].apply(exports,arguments)
},{"../var/_utc":981,"./callDateGet":899,"dup":109}],901:[function(require,module,exports){
arguments[4][110][0].apply(exports,arguments)
},{"../var/classChecks":983,"../var/trunc":989,"dup":110}],902:[function(require,module,exports){
arguments[4][111][0].apply(exports,arguments)
},{"../var/NO_KEYS_IN_STRING_OBJECTS":976,"../var/classChecks":983,"./forceStringCoercion":921,"./isPrimitive":944,"dup":111}],903:[function(require,module,exports){
arguments[4][112][0].apply(exports,arguments)
},{"../var/classChecks":983,"./forEach":920,"./spaceSplit":966,"dup":112}],904:[function(require,module,exports){
arguments[4][113][0].apply(exports,arguments)
},{"../var/CommonChars":971,"dup":113}],905:[function(require,module,exports){
arguments[4][114][0].apply(exports,arguments)
},{"../var/CommonChars":971,"../var/STRING_FORMAT_REG":979,"./memoizeFunction":952,"dup":114}],906:[function(require,module,exports){
arguments[4][115][0].apply(exports,arguments)
},{"dup":115}],907:[function(require,module,exports){
arguments[4][116][0].apply(exports,arguments)
},{"./handleDeepProperty":933,"dup":116}],908:[function(require,module,exports){
arguments[4][117][0].apply(exports,arguments)
},{"./handleDeepProperty":933,"dup":117}],909:[function(require,module,exports){
arguments[4][118][0].apply(exports,arguments)
},{"./handleDeepProperty":933,"dup":118}],910:[function(require,module,exports){
arguments[4][119][0].apply(exports,arguments)
},{"./isEqual":941,"dup":119}],911:[function(require,module,exports){
arguments[4][120][0].apply(exports,arguments)
},{"../var/coreUtilityAliases":984,"dup":120}],912:[function(require,module,exports){
arguments[4][121][0].apply(exports,arguments)
},{"../var/methodDefineAliases":987,"./collectSimilarMethods":903,"dup":121}],913:[function(require,module,exports){
arguments[4][122][0].apply(exports,arguments)
},{"../var/methodDefineAliases":987,"./collectSimilarMethods":903,"dup":122}],914:[function(require,module,exports){
arguments[4][123][0].apply(exports,arguments)
},{"../var/coreUtilityAliases":984,"dup":123}],915:[function(require,module,exports){
arguments[4][124][0].apply(exports,arguments)
},{"../var/coreUtilityAliases":984,"./defineAccessor":911,"./simpleClone":963,"dup":124}],916:[function(require,module,exports){
arguments[4][125][0].apply(exports,arguments)
},{"./getNormalizedIndex":928,"dup":125}],917:[function(require,module,exports){
arguments[4][126][0].apply(exports,arguments)
},{"../var/classChecks":983,"dup":126}],918:[function(require,module,exports){
arguments[4][127][0].apply(exports,arguments)
},{"dup":127}],919:[function(require,module,exports){
arguments[4][128][0].apply(exports,arguments)
},{"dup":128}],920:[function(require,module,exports){
arguments[4][129][0].apply(exports,arguments)
},{"./iterateOverSparseArray":947,"dup":129}],921:[function(require,module,exports){
arguments[4][130][0].apply(exports,arguments)
},{"dup":130}],922:[function(require,module,exports){
arguments[4][131][0].apply(exports,arguments)
},{"dup":131}],923:[function(require,module,exports){
arguments[4][132][0].apply(exports,arguments)
},{"../var/Inflections":974,"dup":132}],924:[function(require,module,exports){
arguments[4][133][0].apply(exports,arguments)
},{"../var/classChecks":983,"./entryAtIndex":916,"./forEach":920,"dup":133}],925:[function(require,module,exports){
arguments[4][134][0].apply(exports,arguments)
},{"../var/Inflections":974,"dup":134}],926:[function(require,module,exports){
arguments[4][135][0].apply(exports,arguments)
},{"dup":135}],927:[function(require,module,exports){
arguments[4][136][0].apply(exports,arguments)
},{"../var/classChecks":983,"../var/coreUtilityAliases":984,"./dateMatcher":906,"./defaultMatcher":910,"./functionMatcher":922,"./isObjectType":942,"./isPlainObject":943,"./isPrimitive":944,"./regexMatcher":956,"dup":136}],928:[function(require,module,exports){
arguments[4][137][0].apply(exports,arguments)
},{"dup":137}],929:[function(require,module,exports){
arguments[4][138][0].apply(exports,arguments)
},{"dup":138}],930:[function(require,module,exports){
arguments[4][139][0].apply(exports,arguments)
},{"../var/coreUtilityAliases":984,"dup":139}],931:[function(require,module,exports){
arguments[4][140][0].apply(exports,arguments)
},{"dup":140}],932:[function(require,module,exports){
arguments[4][141][0].apply(exports,arguments)
},{"./isArrayIndex":938,"dup":141}],933:[function(require,module,exports){
arguments[4][142][0].apply(exports,arguments)
},{"../var/CommonChars":971,"../var/PROPERTY_RANGE_REG":978,"../var/classChecks":983,"../var/coreUtilityAliases":984,"./assertArray":896,"./assertWritable":898,"./isDefined":940,"./isObjectType":942,"./periodSplit":954,"dup":142}],934:[function(require,module,exports){
arguments[4][143][0].apply(exports,arguments)
},{"../var/coreUtilityAliases":984,"dup":143}],935:[function(require,module,exports){
arguments[4][144][0].apply(exports,arguments)
},{"./isPrimitive":944,"dup":144}],936:[function(require,module,exports){
arguments[4][145][0].apply(exports,arguments)
},{"../var/coreUtilityAliases":984,"dup":145}],937:[function(require,module,exports){
arguments[4][146][0].apply(exports,arguments)
},{"dup":146}],938:[function(require,module,exports){
arguments[4][147][0].apply(exports,arguments)
},{"dup":147}],939:[function(require,module,exports){
arguments[4][148][0].apply(exports,arguments)
},{"../var/coreUtilityAliases":984,"dup":148}],940:[function(require,module,exports){
arguments[4][149][0].apply(exports,arguments)
},{"dup":149}],941:[function(require,module,exports){
arguments[4][150][0].apply(exports,arguments)
},{"../var/classChecks":983,"../var/coreUtilityAliases":984,"./getKeys":926,"./isObjectType":942,"./iterateWithCyclicCheck":948,"./mapToArray":950,"./setToArray":961,"dup":150}],942:[function(require,module,exports){
arguments[4][151][0].apply(exports,arguments)
},{"dup":151}],943:[function(require,module,exports){
arguments[4][152][0].apply(exports,arguments)
},{"./hasOwnEnumeratedProperties":934,"./hasValidPlainObjectPrototype":936,"./isClass":939,"./isObjectType":942,"dup":152}],944:[function(require,module,exports){
arguments[4][153][0].apply(exports,arguments)
},{"dup":153}],945:[function(require,module,exports){
arguments[4][154][0].apply(exports,arguments)
},{"dup":154}],946:[function(require,module,exports){
arguments[4][155][0].apply(exports,arguments)
},{"dup":155}],947:[function(require,module,exports){
arguments[4][156][0].apply(exports,arguments)
},{"./getSparseArrayIndexes":932,"dup":156}],948:[function(require,module,exports){
arguments[4][157][0].apply(exports,arguments)
},{"../var/coreUtilityAliases":984,"./getKeys":926,"dup":157}],949:[function(require,module,exports){
arguments[4][158][0].apply(exports,arguments)
},{"dup":158}],950:[function(require,module,exports){
arguments[4][159][0].apply(exports,arguments)
},{"dup":159}],951:[function(require,module,exports){
arguments[4][160][0].apply(exports,arguments)
},{"../var/classChecks":983,"./deepGetProperty":907,"dup":160}],952:[function(require,module,exports){
arguments[4][161][0].apply(exports,arguments)
},{"../var/INTERNAL_MEMOIZE_LIMIT":973,"../var/coreUtilityAliases":984,"dup":161}],953:[function(require,module,exports){
arguments[4][162][0].apply(exports,arguments)
},{"../var/mathAliases":986,"./repeatString":957,"dup":162}],954:[function(require,module,exports){
arguments[4][163][0].apply(exports,arguments)
},{"../var/CommonChars":971,"dup":163}],955:[function(require,module,exports){
arguments[4][164][0].apply(exports,arguments)
},{"../var/PRIVATE_PROP_PREFIX":977,"../var/coreUtilityAliases":984,"dup":164}],956:[function(require,module,exports){
arguments[4][165][0].apply(exports,arguments)
},{"dup":165}],957:[function(require,module,exports){
arguments[4][166][0].apply(exports,arguments)
},{"dup":166}],958:[function(require,module,exports){
arguments[4][167][0].apply(exports,arguments)
},{"../var/Inflections":974,"dup":167}],959:[function(require,module,exports){
arguments[4][168][0].apply(exports,arguments)
},{"../var/classChecks":983,"../var/coreUtilityAliases":984,"./indexOf":937,"./isObjectType":942,"./isPrimitive":944,"./isRealNaN":945,"./iterateWithCyclicCheck":948,"dup":168}],960:[function(require,module,exports){
arguments[4][169][0].apply(exports,arguments)
},{"dup":169}],961:[function(require,module,exports){
arguments[4][170][0].apply(exports,arguments)
},{"dup":170}],962:[function(require,module,exports){
arguments[4][171][0].apply(exports,arguments)
},{"dup":171}],963:[function(require,module,exports){
arguments[4][172][0].apply(exports,arguments)
},{"./simpleMerge":964,"dup":172}],964:[function(require,module,exports){
arguments[4][173][0].apply(exports,arguments)
},{"../var/coreUtilityAliases":984,"dup":173}],965:[function(require,module,exports){
arguments[4][174][0].apply(exports,arguments)
},{"dup":174}],966:[function(require,module,exports){
arguments[4][175][0].apply(exports,arguments)
},{"dup":175}],967:[function(require,module,exports){
arguments[4][176][0].apply(exports,arguments)
},{"../var/CommonChars":971,"../var/coreUtilityAliases":984,"../var/fullwidthNumberHelpers":985,"dup":176}],968:[function(require,module,exports){
arguments[4][177][0].apply(exports,arguments)
},{"dup":177}],969:[function(require,module,exports){
arguments[4][178][0].apply(exports,arguments)
},{"../var/mathAliases":986,"dup":178}],970:[function(require,module,exports){
arguments[4][179][0].apply(exports,arguments)
},{"dup":179}],971:[function(require,module,exports){
arguments[4][180][0].apply(exports,arguments)
},{"dup":180}],972:[function(require,module,exports){
arguments[4][181][0].apply(exports,arguments)
},{"dup":181}],973:[function(require,module,exports){
arguments[4][182][0].apply(exports,arguments)
},{"dup":182}],974:[function(require,module,exports){
arguments[4][183][0].apply(exports,arguments)
},{"dup":183}],975:[function(require,module,exports){
arguments[4][184][0].apply(exports,arguments)
},{"dup":184}],976:[function(require,module,exports){
arguments[4][185][0].apply(exports,arguments)
},{"dup":185}],977:[function(require,module,exports){
arguments[4][186][0].apply(exports,arguments)
},{"dup":186}],978:[function(require,module,exports){
arguments[4][187][0].apply(exports,arguments)
},{"dup":187}],979:[function(require,module,exports){
arguments[4][188][0].apply(exports,arguments)
},{"dup":188}],980:[function(require,module,exports){
arguments[4][189][0].apply(exports,arguments)
},{"dup":189}],981:[function(require,module,exports){
arguments[4][190][0].apply(exports,arguments)
},{"../internal/privatePropertyAccessor":955,"dup":190}],982:[function(require,module,exports){
arguments[4][191][0].apply(exports,arguments)
},{"dup":191}],983:[function(require,module,exports){
arguments[4][192][0].apply(exports,arguments)
},{"../internal/forEach":920,"../internal/isClass":939,"../internal/isPlainObject":943,"../internal/spaceSplit":966,"./NATIVE_TYPES":975,"./coreUtilityAliases":984,"dup":192}],984:[function(require,module,exports){
arguments[4][193][0].apply(exports,arguments)
},{"dup":193,"sugar-core":809}],985:[function(require,module,exports){
arguments[4][194][0].apply(exports,arguments)
},{"../internal/allCharsReg":894,"./CommonChars":971,"./chr":982,"dup":194}],986:[function(require,module,exports){
arguments[4][195][0].apply(exports,arguments)
},{"dup":195}],987:[function(require,module,exports){
arguments[4][196][0].apply(exports,arguments)
},{"../internal/wrapNamespace":970,"dup":196}],988:[function(require,module,exports){
arguments[4][197][0].apply(exports,arguments)
},{"dup":197,"sugar-core":809}],989:[function(require,module,exports){
arguments[4][198][0].apply(exports,arguments)
},{"./mathAliases":986,"dup":198}],990:[function(require,module,exports){
arguments[4][199][0].apply(exports,arguments)
},{"./build/buildDateUnitMethodsCall":1005,"dup":199,"sugar-core":809}],991:[function(require,module,exports){
arguments[4][200][0].apply(exports,arguments)
},{"./build/buildDateUnitMethodsCall":1005,"dup":200,"sugar-core":809}],992:[function(require,module,exports){
arguments[4][201][0].apply(exports,arguments)
},{"./var/LocaleHelpers":1180,"dup":201,"sugar-core":809}],993:[function(require,module,exports){
arguments[4][202][0].apply(exports,arguments)
},{"./build/buildDateUnitMethodsCall":1005,"dup":202,"sugar-core":809}],994:[function(require,module,exports){
arguments[4][203][0].apply(exports,arguments)
},{"./build/buildDateUnitMethodsCall":1005,"dup":203,"sugar-core":809}],995:[function(require,module,exports){
arguments[4][204][0].apply(exports,arguments)
},{"./build/buildDateUnitMethodsCall":1005,"dup":204,"sugar-core":809}],996:[function(require,module,exports){
arguments[4][205][0].apply(exports,arguments)
},{"./build/buildDateUnitMethodsCall":1005,"dup":205,"sugar-core":809}],997:[function(require,module,exports){
arguments[4][206][0].apply(exports,arguments)
},{"./build/buildDateUnitMethodsCall":1005,"dup":206,"sugar-core":809}],998:[function(require,module,exports){
arguments[4][207][0].apply(exports,arguments)
},{"./build/buildDateUnitMethodsCall":1005,"dup":207,"sugar-core":809}],999:[function(require,module,exports){
arguments[4][208][0].apply(exports,arguments)
},{"./internal/advanceDateWithArgs":1037,"dup":208,"sugar-core":809}],1000:[function(require,module,exports){
arguments[4][209][0].apply(exports,arguments)
},{"./build/buildDateUnitMethodsCall":1005,"dup":209,"sugar-core":809}],1001:[function(require,module,exports){
arguments[4][210][0].apply(exports,arguments)
},{"./internal/getWeekday":1084,"./internal/resetTime":1097,"./internal/setWeekday":1103,"dup":210,"sugar-core":809}],1002:[function(require,module,exports){
arguments[4][211][0].apply(exports,arguments)
},{"./build/buildDateUnitMethodsCall":1005,"dup":211,"sugar-core":809}],1003:[function(require,module,exports){
arguments[4][212][0].apply(exports,arguments)
},{"./build/buildDateUnitMethodsCall":1005,"dup":212,"sugar-core":809}],1004:[function(require,module,exports){
arguments[4][213][0].apply(exports,arguments)
},{"./build/buildDateUnitMethodsCall":1005,"dup":213,"sugar-core":809}],1005:[function(require,module,exports){
arguments[4][214][0].apply(exports,arguments)
},{"../internal/buildDateUnitMethods":1040,"dup":214}],1006:[function(require,module,exports){
arguments[4][215][0].apply(exports,arguments)
},{"../internal/buildNumberUnitMethods":1041,"dup":215}],1007:[function(require,module,exports){
arguments[4][216][0].apply(exports,arguments)
},{"../internal/buildRelativeAliases":1042,"dup":216}],1008:[function(require,module,exports){
arguments[4][217][0].apply(exports,arguments)
},{"../internal/setDateChainableConstructor":1099,"dup":217}],1009:[function(require,module,exports){
arguments[4][218][0].apply(exports,arguments)
},{"./internal/cloneDate":1044,"dup":218,"sugar-core":809}],1010:[function(require,module,exports){
arguments[4][219][0].apply(exports,arguments)
},{"./build/setDateChainableConstructorCall":1008,"./internal/createDate":1049,"dup":219,"sugar-core":809}],1011:[function(require,module,exports){
arguments[4][220][0].apply(exports,arguments)
},{"./build/buildDateUnitMethodsCall":1005,"dup":220,"sugar-core":809}],1012:[function(require,module,exports){
arguments[4][221][0].apply(exports,arguments)
},{"./build/buildDateUnitMethodsCall":1005,"dup":221,"sugar-core":809}],1013:[function(require,module,exports){
arguments[4][222][0].apply(exports,arguments)
},{"./internal/getDaysInMonth":1065,"dup":222,"sugar-core":809}],1014:[function(require,module,exports){
arguments[4][223][0].apply(exports,arguments)
},{"./build/buildDateUnitMethodsCall":1005,"dup":223,"sugar-core":809}],1015:[function(require,module,exports){
arguments[4][224][0].apply(exports,arguments)
},{"./build/buildDateUnitMethodsCall":1005,"dup":224,"sugar-core":809}],1016:[function(require,module,exports){
arguments[4][225][0].apply(exports,arguments)
},{"./build/buildDateUnitMethodsCall":1005,"dup":225,"sugar-core":809}],1017:[function(require,module,exports){
arguments[4][226][0].apply(exports,arguments)
},{"./internal/getWeekday":1084,"./internal/moveToEndOfUnit":1093,"./internal/setWeekday":1103,"./var/DateUnitIndexes":1173,"dup":226,"sugar-core":809}],1018:[function(require,module,exports){
arguments[4][227][0].apply(exports,arguments)
},{"./build/buildDateUnitMethodsCall":1005,"dup":227,"sugar-core":809}],1019:[function(require,module,exports){
arguments[4][228][0].apply(exports,arguments)
},{"./build/buildDateUnitMethodsCall":1005,"dup":228,"sugar-core":809}],1020:[function(require,module,exports){
arguments[4][229][0].apply(exports,arguments)
},{"./build/buildDateUnitMethodsCall":1005,"dup":229,"sugar-core":809}],1021:[function(require,module,exports){
arguments[4][230][0].apply(exports,arguments)
},{"./internal/dateFormat":1051,"dup":230,"sugar-core":809}],1022:[function(require,module,exports){
arguments[4][231][0].apply(exports,arguments)
},{"./internal/createDateWithContext":1050,"dup":231,"sugar-core":809}],1023:[function(require,module,exports){
arguments[4][232][0].apply(exports,arguments)
},{"../common/internal/getKeys":926,"./var/LocaleHelpers":1180,"dup":232,"sugar-core":809}],1024:[function(require,module,exports){
arguments[4][233][0].apply(exports,arguments)
},{"./var/LocaleHelpers":1180,"dup":233,"sugar-core":809}],1025:[function(require,module,exports){
arguments[4][234][0].apply(exports,arguments)
},{"./internal/getWeekNumber":1082,"dup":234,"sugar-core":809}],1026:[function(require,module,exports){
arguments[4][235][0].apply(exports,arguments)
},{"./var/LocaleHelpers":1180,"dup":235,"sugar-core":809}],1027:[function(require,module,exports){
arguments[4][236][0].apply(exports,arguments)
},{"./var/_dateOptions":1185,"dup":236,"sugar-core":809}],1028:[function(require,module,exports){
arguments[4][237][0].apply(exports,arguments)
},{"./internal/getUTCOffset":1080,"dup":237,"sugar-core":809}],1029:[function(require,module,exports){
arguments[4][238][0].apply(exports,arguments)
},{"dup":238,"sugar-core":809}],1030:[function(require,module,exports){
arguments[4][239][0].apply(exports,arguments)
},{"./internal/getWeekday":1084,"dup":239,"sugar-core":809}],1031:[function(require,module,exports){
arguments[4][240][0].apply(exports,arguments)
},{"./build/buildDateUnitMethodsCall":1005,"dup":240,"sugar-core":809}],1032:[function(require,module,exports){
arguments[4][241][0].apply(exports,arguments)
},{"./build/buildDateUnitMethodsCall":1005,"dup":241,"sugar-core":809}],1033:[function(require,module,exports){
arguments[4][242][0].apply(exports,arguments)
},{"./build/buildDateUnitMethodsCall":1005,"dup":242,"sugar-core":809}],1034:[function(require,module,exports){
arguments[4][243][0].apply(exports,arguments)
},{"./build/buildDateUnitMethodsCall":1005,"dup":243,"sugar-core":809}],1035:[function(require,module,exports){
arguments[4][244][0].apply(exports,arguments)
},{"../number/day":1258,"../number/dayAfter":1259,"../number/dayAgo":1260,"../number/dayBefore":1261,"../number/dayFromNow":1262,"../number/days":1263,"../number/daysAfter":1264,"../number/daysAgo":1265,"../number/daysBefore":1266,"../number/daysFromNow":1267,"../number/duration":1269,"../number/hour":1275,"../number/hourAfter":1276,"../number/hourAgo":1277,"../number/hourBefore":1278,"../number/hourFromNow":1279,"../number/hours":1280,"../number/hoursAfter":1281,"../number/hoursAgo":1282,"../number/hoursBefore":1283,"../number/hoursFromNow":1284,"../number/millisecond":1298,"../number/millisecondAfter":1299,"../number/millisecondAgo":1300,"../number/millisecondBefore":1301,"../number/millisecondFromNow":1302,"../number/milliseconds":1303,"../number/millisecondsAfter":1304,"../number/millisecondsAgo":1305,"../number/millisecondsBefore":1306,"../number/millisecondsFromNow":1307,"../number/minute":1308,"../number/minuteAfter":1309,"../number/minuteAgo":1310,"../number/minuteBefore":1311,"../number/minuteFromNow":1312,"../number/minutes":1313,"../number/minutesAfter":1314,"../number/minutesAgo":1315,"../number/minutesBefore":1316,"../number/minutesFromNow":1317,"../number/month":1318,"../number/monthAfter":1319,"../number/monthAgo":1320,"../number/monthBefore":1321,"../number/monthFromNow":1322,"../number/months":1323,"../number/monthsAfter":1324,"../number/monthsAgo":1325,"../number/monthsBefore":1326,"../number/monthsFromNow":1327,"../number/second":1334,"../number/secondAfter":1335,"../number/secondAgo":1336,"../number/secondBefore":1337,"../number/secondFromNow":1338,"../number/seconds":1339,"../number/secondsAfter":1340,"../number/secondsAgo":1341,"../number/secondsBefore":1342,"../number/secondsFromNow":1343,"../number/week":1354,"../number/weekAfter":1355,"../number/weekAgo":1356,"../number/weekBefore":1357,"../number/weekFromNow":1358,"../number/weeks":1359,"../number/weeksAfter":1360,"../number/weeksAgo":1361,"../number/weeksBefore":1362,"../number/weeksFromNow":1363,"../number/year":1364,"../number/yearAfter":1365,"../number/yearAgo":1366,"../number/yearBefore":1367,"../number/yearFromNow":1368,"../number/years":1369,"../number/yearsAfter":1370,"../number/yearsAgo":1371,"../number/yearsBefore":1372,"../number/yearsFromNow":1373,"./addDays":990,"./addHours":991,"./addLocale":992,"./addMilliseconds":993,"./addMinutes":994,"./addMonths":995,"./addSeconds":996,"./addWeeks":997,"./addYears":998,"./advance":999,"./beginningOfDay":1000,"./beginningOfISOWeek":1001,"./beginningOfMonth":1002,"./beginningOfWeek":1003,"./beginningOfYear":1004,"./clone":1009,"./create":1010,"./daysAgo":1011,"./daysFromNow":1012,"./daysInMonth":1013,"./daysSince":1014,"./daysUntil":1015,"./endOfDay":1016,"./endOfISOWeek":1017,"./endOfMonth":1018,"./endOfWeek":1019,"./endOfYear":1020,"./format":1021,"./get":1022,"./getAllLocaleCodes":1023,"./getAllLocales":1024,"./getISOWeek":1025,"./getLocale":1026,"./getOption":1027,"./getUTCOffset":1028,"./getUTCWeekday":1029,"./getWeekday":1030,"./hoursAgo":1031,"./hoursFromNow":1032,"./hoursSince":1033,"./hoursUntil":1034,"./is":1108,"./isAfter":1109,"./isBefore":1110,"./isBetween":1111,"./isFriday":1112,"./isFuture":1113,"./isLastMonth":1114,"./isLastWeek":1115,"./isLastYear":1116,"./isLeapYear":1117,"./isMonday":1118,"./isNextMonth":1119,"./isNextWeek":1120,"./isNextYear":1121,"./isPast":1122,"./isSaturday":1123,"./isSunday":1124,"./isThisMonth":1125,"./isThisWeek":1126,"./isThisYear":1127,"./isThursday":1128,"./isToday":1129,"./isTomorrow":1130,"./isTuesday":1131,"./isUTC":1132,"./isValid":1133,"./isWednesday":1134,"./isWeekday":1135,"./isWeekend":1136,"./isYesterday":1137,"./iso":1138,"./millisecondsAgo":1139,"./millisecondsFromNow":1140,"./millisecondsSince":1141,"./millisecondsUntil":1142,"./minutesAgo":1143,"./minutesFromNow":1144,"./minutesSince":1145,"./minutesUntil":1146,"./monthsAgo":1147,"./monthsFromNow":1148,"./monthsSince":1149,"./monthsUntil":1150,"./relative":1152,"./relativeTo":1153,"./removeLocale":1154,"./reset":1155,"./rewind":1156,"./secondsAgo":1157,"./secondsFromNow":1158,"./secondsSince":1159,"./secondsUntil":1160,"./set":1161,"./setISOWeek":1162,"./setLocale":1163,"./setOption":1164,"./setUTC":1165,"./setWeekday":1166,"./weeksAgo":1187,"./weeksFromNow":1188,"./weeksSince":1189,"./weeksUntil":1190,"./yearsAgo":1191,"./yearsFromNow":1192,"./yearsSince":1193,"./yearsUntil":1194,"dup":244,"sugar-core":809}],1036:[function(require,module,exports){
arguments[4][245][0].apply(exports,arguments)
},{"./updateDate":1106,"dup":245}],1037:[function(require,module,exports){
arguments[4][246][0].apply(exports,arguments)
},{"./collectDateArguments":1045,"./updateDate":1106,"dup":246}],1038:[function(require,module,exports){
arguments[4][247][0].apply(exports,arguments)
},{"../../common/internal/escapeRegExp":917,"../../common/internal/map":949,"dup":247}],1039:[function(require,module,exports){
arguments[4][248][0].apply(exports,arguments)
},{"./dateIsValid":1052,"dup":248}],1040:[function(require,module,exports){
arguments[4][249][0].apply(exports,arguments)
},{"../../common/internal/defineInstanceSimilar":913,"../../common/internal/forEach":920,"../../common/internal/simpleCapitalize":962,"../../common/var/namespaceAliases":988,"../var/DateUnitIndexes":1173,"../var/DateUnits":1174,"./advanceDate":1036,"./compareDate":1047,"./createDateWithContext":1050,"./getTimeDistanceForUnit":1079,"./moveToBeginningOfUnit":1091,"./moveToEndOfUnit":1093,"dup":249}],1041:[function(require,module,exports){
arguments[4][250][0].apply(exports,arguments)
},{"../../common/internal/defineInstanceSimilar":913,"../../common/var/mathAliases":986,"../../common/var/namespaceAliases":988,"../var/DateUnits":1174,"./advanceDate":1036,"./createDate":1049,"dup":250}],1042:[function(require,module,exports){
arguments[4][251][0].apply(exports,arguments)
},{"../../common/internal/defineInstanceSimilar":913,"../../common/internal/spaceSplit":966,"../../common/var/namespaceAliases":988,"../var/LocaleHelpers":1180,"./fullCompareDate":1056,"dup":251}],1043:[function(require,module,exports){
arguments[4][252][0].apply(exports,arguments)
},{"../../common/internal/callDateSet":900,"./setISOWeekNumber":1100,"dup":252}],1044:[function(require,module,exports){
arguments[4][253][0].apply(exports,arguments)
},{"../../common/var/_utc":981,"dup":253}],1045:[function(require,module,exports){
arguments[4][254][0].apply(exports,arguments)
},{"../../common/internal/isObjectType":942,"../../common/internal/simpleClone":963,"../../common/var/classChecks":983,"./collectDateParamsFromArguments":1046,"./getDateParamsFromString":1064,"dup":254}],1046:[function(require,module,exports){
arguments[4][255][0].apply(exports,arguments)
},{"../../common/internal/isDefined":940,"../var/DateUnitIndexes":1173,"./walkUnitDown":1107,"dup":255}],1047:[function(require,module,exports){
arguments[4][256][0].apply(exports,arguments)
},{"../../common/internal/isDefined":940,"../../common/var/_utc":981,"../var/DateUnitIndexes":1173,"../var/DateUnits":1174,"../var/MINUTES":1182,"./advanceDate":1036,"./cloneDate":1044,"./dateIsValid":1052,"./getExtendedDate":1068,"./moveToBeginningOfUnit":1091,"./moveToEndOfUnit":1093,"./tzOffset":1105,"dup":256}],1048:[function(require,module,exports){
arguments[4][257][0].apply(exports,arguments)
},{"./getDate":1061,"./getMonth":1073,"./getNewDate":1074,"./getYear":1085,"./setDate":1098,"dup":257}],1049:[function(require,module,exports){
arguments[4][258][0].apply(exports,arguments)
},{"./getExtendedDate":1068,"dup":258}],1050:[function(require,module,exports){
arguments[4][259][0].apply(exports,arguments)
},{"./getExtendedDate":1068,"dup":259}],1051:[function(require,module,exports){
arguments[4][260][0].apply(exports,arguments)
},{"../var/CoreOutputFormats":1170,"../var/formattingTokens":1186,"./assertDateIsValid":1039,"dup":260}],1052:[function(require,module,exports){
arguments[4][261][0].apply(exports,arguments)
},{"dup":261}],1053:[function(require,module,exports){
arguments[4][262][0].apply(exports,arguments)
},{"../../common/var/classChecks":983,"../var/LocaleHelpers":1180,"./assertDateIsValid":1039,"./dateFormat":1051,"./getAdjustedUnitForDate":1058,"dup":262}],1054:[function(require,module,exports){
arguments[4][263][0].apply(exports,arguments)
},{"dup":263}],1055:[function(require,module,exports){
arguments[4][264][0].apply(exports,arguments)
},{"./getDateParamKey":1063,"dup":264}],1056:[function(require,module,exports){
arguments[4][265][0].apply(exports,arguments)
},{"../../common/internal/isDefined":940,"../../common/internal/trim":968,"../../common/var/classChecks":983,"../var/LocaleHelpers":1180,"./compareDate":1047,"./compareDay":1048,"./dateIsValid":1052,"./getMonth":1073,"./getNewDate":1074,"./getWeekday":1084,"dup":265}],1057:[function(require,module,exports){
arguments[4][266][0].apply(exports,arguments)
},{"../../common/var/mathAliases":986,"./iterateOverDateUnits":1089,"dup":266}],1058:[function(require,module,exports){
arguments[4][267][0].apply(exports,arguments)
},{"../../common/var/mathAliases":986,"./getAdjustedUnit":1057,"./getNewDate":1074,"./getTimeDistanceForUnit":1079,"dup":267}],1059:[function(require,module,exports){
arguments[4][268][0].apply(exports,arguments)
},{"../../common/internal/withPrecision":969,"../../common/var/trunc":989,"./getAdjustedUnit":1057,"dup":268}],1060:[function(require,module,exports){
arguments[4][269][0].apply(exports,arguments)
},{"dup":269}],1061:[function(require,module,exports){
arguments[4][270][0].apply(exports,arguments)
},{"../../common/internal/callDateGet":899,"dup":270}],1062:[function(require,module,exports){
arguments[4][271][0].apply(exports,arguments)
},{"../../common/var/coreUtilityAliases":984,"./getDateParamKey":1063,"dup":271}],1063:[function(require,module,exports){
arguments[4][272][0].apply(exports,arguments)
},{"../../common/internal/getOwnKey":930,"dup":272}],1064:[function(require,module,exports){
arguments[4][273][0].apply(exports,arguments)
},{"../../common/internal/isUndefined":946,"dup":273}],1065:[function(require,module,exports){
arguments[4][274][0].apply(exports,arguments)
},{"../../common/internal/callDateGet":899,"./getMonth":1073,"./getYear":1085,"dup":274}],1066:[function(require,module,exports){
arguments[4][275][0].apply(exports,arguments)
},{"../var/DateUnitIndexes":1173,"../var/DateUnits":1174,"./getTimeDistanceForUnit":1079,"dup":275}],1067:[function(require,module,exports){
arguments[4][276][0].apply(exports,arguments)
},{"../../common/internal/simpleClone":963,"../../common/internal/simpleMerge":964,"../var/EnglishLocaleBaseDefinition":1175,"dup":276}],1068:[function(require,module,exports){
arguments[4][277][0].apply(exports,arguments)
},{"../../common/internal/forEach":920,"../../common/internal/isDefined":940,"../../common/internal/isObjectType":942,"../../common/internal/isUndefined":946,"../../common/internal/simpleClone":963,"../../common/var/_utc":981,"../../common/var/classChecks":983,"../../common/var/coreUtilityAliases":984,"../../common/var/trunc":989,"../var/DateUnitIndexes":1173,"../var/LocaleHelpers":1180,"../var/MINUTES":1182,"../var/ParsingTokens":1183,"./advanceDate":1036,"./deleteDateParam":1055,"./getNewDate":1074,"./getParsingTokenValue":1076,"./getYearFromAbbreviation":1086,"./iterateOverDateParams":1088,"./iterateOverHigherDateParams":1090,"./moveToBeginningOfUnit":1091,"./moveToEndOfUnit":1093,"./resetTime":1097,"./setWeekday":1103,"./tzOffset":1105,"./updateDate":1106,"dup":277}],1069:[function(require,module,exports){
arguments[4][278][0].apply(exports,arguments)
},{"../var/DateUnitIndexes":1173,"dup":278}],1070:[function(require,module,exports){
arguments[4][279][0].apply(exports,arguments)
},{"../../common/internal/callDateGet":899,"dup":279}],1071:[function(require,module,exports){
arguments[4][280][0].apply(exports,arguments)
},{"../var/DateUnitIndexes":1173,"dup":280}],1072:[function(require,module,exports){
arguments[4][281][0].apply(exports,arguments)
},{"../../common/var/trunc":989,"../var/LocaleHelpers":1180,"./getHours":1070,"dup":281}],1073:[function(require,module,exports){
arguments[4][282][0].apply(exports,arguments)
},{"../../common/internal/callDateGet":899,"dup":282}],1074:[function(require,module,exports){
arguments[4][283][0].apply(exports,arguments)
},{"../var/_dateOptions":1185,"dup":283}],1075:[function(require,module,exports){
arguments[4][284][0].apply(exports,arguments)
},{"../../common/internal/commaSplit":904,"../../common/internal/filter":918,"../../common/internal/forEach":920,"../../common/internal/getOrdinalSuffix":929,"../../common/internal/isDefined":940,"../../common/internal/isUndefined":946,"../../common/internal/map":949,"../../common/internal/simpleMerge":964,"../../common/var/classChecks":983,"../../common/var/coreUtilityAliases":984,"../../common/var/fullwidthNumberHelpers":985,"../../common/var/mathAliases":986,"../var/CoreParsingFormats":1171,"../var/ISODefaults":1177,"../var/LOCALE_ARRAY_FIELDS":1178,"../var/LocalizedParsingTokens":1181,"../var/ParsingTokens":1183,"./arrayToRegAlternates":1038,"./getAdjustedUnitForNumber":1059,"./getArrayWithOffset":1060,"./getParsingTokenWithSuffix":1077,"./getRegNonCapturing":1078,"./iterateOverDateUnits":1089,"dup":284}],1076:[function(require,module,exports){
arguments[4][285][0].apply(exports,arguments)
},{"dup":285}],1077:[function(require,module,exports){
arguments[4][286][0].apply(exports,arguments)
},{"../var/LocalizedParsingTokens":1181,"./getRegNonCapturing":1078,"dup":286}],1078:[function(require,module,exports){
arguments[4][287][0].apply(exports,arguments)
},{"dup":287}],1079:[function(require,module,exports){
arguments[4][288][0].apply(exports,arguments)
},{"../../common/var/trunc":989,"./advanceDate":1036,"./cloneDate":1044,"dup":288}],1080:[function(require,module,exports){
arguments[4][289][0].apply(exports,arguments)
},{"../../common/internal/padNumber":953,"../../common/var/_utc":981,"../../common/var/mathAliases":986,"../../common/var/trunc":989,"./tzOffset":1105,"dup":289}],1081:[function(require,module,exports){
arguments[4][290][0].apply(exports,arguments)
},{"./iterateOverDateParams":1088,"dup":290}],1082:[function(require,module,exports){
arguments[4][291][0].apply(exports,arguments)
},{"../../common/internal/isUndefined":946,"../var/ISODefaults":1177,"./cloneDate":1044,"./getDate":1061,"./moveToBeginningOfWeek":1092,"./moveToEndOfWeek":1094,"./moveToFirstDayOfWeekYear":1095,"./setDate":1098,"dup":291}],1083:[function(require,module,exports){
arguments[4][292][0].apply(exports,arguments)
},{"../var/LocaleHelpers":1180,"./getMonth":1073,"./getWeekNumber":1082,"./getYear":1085,"dup":292}],1084:[function(require,module,exports){
arguments[4][293][0].apply(exports,arguments)
},{"../../common/internal/callDateGet":899,"dup":293}],1085:[function(require,module,exports){
arguments[4][294][0].apply(exports,arguments)
},{"../../common/internal/callDateGet":899,"dup":294}],1086:[function(require,module,exports){
arguments[4][295][0].apply(exports,arguments)
},{"../../common/var/mathAliases":986,"./getYear":1085,"dup":295}],1087:[function(require,module,exports){
arguments[4][296][0].apply(exports,arguments)
},{"../../common/var/_utc":981,"./tzOffset":1105,"dup":296}],1088:[function(require,module,exports){
arguments[4][297][0].apply(exports,arguments)
},{"../../common/internal/isDefined":940,"../var/DateUnitIndexes":1173,"./getDateParam":1062,"./iterateOverDateUnits":1089,"dup":297}],1089:[function(require,module,exports){
arguments[4][298][0].apply(exports,arguments)
},{"../../common/internal/isUndefined":946,"../var/DateUnitIndexes":1173,"../var/DateUnits":1174,"dup":298}],1090:[function(require,module,exports){
arguments[4][299][0].apply(exports,arguments)
},{"../var/DateUnitIndexes":1173,"./iterateOverDateParams":1088,"dup":299}],1091:[function(require,module,exports){
arguments[4][300][0].apply(exports,arguments)
},{"../var/DateUnitIndexes":1173,"../var/LocaleHelpers":1180,"./getLowerUnitIndex":1071,"./moveToBeginningOfWeek":1092,"./setUnitAndLowerToEdge":1102,"dup":300}],1092:[function(require,module,exports){
arguments[4][301][0].apply(exports,arguments)
},{"../../common/var/mathAliases":986,"./getWeekday":1084,"./setWeekday":1103,"dup":301}],1093:[function(require,module,exports){
arguments[4][302][0].apply(exports,arguments)
},{"../var/DateUnitIndexes":1173,"../var/LocaleHelpers":1180,"./getLowerUnitIndex":1071,"./moveToEndOfWeek":1094,"./setUnitAndLowerToEdge":1102,"dup":302}],1094:[function(require,module,exports){
arguments[4][303][0].apply(exports,arguments)
},{"../../common/var/mathAliases":986,"./getWeekday":1084,"./setWeekday":1103,"dup":303}],1095:[function(require,module,exports){
arguments[4][304][0].apply(exports,arguments)
},{"../var/DateUnitIndexes":1173,"./moveToBeginningOfWeek":1092,"./setDate":1098,"./setUnitAndLowerToEdge":1102,"dup":304}],1096:[function(require,module,exports){
arguments[4][305][0].apply(exports,arguments)
},{"./getLowerUnitIndex":1071,"./setUnitAndLowerToEdge":1102,"dup":305}],1097:[function(require,module,exports){
arguments[4][306][0].apply(exports,arguments)
},{"../var/DateUnitIndexes":1173,"./setUnitAndLowerToEdge":1102,"dup":306}],1098:[function(require,module,exports){
arguments[4][307][0].apply(exports,arguments)
},{"../../common/internal/callDateSet":900,"dup":307}],1099:[function(require,module,exports){
arguments[4][308][0].apply(exports,arguments)
},{"../../common/internal/setChainableConstructor":960,"../../common/var/namespaceAliases":988,"./createDate":1049,"dup":308}],1100:[function(require,module,exports){
arguments[4][309][0].apply(exports,arguments)
},{"../../common/var/classChecks":983,"../var/ISODefaults":1177,"./cloneDate":1044,"./getDate":1061,"./getMonth":1073,"./getWeekday":1084,"./getYear":1085,"./moveToFirstDayOfWeekYear":1095,"./setDate":1098,"./setMonth":1101,"./setWeekday":1103,"./setYear":1104,"dup":309}],1101:[function(require,module,exports){
arguments[4][310][0].apply(exports,arguments)
},{"../../common/internal/callDateSet":900,"dup":310}],1102:[function(require,module,exports){
arguments[4][311][0].apply(exports,arguments)
},{"../../common/internal/callDateSet":900,"../../common/internal/isDefined":940,"../../common/var/classChecks":983,"./walkUnitDown":1107,"dup":311}],1103:[function(require,module,exports){
arguments[4][312][0].apply(exports,arguments)
},{"../../common/var/classChecks":983,"../../common/var/mathAliases":986,"./getDate":1061,"./getWeekday":1084,"./setDate":1098,"dup":312}],1104:[function(require,module,exports){
arguments[4][313][0].apply(exports,arguments)
},{"../../common/internal/callDateSet":900,"dup":313}],1105:[function(require,module,exports){
arguments[4][314][0].apply(exports,arguments)
},{"dup":314}],1106:[function(require,module,exports){
arguments[4][315][0].apply(exports,arguments)
},{"../../common/internal/callDateGet":899,"../../common/var/classChecks":983,"../../common/var/mathAliases":986,"../../common/var/trunc":989,"../var/DateUnitIndexes":1173,"../var/DateUnits":1174,"./callDateSetWithWeek":1043,"./getDate":1061,"./getHigherUnitIndex":1069,"./getLowerUnitIndex":1071,"./getMonth":1073,"./getNewDate":1074,"./iterateOverDateParams":1088,"./resetLowerUnits":1096,"./setDate":1098,"./setWeekday":1103,"dup":315}],1107:[function(require,module,exports){
arguments[4][316][0].apply(exports,arguments)
},{"../var/DateUnits":1174,"./getLowerUnitIndex":1071,"dup":316}],1108:[function(require,module,exports){
arguments[4][317][0].apply(exports,arguments)
},{"./internal/fullCompareDate":1056,"dup":317,"sugar-core":809}],1109:[function(require,module,exports){
arguments[4][318][0].apply(exports,arguments)
},{"./internal/createDate":1049,"dup":318,"sugar-core":809}],1110:[function(require,module,exports){
arguments[4][319][0].apply(exports,arguments)
},{"./internal/createDate":1049,"dup":319,"sugar-core":809}],1111:[function(require,module,exports){
arguments[4][320][0].apply(exports,arguments)
},{"../common/var/mathAliases":986,"./internal/createDate":1049,"dup":320,"sugar-core":809}],1112:[function(require,module,exports){
arguments[4][321][0].apply(exports,arguments)
},{"./build/buildRelativeAliasesCall":1007,"dup":321,"sugar-core":809}],1113:[function(require,module,exports){
arguments[4][322][0].apply(exports,arguments)
},{"./build/buildRelativeAliasesCall":1007,"dup":322,"sugar-core":809}],1114:[function(require,module,exports){
arguments[4][323][0].apply(exports,arguments)
},{"./build/buildDateUnitMethodsCall":1005,"dup":323,"sugar-core":809}],1115:[function(require,module,exports){
arguments[4][324][0].apply(exports,arguments)
},{"./build/buildDateUnitMethodsCall":1005,"dup":324,"sugar-core":809}],1116:[function(require,module,exports){
arguments[4][325][0].apply(exports,arguments)
},{"./build/buildDateUnitMethodsCall":1005,"dup":325,"sugar-core":809}],1117:[function(require,module,exports){
arguments[4][326][0].apply(exports,arguments)
},{"./internal/getYear":1085,"dup":326,"sugar-core":809}],1118:[function(require,module,exports){
arguments[4][327][0].apply(exports,arguments)
},{"./build/buildRelativeAliasesCall":1007,"dup":327,"sugar-core":809}],1119:[function(require,module,exports){
arguments[4][328][0].apply(exports,arguments)
},{"./build/buildDateUnitMethodsCall":1005,"dup":328,"sugar-core":809}],1120:[function(require,module,exports){
arguments[4][329][0].apply(exports,arguments)
},{"./build/buildDateUnitMethodsCall":1005,"dup":329,"sugar-core":809}],1121:[function(require,module,exports){
arguments[4][330][0].apply(exports,arguments)
},{"./build/buildDateUnitMethodsCall":1005,"dup":330,"sugar-core":809}],1122:[function(require,module,exports){
arguments[4][331][0].apply(exports,arguments)
},{"./build/buildRelativeAliasesCall":1007,"dup":331,"sugar-core":809}],1123:[function(require,module,exports){
arguments[4][332][0].apply(exports,arguments)
},{"./build/buildRelativeAliasesCall":1007,"dup":332,"sugar-core":809}],1124:[function(require,module,exports){
arguments[4][333][0].apply(exports,arguments)
},{"./build/buildRelativeAliasesCall":1007,"dup":333,"sugar-core":809}],1125:[function(require,module,exports){
arguments[4][334][0].apply(exports,arguments)
},{"./build/buildDateUnitMethodsCall":1005,"dup":334,"sugar-core":809}],1126:[function(require,module,exports){
arguments[4][335][0].apply(exports,arguments)
},{"./build/buildDateUnitMethodsCall":1005,"dup":335,"sugar-core":809}],1127:[function(require,module,exports){
arguments[4][336][0].apply(exports,arguments)
},{"./build/buildDateUnitMethodsCall":1005,"dup":336,"sugar-core":809}],1128:[function(require,module,exports){
arguments[4][337][0].apply(exports,arguments)
},{"./build/buildRelativeAliasesCall":1007,"dup":337,"sugar-core":809}],1129:[function(require,module,exports){
arguments[4][338][0].apply(exports,arguments)
},{"./build/buildRelativeAliasesCall":1007,"dup":338,"sugar-core":809}],1130:[function(require,module,exports){
arguments[4][339][0].apply(exports,arguments)
},{"./build/buildRelativeAliasesCall":1007,"dup":339,"sugar-core":809}],1131:[function(require,module,exports){
arguments[4][340][0].apply(exports,arguments)
},{"./build/buildRelativeAliasesCall":1007,"dup":340,"sugar-core":809}],1132:[function(require,module,exports){
arguments[4][341][0].apply(exports,arguments)
},{"./internal/isUTC":1087,"dup":341,"sugar-core":809}],1133:[function(require,module,exports){
arguments[4][342][0].apply(exports,arguments)
},{"./internal/dateIsValid":1052,"dup":342,"sugar-core":809}],1134:[function(require,module,exports){
arguments[4][343][0].apply(exports,arguments)
},{"./build/buildRelativeAliasesCall":1007,"dup":343,"sugar-core":809}],1135:[function(require,module,exports){
arguments[4][344][0].apply(exports,arguments)
},{"./build/buildRelativeAliasesCall":1007,"dup":344,"sugar-core":809}],1136:[function(require,module,exports){
arguments[4][345][0].apply(exports,arguments)
},{"./build/buildRelativeAliasesCall":1007,"dup":345,"sugar-core":809}],1137:[function(require,module,exports){
arguments[4][346][0].apply(exports,arguments)
},{"./build/buildRelativeAliasesCall":1007,"dup":346,"sugar-core":809}],1138:[function(require,module,exports){
arguments[4][347][0].apply(exports,arguments)
},{"dup":347,"sugar-core":809}],1139:[function(require,module,exports){
arguments[4][348][0].apply(exports,arguments)
},{"./build/buildDateUnitMethodsCall":1005,"dup":348,"sugar-core":809}],1140:[function(require,module,exports){
arguments[4][349][0].apply(exports,arguments)
},{"./build/buildDateUnitMethodsCall":1005,"dup":349,"sugar-core":809}],1141:[function(require,module,exports){
arguments[4][350][0].apply(exports,arguments)
},{"./build/buildDateUnitMethodsCall":1005,"dup":350,"sugar-core":809}],1142:[function(require,module,exports){
arguments[4][351][0].apply(exports,arguments)
},{"./build/buildDateUnitMethodsCall":1005,"dup":351,"sugar-core":809}],1143:[function(require,module,exports){
arguments[4][352][0].apply(exports,arguments)
},{"./build/buildDateUnitMethodsCall":1005,"dup":352,"sugar-core":809}],1144:[function(require,module,exports){
arguments[4][353][0].apply(exports,arguments)
},{"./build/buildDateUnitMethodsCall":1005,"dup":353,"sugar-core":809}],1145:[function(require,module,exports){
arguments[4][354][0].apply(exports,arguments)
},{"./build/buildDateUnitMethodsCall":1005,"dup":354,"sugar-core":809}],1146:[function(require,module,exports){
arguments[4][355][0].apply(exports,arguments)
},{"./build/buildDateUnitMethodsCall":1005,"dup":355,"sugar-core":809}],1147:[function(require,module,exports){
arguments[4][356][0].apply(exports,arguments)
},{"./build/buildDateUnitMethodsCall":1005,"dup":356,"sugar-core":809}],1148:[function(require,module,exports){
arguments[4][357][0].apply(exports,arguments)
},{"./build/buildDateUnitMethodsCall":1005,"dup":357,"sugar-core":809}],1149:[function(require,module,exports){
arguments[4][358][0].apply(exports,arguments)
},{"./build/buildDateUnitMethodsCall":1005,"dup":358,"sugar-core":809}],1150:[function(require,module,exports){
arguments[4][359][0].apply(exports,arguments)
},{"./build/buildDateUnitMethodsCall":1005,"dup":359,"sugar-core":809}],1151:[function(require,module,exports){
arguments[4][360][0].apply(exports,arguments)
},{"../range/var/DateRangeConstructor":1505,"dup":360,"sugar-core":809}],1152:[function(require,module,exports){
arguments[4][361][0].apply(exports,arguments)
},{"./internal/dateRelative":1053,"dup":361,"sugar-core":809}],1153:[function(require,module,exports){
arguments[4][362][0].apply(exports,arguments)
},{"./internal/createDate":1049,"./internal/dateRelative":1053,"dup":362,"sugar-core":809}],1154:[function(require,module,exports){
arguments[4][363][0].apply(exports,arguments)
},{"./var/LocaleHelpers":1180,"dup":363,"sugar-core":809}],1155:[function(require,module,exports){
arguments[4][364][0].apply(exports,arguments)
},{"./internal/getUnitIndexForParamName":1081,"./internal/moveToBeginningOfUnit":1091,"./var/DateUnitIndexes":1173,"dup":364,"sugar-core":809}],1156:[function(require,module,exports){
arguments[4][365][0].apply(exports,arguments)
},{"./internal/advanceDateWithArgs":1037,"dup":365,"sugar-core":809}],1157:[function(require,module,exports){
arguments[4][366][0].apply(exports,arguments)
},{"./build/buildDateUnitMethodsCall":1005,"dup":366,"sugar-core":809}],1158:[function(require,module,exports){
arguments[4][367][0].apply(exports,arguments)
},{"./build/buildDateUnitMethodsCall":1005,"dup":367,"sugar-core":809}],1159:[function(require,module,exports){
arguments[4][368][0].apply(exports,arguments)
},{"./build/buildDateUnitMethodsCall":1005,"dup":368,"sugar-core":809}],1160:[function(require,module,exports){
arguments[4][369][0].apply(exports,arguments)
},{"./build/buildDateUnitMethodsCall":1005,"dup":369,"sugar-core":809}],1161:[function(require,module,exports){
arguments[4][370][0].apply(exports,arguments)
},{"./internal/collectDateArguments":1045,"./internal/updateDate":1106,"dup":370,"sugar-core":809}],1162:[function(require,module,exports){
arguments[4][371][0].apply(exports,arguments)
},{"./internal/setISOWeekNumber":1100,"dup":371,"sugar-core":809}],1163:[function(require,module,exports){
arguments[4][372][0].apply(exports,arguments)
},{"./var/LocaleHelpers":1180,"dup":372,"sugar-core":809}],1164:[function(require,module,exports){
arguments[4][373][0].apply(exports,arguments)
},{"./var/_dateOptions":1185,"dup":373,"sugar-core":809}],1165:[function(require,module,exports){
arguments[4][374][0].apply(exports,arguments)
},{"../common/var/_utc":981,"dup":374,"sugar-core":809}],1166:[function(require,module,exports){
arguments[4][375][0].apply(exports,arguments)
},{"./internal/setWeekday":1103,"dup":375,"sugar-core":809}],1167:[function(require,module,exports){
arguments[4][376][0].apply(exports,arguments)
},{"../internal/getEnglishVariant":1067,"dup":376}],1168:[function(require,module,exports){
arguments[4][377][0].apply(exports,arguments)
},{"../internal/getEnglishVariant":1067,"dup":377}],1169:[function(require,module,exports){
arguments[4][378][0].apply(exports,arguments)
},{"../internal/getEnglishVariant":1067,"dup":378}],1170:[function(require,module,exports){
arguments[4][379][0].apply(exports,arguments)
},{"dup":379}],1171:[function(require,module,exports){
arguments[4][380][0].apply(exports,arguments)
},{"dup":380}],1172:[function(require,module,exports){
arguments[4][381][0].apply(exports,arguments)
},{"../internal/defaultNewDate":1054,"dup":381}],1173:[function(require,module,exports){
arguments[4][382][0].apply(exports,arguments)
},{"dup":382}],1174:[function(require,module,exports){
arguments[4][383][0].apply(exports,arguments)
},{"../internal/getDaysInMonth":1065,"dup":383}],1175:[function(require,module,exports){
arguments[4][384][0].apply(exports,arguments)
},{"dup":384}],1176:[function(require,module,exports){
arguments[4][385][0].apply(exports,arguments)
},{"../../common/internal/callDateGet":899,"../../common/internal/padNumber":953,"../../common/var/mathAliases":986,"../../common/var/trunc":989,"../internal/cloneDate":1044,"../internal/getDate":1061,"../internal/getDaysSince":1066,"../internal/getHours":1070,"../internal/getMeridiemToken":1072,"../internal/getMonth":1073,"../internal/getUTCOffset":1080,"../internal/getWeekNumber":1082,"../internal/getWeekYear":1083,"../internal/getWeekday":1084,"../internal/getYear":1085,"../internal/setUnitAndLowerToEdge":1102,"./DateUnitIndexes":1173,"./LocaleHelpers":1180,"./TIMEZONE_ABBREVIATION_REG":1184,"dup":385}],1177:[function(require,module,exports){
arguments[4][386][0].apply(exports,arguments)
},{"dup":386}],1178:[function(require,module,exports){
arguments[4][387][0].apply(exports,arguments)
},{"dup":387}],1179:[function(require,module,exports){
arguments[4][388][0].apply(exports,arguments)
},{"./AmericanEnglishDefinition":1167,"./BritishEnglishDefinition":1168,"./CanadianEnglishDefinition":1169,"dup":388}],1180:[function(require,module,exports){
arguments[4][389][0].apply(exports,arguments)
},{"../internal/getNewLocale":1075,"./AmericanEnglishDefinition":1167,"./LazyLoadedLocales":1179,"dup":389}],1181:[function(require,module,exports){
arguments[4][390][0].apply(exports,arguments)
},{"dup":390}],1182:[function(require,module,exports){
arguments[4][391][0].apply(exports,arguments)
},{"dup":391}],1183:[function(require,module,exports){
arguments[4][392][0].apply(exports,arguments)
},{"dup":392}],1184:[function(require,module,exports){
arguments[4][393][0].apply(exports,arguments)
},{"dup":393}],1185:[function(require,module,exports){
arguments[4][394][0].apply(exports,arguments)
},{"../../common/internal/defineOptionsAccessor":915,"../../common/var/namespaceAliases":988,"./DATE_OPTIONS":1172,"dup":394}],1186:[function(require,module,exports){
arguments[4][395][0].apply(exports,arguments)
},{"../../common/internal/createFormatMatcher":905,"../../common/internal/defineInstanceSimilar":913,"../../common/internal/forEach":920,"../../common/internal/padNumber":953,"../../common/internal/spaceSplit":966,"../../common/var/coreUtilityAliases":984,"../../common/var/namespaceAliases":988,"./CoreOutputFormats":1170,"./FormatTokensBase":1176,"./LocaleHelpers":1180,"dup":395}],1187:[function(require,module,exports){
arguments[4][396][0].apply(exports,arguments)
},{"./build/buildDateUnitMethodsCall":1005,"dup":396,"sugar-core":809}],1188:[function(require,module,exports){
arguments[4][397][0].apply(exports,arguments)
},{"./build/buildDateUnitMethodsCall":1005,"dup":397,"sugar-core":809}],1189:[function(require,module,exports){
arguments[4][398][0].apply(exports,arguments)
},{"./build/buildDateUnitMethodsCall":1005,"dup":398,"sugar-core":809}],1190:[function(require,module,exports){
arguments[4][399][0].apply(exports,arguments)
},{"./build/buildDateUnitMethodsCall":1005,"dup":399,"sugar-core":809}],1191:[function(require,module,exports){
arguments[4][400][0].apply(exports,arguments)
},{"./build/buildDateUnitMethodsCall":1005,"dup":400,"sugar-core":809}],1192:[function(require,module,exports){
arguments[4][401][0].apply(exports,arguments)
},{"./build/buildDateUnitMethodsCall":1005,"dup":401,"sugar-core":809}],1193:[function(require,module,exports){
arguments[4][402][0].apply(exports,arguments)
},{"./build/buildDateUnitMethodsCall":1005,"dup":402,"sugar-core":809}],1194:[function(require,module,exports){
arguments[4][403][0].apply(exports,arguments)
},{"./build/buildDateUnitMethodsCall":1005,"dup":403,"sugar-core":809}],1195:[function(require,module,exports){
arguments[4][404][0].apply(exports,arguments)
},{"../internal/buildFromIndexMethods":1202,"dup":404}],1196:[function(require,module,exports){
arguments[4][405][0].apply(exports,arguments)
},{"../array/average":813,"../array/count":818,"../array/every":820,"../array/everyFromIndex":821,"../array/filter":823,"../array/filterFromIndex":824,"../array/find":825,"../array/findFromIndex":826,"../array/findIndex":827,"../array/findIndexFromIndex":828,"../array/forEachFromIndex":831,"../array/least":866,"../array/map":867,"../array/mapFromIndex":868,"../array/max":869,"../array/median":870,"../array/min":871,"../array/most":872,"../array/none":873,"../array/reduceFromIndex":874,"../array/reduceRightFromIndex":875,"../array/some":881,"../array/someFromIndex":882,"../array/sum":885,"../object/average":1376,"../object/count":1379,"../object/every":1381,"../object/filter":1383,"../object/find":1384,"../object/forEach":1385,"../object/least":1440,"../object/map":1441,"../object/max":1442,"../object/median":1443,"../object/min":1446,"../object/most":1447,"../object/none":1448,"../object/reduce":1449,"../object/some":1455,"../object/sum":1457,"dup":405,"sugar-core":809}],1197:[function(require,module,exports){
arguments[4][406][0].apply(exports,arguments)
},{"../../common/internal/isUndefined":946,"../var/enhancedMatcherMethods":1221,"dup":406}],1198:[function(require,module,exports){
arguments[4][407][0].apply(exports,arguments)
},{"../var/enhancedMatcherMethods":1221,"dup":407}],1199:[function(require,module,exports){
arguments[4][408][0].apply(exports,arguments)
},{"./enumerateWithMapping":1205,"dup":408}],1200:[function(require,module,exports){
arguments[4][409][0].apply(exports,arguments)
},{"./enhancedMapping":1203,"./wrapNativeArrayMethod":1217,"dup":409}],1201:[function(require,module,exports){
arguments[4][410][0].apply(exports,arguments)
},{"./enhancedMatching":1204,"./wrapNativeArrayMethod":1217,"dup":410}],1202:[function(require,module,exports){
arguments[4][411][0].apply(exports,arguments)
},{"../../common/internal/assertArgument":895,"../../common/internal/forEach":920,"../../common/internal/getNormalizedIndex":928,"../../common/internal/spaceSplit":966,"../../common/var/classChecks":983,"../../common/var/coreUtilityAliases":984,"../../common/var/mathAliases":986,"../../common/var/methodDefineAliases":987,"../../common/var/namespaceAliases":988,"./enhancedMapping":1203,"./enhancedMatching":1204,"dup":411}],1203:[function(require,module,exports){
arguments[4][412][0].apply(exports,arguments)
},{"../../common/internal/mapWithShortcuts":951,"../../common/var/classChecks":983,"dup":412}],1204:[function(require,module,exports){
arguments[4][413][0].apply(exports,arguments)
},{"../../common/internal/getMatcher":927,"../../common/var/classChecks":983,"dup":413}],1205:[function(require,module,exports){
arguments[4][414][0].apply(exports,arguments)
},{"../../common/internal/isArrayIndex":938,"../../common/internal/mapWithShortcuts":951,"../../common/var/classChecks":983,"../../common/var/coreUtilityAliases":984,"dup":414}],1206:[function(require,module,exports){
arguments[4][415][0].apply(exports,arguments)
},{"../../common/internal/serializeInternal":959,"../../common/var/classChecks":983,"../../common/var/coreUtilityAliases":984,"./enumerateWithMapping":1205,"./getMinOrMax":1207,"./getReducedMinMaxResult":1208,"dup":415}],1207:[function(require,module,exports){
arguments[4][416][0].apply(exports,arguments)
},{"../../common/internal/isUndefined":946,"../../common/var/classChecks":983,"./enumerateWithMapping":1205,"./getReducedMinMaxResult":1208,"dup":416}],1208:[function(require,module,exports){
arguments[4][417][0].apply(exports,arguments)
},{"dup":417}],1209:[function(require,module,exports){
arguments[4][418][0].apply(exports,arguments)
},{"../../common/var/trunc":989,"./enumerateWithMapping":1205,"dup":418}],1210:[function(require,module,exports){
arguments[4][419][0].apply(exports,arguments)
},{"../../common/internal/getMatcher":927,"../../common/var/coreUtilityAliases":984,"dup":419}],1211:[function(require,module,exports){
arguments[4][420][0].apply(exports,arguments)
},{"../../common/internal/getMatcher":927,"../../common/var/coreUtilityAliases":984,"dup":420}],1212:[function(require,module,exports){
arguments[4][421][0].apply(exports,arguments)
},{"../../common/internal/assertCallable":897,"../../common/var/coreUtilityAliases":984,"dup":421}],1213:[function(require,module,exports){
arguments[4][422][0].apply(exports,arguments)
},{"../../common/internal/mapWithShortcuts":951,"../../common/var/coreUtilityAliases":984,"dup":422}],1214:[function(require,module,exports){
arguments[4][423][0].apply(exports,arguments)
},{"../var/objectMatchers":1222,"dup":423}],1215:[function(require,module,exports){
arguments[4][424][0].apply(exports,arguments)
},{"../../common/internal/isDefined":940,"../../common/var/coreUtilityAliases":984,"dup":424}],1216:[function(require,module,exports){
arguments[4][425][0].apply(exports,arguments)
},{"./enumerateWithMapping":1205,"dup":425}],1217:[function(require,module,exports){
arguments[4][426][0].apply(exports,arguments)
},{"../../common/internal/assertArgument":895,"dup":426}],1218:[function(require,module,exports){
arguments[4][427][0].apply(exports,arguments)
},{"../../common/internal/getKeys":926,"../../common/internal/getMatcher":927,"dup":427}],1219:[function(require,module,exports){
arguments[4][428][0].apply(exports,arguments)
},{"dup":428}],1220:[function(require,module,exports){
arguments[4][429][0].apply(exports,arguments)
},{"../internal/buildEnhancedMapping":1200,"dup":429}],1221:[function(require,module,exports){
arguments[4][430][0].apply(exports,arguments)
},{"../internal/buildEnhancedMatching":1201,"dup":430}],1222:[function(require,module,exports){
arguments[4][431][0].apply(exports,arguments)
},{"../internal/wrapObjectMatcher":1218,"dup":431}],1223:[function(require,module,exports){
arguments[4][432][0].apply(exports,arguments)
},{"../common/internal/coercePositiveInteger":901,"dup":432,"sugar-core":809}],1224:[function(require,module,exports){
arguments[4][433][0].apply(exports,arguments)
},{"./internal/cancelFunction":1229,"dup":433,"sugar-core":809}],1225:[function(require,module,exports){
arguments[4][434][0].apply(exports,arguments)
},{"./internal/cancelFunction":1229,"./internal/setDelay":1233,"dup":434,"sugar-core":809}],1226:[function(require,module,exports){
arguments[4][435][0].apply(exports,arguments)
},{"./internal/setDelay":1233,"dup":435,"sugar-core":809}],1227:[function(require,module,exports){
arguments[4][436][0].apply(exports,arguments)
},{"./internal/setDelay":1233,"dup":436,"sugar-core":809}],1228:[function(require,module,exports){
arguments[4][437][0].apply(exports,arguments)
},{"./after":1223,"./cancel":1224,"./debounce":1225,"./delay":1226,"./every":1227,"./lazy":1234,"./lock":1235,"./memoize":1236,"./once":1237,"./partial":1238,"./throttle":1239,"dup":437,"sugar-core":809}],1229:[function(require,module,exports){
arguments[4][438][0].apply(exports,arguments)
},{"../../common/var/classChecks":983,"../var/_canceled":1240,"../var/_timers":1243,"dup":438}],1230:[function(require,module,exports){
arguments[4][439][0].apply(exports,arguments)
},{"dup":439}],1231:[function(require,module,exports){
arguments[4][440][0].apply(exports,arguments)
},{"../../common/internal/serializeInternal":959,"../../common/var/coreUtilityAliases":984,"dup":440}],1232:[function(require,module,exports){
arguments[4][441][0].apply(exports,arguments)
},{"../../common/var/mathAliases":986,"./setDelay":1233,"dup":441}],1233:[function(require,module,exports){
arguments[4][442][0].apply(exports,arguments)
},{"../../common/internal/coercePositiveInteger":901,"../var/_canceled":1240,"../var/_timers":1243,"dup":442}],1234:[function(require,module,exports){
arguments[4][443][0].apply(exports,arguments)
},{"./internal/createLazyFunction":1232,"dup":443,"sugar-core":809}],1235:[function(require,module,exports){
arguments[4][444][0].apply(exports,arguments)
},{"../common/var/classChecks":983,"../common/var/mathAliases":986,"./var/_lock":1241,"./var/_partial":1242,"dup":444,"sugar-core":809}],1236:[function(require,module,exports){
arguments[4][445][0].apply(exports,arguments)
},{"../common/internal/deepGetProperty":907,"../common/var/classChecks":983,"./internal/collectArguments":1230,"./internal/createHashedMemoizeFunction":1231,"dup":445,"sugar-core":809}],1237:[function(require,module,exports){
arguments[4][446][0].apply(exports,arguments)
},{"dup":446,"sugar-core":809}],1238:[function(require,module,exports){
arguments[4][447][0].apply(exports,arguments)
},{"../common/internal/isDefined":940,"../common/internal/isObjectType":942,"../common/var/classChecks":983,"../common/var/mathAliases":986,"./var/_lock":1241,"./var/_partial":1242,"./var/createInstanceFromPrototype":1244,"dup":447,"sugar-core":809}],1239:[function(require,module,exports){
arguments[4][448][0].apply(exports,arguments)
},{"./internal/createLazyFunction":1232,"dup":448,"sugar-core":809}],1240:[function(require,module,exports){
arguments[4][449][0].apply(exports,arguments)
},{"../../common/internal/privatePropertyAccessor":955,"dup":449}],1241:[function(require,module,exports){
arguments[4][450][0].apply(exports,arguments)
},{"../../common/internal/privatePropertyAccessor":955,"dup":450}],1242:[function(require,module,exports){
arguments[4][451][0].apply(exports,arguments)
},{"../../common/internal/privatePropertyAccessor":955,"dup":451}],1243:[function(require,module,exports){
arguments[4][452][0].apply(exports,arguments)
},{"../../common/internal/privatePropertyAccessor":955,"dup":452}],1244:[function(require,module,exports){
arguments[4][453][0].apply(exports,arguments)
},{"dup":453}],1245:[function(require,module,exports){
arguments[4][454][0].apply(exports,arguments)
},{"./array":837,"./date":1035,"./enumerable":1196,"./function":1228,"./number":1285,"./object":1389,"./range":1474,"./regexp":1515,"./string":1534,"dup":454,"sugar-core":809}],1246:[function(require,module,exports){
arguments[4][455][0].apply(exports,arguments)
},{"./internal/abbreviateNumber":1286,"./var/AbbreviationUnits":1351,"dup":455,"sugar-core":809}],1247:[function(require,module,exports){
arguments[4][456][0].apply(exports,arguments)
},{"./build/buildMathAliasesCall":1251,"dup":456,"sugar-core":809}],1248:[function(require,module,exports){
arguments[4][457][0].apply(exports,arguments)
},{"./build/buildMathAliasesCall":1251,"dup":457,"sugar-core":809}],1249:[function(require,module,exports){
arguments[4][458][0].apply(exports,arguments)
},{"./build/buildMathAliasesCall":1251,"dup":458,"sugar-core":809}],1250:[function(require,module,exports){
arguments[4][459][0].apply(exports,arguments)
},{"./build/buildMathAliasesCall":1251,"dup":459,"sugar-core":809}],1251:[function(require,module,exports){
arguments[4][460][0].apply(exports,arguments)
},{"../internal/buildMathAliases":1287,"dup":460}],1252:[function(require,module,exports){
arguments[4][461][0].apply(exports,arguments)
},{"./internal/abbreviateNumber":1286,"./var/AbbreviationUnits":1351,"dup":461,"sugar-core":809}],1253:[function(require,module,exports){
arguments[4][462][0].apply(exports,arguments)
},{"../range/internal/Range":1475,"../range/internal/rangeClamp":1489,"dup":462,"sugar-core":809}],1254:[function(require,module,exports){
arguments[4][463][0].apply(exports,arguments)
},{"../common/var/mathAliases":986,"./internal/createRoundingFunction":1288,"dup":463,"sugar-core":809}],1255:[function(require,module,exports){
arguments[4][464][0].apply(exports,arguments)
},{"../common/var/chr":982,"dup":464,"sugar-core":809}],1256:[function(require,module,exports){
arguments[4][465][0].apply(exports,arguments)
},{"../range/internal/Range":1475,"../range/internal/rangeClamp":1489,"dup":465,"sugar-core":809}],1257:[function(require,module,exports){
arguments[4][466][0].apply(exports,arguments)
},{"./build/buildMathAliasesCall":1251,"dup":466,"sugar-core":809}],1258:[function(require,module,exports){
arguments[4][467][0].apply(exports,arguments)
},{"../date/build/buildNumberUnitMethodsCall":1006,"dup":467,"sugar-core":809}],1259:[function(require,module,exports){
arguments[4][468][0].apply(exports,arguments)
},{"../date/build/buildNumberUnitMethodsCall":1006,"dup":468,"sugar-core":809}],1260:[function(require,module,exports){
arguments[4][469][0].apply(exports,arguments)
},{"../date/build/buildNumberUnitMethodsCall":1006,"dup":469,"sugar-core":809}],1261:[function(require,module,exports){
arguments[4][470][0].apply(exports,arguments)
},{"../date/build/buildNumberUnitMethodsCall":1006,"dup":470,"sugar-core":809}],1262:[function(require,module,exports){
arguments[4][471][0].apply(exports,arguments)
},{"../date/build/buildNumberUnitMethodsCall":1006,"dup":471,"sugar-core":809}],1263:[function(require,module,exports){
arguments[4][472][0].apply(exports,arguments)
},{"../date/build/buildNumberUnitMethodsCall":1006,"dup":472,"sugar-core":809}],1264:[function(require,module,exports){
arguments[4][473][0].apply(exports,arguments)
},{"../date/build/buildNumberUnitMethodsCall":1006,"dup":473,"sugar-core":809}],1265:[function(require,module,exports){
arguments[4][474][0].apply(exports,arguments)
},{"../date/build/buildNumberUnitMethodsCall":1006,"dup":474,"sugar-core":809}],1266:[function(require,module,exports){
arguments[4][475][0].apply(exports,arguments)
},{"../date/build/buildNumberUnitMethodsCall":1006,"dup":475,"sugar-core":809}],1267:[function(require,module,exports){
arguments[4][476][0].apply(exports,arguments)
},{"../date/build/buildNumberUnitMethodsCall":1006,"dup":476,"sugar-core":809}],1268:[function(require,module,exports){
arguments[4][477][0].apply(exports,arguments)
},{"./upto":1350,"dup":477,"sugar-core":809}],1269:[function(require,module,exports){
arguments[4][478][0].apply(exports,arguments)
},{"../date/var/LocaleHelpers":1180,"dup":478,"sugar-core":809}],1270:[function(require,module,exports){
arguments[4][479][0].apply(exports,arguments)
},{"./build/buildMathAliasesCall":1251,"dup":479,"sugar-core":809}],1271:[function(require,module,exports){
arguments[4][480][0].apply(exports,arguments)
},{"../common/var/mathAliases":986,"./internal/createRoundingFunction":1288,"dup":480,"sugar-core":809}],1272:[function(require,module,exports){
arguments[4][481][0].apply(exports,arguments)
},{"./internal/numberFormat":1291,"dup":481,"sugar-core":809}],1273:[function(require,module,exports){
arguments[4][482][0].apply(exports,arguments)
},{"./var/_numberOptions":1353,"dup":482,"sugar-core":809}],1274:[function(require,module,exports){
arguments[4][483][0].apply(exports,arguments)
},{"../common/internal/padNumber":953,"dup":483,"sugar-core":809}],1275:[function(require,module,exports){
arguments[4][484][0].apply(exports,arguments)
},{"../date/build/buildNumberUnitMethodsCall":1006,"dup":484,"sugar-core":809}],1276:[function(require,module,exports){
arguments[4][485][0].apply(exports,arguments)
},{"../date/build/buildNumberUnitMethodsCall":1006,"dup":485,"sugar-core":809}],1277:[function(require,module,exports){
arguments[4][486][0].apply(exports,arguments)
},{"../date/build/buildNumberUnitMethodsCall":1006,"dup":486,"sugar-core":809}],1278:[function(require,module,exports){
arguments[4][487][0].apply(exports,arguments)
},{"../date/build/buildNumberUnitMethodsCall":1006,"dup":487,"sugar-core":809}],1279:[function(require,module,exports){
arguments[4][488][0].apply(exports,arguments)
},{"../date/build/buildNumberUnitMethodsCall":1006,"dup":488,"sugar-core":809}],1280:[function(require,module,exports){
arguments[4][489][0].apply(exports,arguments)
},{"../date/build/buildNumberUnitMethodsCall":1006,"dup":489,"sugar-core":809}],1281:[function(require,module,exports){
arguments[4][490][0].apply(exports,arguments)
},{"../date/build/buildNumberUnitMethodsCall":1006,"dup":490,"sugar-core":809}],1282:[function(require,module,exports){
arguments[4][491][0].apply(exports,arguments)
},{"../date/build/buildNumberUnitMethodsCall":1006,"dup":491,"sugar-core":809}],1283:[function(require,module,exports){
arguments[4][492][0].apply(exports,arguments)
},{"../date/build/buildNumberUnitMethodsCall":1006,"dup":492,"sugar-core":809}],1284:[function(require,module,exports){
arguments[4][493][0].apply(exports,arguments)
},{"../date/build/buildNumberUnitMethodsCall":1006,"dup":493,"sugar-core":809}],1285:[function(require,module,exports){
arguments[4][494][0].apply(exports,arguments)
},{"./abbr":1246,"./abs":1247,"./acos":1248,"./asin":1249,"./atan":1250,"./bytes":1252,"./ceil":1254,"./chr":1255,"./cos":1257,"./exp":1270,"./floor":1271,"./format":1272,"./getOption":1273,"./hex":1274,"./isEven":1292,"./isInteger":1293,"./isMultipleOf":1294,"./isOdd":1295,"./log":1296,"./metric":1297,"./ordinalize":1328,"./pad":1329,"./pow":1330,"./random":1331,"./round":1333,"./setOption":1344,"./sin":1345,"./sqrt":1346,"./tan":1347,"./times":1348,"./toNumber":1349,"dup":494,"sugar-core":809}],1286:[function(require,module,exports){
arguments[4][495][0].apply(exports,arguments)
},{"../../common/internal/commaSplit":904,"../../common/internal/withPrecision":969,"../../common/var/mathAliases":986,"./numberFormat":1291,"dup":495}],1287:[function(require,module,exports){
arguments[4][496][0].apply(exports,arguments)
},{"../../common/internal/defineInstanceSimilar":913,"../../common/var/namespaceAliases":988,"dup":496}],1288:[function(require,module,exports){
arguments[4][497][0].apply(exports,arguments)
},{"../../common/internal/withPrecision":969,"dup":497}],1289:[function(require,module,exports){
arguments[4][498][0].apply(exports,arguments)
},{"dup":498}],1290:[function(require,module,exports){
arguments[4][499][0].apply(exports,arguments)
},{"dup":499}],1291:[function(require,module,exports){
arguments[4][500][0].apply(exports,arguments)
},{"../../common/internal/periodSplit":954,"../../common/internal/repeatString":957,"../../common/internal/withPrecision":969,"../../common/var/classChecks":983,"../../common/var/mathAliases":986,"../var/_numberOptions":1353,"dup":500}],1292:[function(require,module,exports){
arguments[4][501][0].apply(exports,arguments)
},{"./internal/isMultipleOf":1290,"dup":501,"sugar-core":809}],1293:[function(require,module,exports){
arguments[4][502][0].apply(exports,arguments)
},{"./internal/isInteger":1289,"dup":502,"sugar-core":809}],1294:[function(require,module,exports){
arguments[4][503][0].apply(exports,arguments)
},{"./internal/isMultipleOf":1290,"dup":503,"sugar-core":809}],1295:[function(require,module,exports){
arguments[4][504][0].apply(exports,arguments)
},{"./internal/isInteger":1289,"./internal/isMultipleOf":1290,"dup":504,"sugar-core":809}],1296:[function(require,module,exports){
arguments[4][505][0].apply(exports,arguments)
},{"dup":505,"sugar-core":809}],1297:[function(require,module,exports){
arguments[4][506][0].apply(exports,arguments)
},{"./internal/abbreviateNumber":1286,"./var/AbbreviationUnits":1351,"dup":506,"sugar-core":809}],1298:[function(require,module,exports){
arguments[4][507][0].apply(exports,arguments)
},{"../date/build/buildNumberUnitMethodsCall":1006,"dup":507,"sugar-core":809}],1299:[function(require,module,exports){
arguments[4][508][0].apply(exports,arguments)
},{"../date/build/buildNumberUnitMethodsCall":1006,"dup":508,"sugar-core":809}],1300:[function(require,module,exports){
arguments[4][509][0].apply(exports,arguments)
},{"../date/build/buildNumberUnitMethodsCall":1006,"dup":509,"sugar-core":809}],1301:[function(require,module,exports){
arguments[4][510][0].apply(exports,arguments)
},{"../date/build/buildNumberUnitMethodsCall":1006,"dup":510,"sugar-core":809}],1302:[function(require,module,exports){
arguments[4][511][0].apply(exports,arguments)
},{"../date/build/buildNumberUnitMethodsCall":1006,"dup":511,"sugar-core":809}],1303:[function(require,module,exports){
arguments[4][512][0].apply(exports,arguments)
},{"../date/build/buildNumberUnitMethodsCall":1006,"dup":512,"sugar-core":809}],1304:[function(require,module,exports){
arguments[4][513][0].apply(exports,arguments)
},{"../date/build/buildNumberUnitMethodsCall":1006,"dup":513,"sugar-core":809}],1305:[function(require,module,exports){
arguments[4][514][0].apply(exports,arguments)
},{"../date/build/buildNumberUnitMethodsCall":1006,"dup":514,"sugar-core":809}],1306:[function(require,module,exports){
arguments[4][515][0].apply(exports,arguments)
},{"../date/build/buildNumberUnitMethodsCall":1006,"dup":515,"sugar-core":809}],1307:[function(require,module,exports){
arguments[4][516][0].apply(exports,arguments)
},{"../date/build/buildNumberUnitMethodsCall":1006,"dup":516,"sugar-core":809}],1308:[function(require,module,exports){
arguments[4][517][0].apply(exports,arguments)
},{"../date/build/buildNumberUnitMethodsCall":1006,"dup":517,"sugar-core":809}],1309:[function(require,module,exports){
arguments[4][518][0].apply(exports,arguments)
},{"../date/build/buildNumberUnitMethodsCall":1006,"dup":518,"sugar-core":809}],1310:[function(require,module,exports){
arguments[4][519][0].apply(exports,arguments)
},{"../date/build/buildNumberUnitMethodsCall":1006,"dup":519,"sugar-core":809}],1311:[function(require,module,exports){
arguments[4][520][0].apply(exports,arguments)
},{"../date/build/buildNumberUnitMethodsCall":1006,"dup":520,"sugar-core":809}],1312:[function(require,module,exports){
arguments[4][521][0].apply(exports,arguments)
},{"../date/build/buildNumberUnitMethodsCall":1006,"dup":521,"sugar-core":809}],1313:[function(require,module,exports){
arguments[4][522][0].apply(exports,arguments)
},{"../date/build/buildNumberUnitMethodsCall":1006,"dup":522,"sugar-core":809}],1314:[function(require,module,exports){
arguments[4][523][0].apply(exports,arguments)
},{"../date/build/buildNumberUnitMethodsCall":1006,"dup":523,"sugar-core":809}],1315:[function(require,module,exports){
arguments[4][524][0].apply(exports,arguments)
},{"../date/build/buildNumberUnitMethodsCall":1006,"dup":524,"sugar-core":809}],1316:[function(require,module,exports){
arguments[4][525][0].apply(exports,arguments)
},{"../date/build/buildNumberUnitMethodsCall":1006,"dup":525,"sugar-core":809}],1317:[function(require,module,exports){
arguments[4][526][0].apply(exports,arguments)
},{"../date/build/buildNumberUnitMethodsCall":1006,"dup":526,"sugar-core":809}],1318:[function(require,module,exports){
arguments[4][527][0].apply(exports,arguments)
},{"../date/build/buildNumberUnitMethodsCall":1006,"dup":527,"sugar-core":809}],1319:[function(require,module,exports){
arguments[4][528][0].apply(exports,arguments)
},{"../date/build/buildNumberUnitMethodsCall":1006,"dup":528,"sugar-core":809}],1320:[function(require,module,exports){
arguments[4][529][0].apply(exports,arguments)
},{"../date/build/buildNumberUnitMethodsCall":1006,"dup":529,"sugar-core":809}],1321:[function(require,module,exports){
arguments[4][530][0].apply(exports,arguments)
},{"../date/build/buildNumberUnitMethodsCall":1006,"dup":530,"sugar-core":809}],1322:[function(require,module,exports){
arguments[4][531][0].apply(exports,arguments)
},{"../date/build/buildNumberUnitMethodsCall":1006,"dup":531,"sugar-core":809}],1323:[function(require,module,exports){
arguments[4][532][0].apply(exports,arguments)
},{"../date/build/buildNumberUnitMethodsCall":1006,"dup":532,"sugar-core":809}],1324:[function(require,module,exports){
arguments[4][533][0].apply(exports,arguments)
},{"../date/build/buildNumberUnitMethodsCall":1006,"dup":533,"sugar-core":809}],1325:[function(require,module,exports){
arguments[4][534][0].apply(exports,arguments)
},{"../date/build/buildNumberUnitMethodsCall":1006,"dup":534,"sugar-core":809}],1326:[function(require,module,exports){
arguments[4][535][0].apply(exports,arguments)
},{"../date/build/buildNumberUnitMethodsCall":1006,"dup":535,"sugar-core":809}],1327:[function(require,module,exports){
arguments[4][536][0].apply(exports,arguments)
},{"../date/build/buildNumberUnitMethodsCall":1006,"dup":536,"sugar-core":809}],1328:[function(require,module,exports){
arguments[4][537][0].apply(exports,arguments)
},{"../common/internal/getOrdinalSuffix":929,"../common/var/mathAliases":986,"dup":537,"sugar-core":809}],1329:[function(require,module,exports){
arguments[4][538][0].apply(exports,arguments)
},{"../common/internal/padNumber":953,"dup":538,"sugar-core":809}],1330:[function(require,module,exports){
arguments[4][539][0].apply(exports,arguments)
},{"./build/buildMathAliasesCall":1251,"dup":539,"sugar-core":809}],1331:[function(require,module,exports){
arguments[4][540][0].apply(exports,arguments)
},{"../common/internal/isUndefined":946,"../common/var/mathAliases":986,"../common/var/trunc":989,"dup":540,"sugar-core":809}],1332:[function(require,module,exports){
arguments[4][541][0].apply(exports,arguments)
},{"../range/var/PrimitiveRangeConstructor":1509,"dup":541,"sugar-core":809}],1333:[function(require,module,exports){
arguments[4][542][0].apply(exports,arguments)
},{"../common/var/mathAliases":986,"./internal/createRoundingFunction":1288,"dup":542,"sugar-core":809}],1334:[function(require,module,exports){
arguments[4][543][0].apply(exports,arguments)
},{"../date/build/buildNumberUnitMethodsCall":1006,"dup":543,"sugar-core":809}],1335:[function(require,module,exports){
arguments[4][544][0].apply(exports,arguments)
},{"../date/build/buildNumberUnitMethodsCall":1006,"dup":544,"sugar-core":809}],1336:[function(require,module,exports){
arguments[4][545][0].apply(exports,arguments)
},{"../date/build/buildNumberUnitMethodsCall":1006,"dup":545,"sugar-core":809}],1337:[function(require,module,exports){
arguments[4][546][0].apply(exports,arguments)
},{"../date/build/buildNumberUnitMethodsCall":1006,"dup":546,"sugar-core":809}],1338:[function(require,module,exports){
arguments[4][547][0].apply(exports,arguments)
},{"../date/build/buildNumberUnitMethodsCall":1006,"dup":547,"sugar-core":809}],1339:[function(require,module,exports){
arguments[4][548][0].apply(exports,arguments)
},{"../date/build/buildNumberUnitMethodsCall":1006,"dup":548,"sugar-core":809}],1340:[function(require,module,exports){
arguments[4][549][0].apply(exports,arguments)
},{"../date/build/buildNumberUnitMethodsCall":1006,"dup":549,"sugar-core":809}],1341:[function(require,module,exports){
arguments[4][550][0].apply(exports,arguments)
},{"../date/build/buildNumberUnitMethodsCall":1006,"dup":550,"sugar-core":809}],1342:[function(require,module,exports){
arguments[4][551][0].apply(exports,arguments)
},{"../date/build/buildNumberUnitMethodsCall":1006,"dup":551,"sugar-core":809}],1343:[function(require,module,exports){
arguments[4][552][0].apply(exports,arguments)
},{"../date/build/buildNumberUnitMethodsCall":1006,"dup":552,"sugar-core":809}],1344:[function(require,module,exports){
arguments[4][553][0].apply(exports,arguments)
},{"./var/_numberOptions":1353,"dup":553,"sugar-core":809}],1345:[function(require,module,exports){
arguments[4][554][0].apply(exports,arguments)
},{"./build/buildMathAliasesCall":1251,"dup":554,"sugar-core":809}],1346:[function(require,module,exports){
arguments[4][555][0].apply(exports,arguments)
},{"./build/buildMathAliasesCall":1251,"dup":555,"sugar-core":809}],1347:[function(require,module,exports){
arguments[4][556][0].apply(exports,arguments)
},{"./build/buildMathAliasesCall":1251,"dup":556,"sugar-core":809}],1348:[function(require,module,exports){
arguments[4][557][0].apply(exports,arguments)
},{"../common/internal/isDefined":940,"dup":557,"sugar-core":809}],1349:[function(require,module,exports){
arguments[4][558][0].apply(exports,arguments)
},{"dup":558,"sugar-core":809}],1350:[function(require,module,exports){
arguments[4][559][0].apply(exports,arguments)
},{"../range/internal/Range":1475,"../range/internal/rangeEvery":1490,"dup":559,"sugar-core":809}],1351:[function(require,module,exports){
arguments[4][560][0].apply(exports,arguments)
},{"dup":560}],1352:[function(require,module,exports){
arguments[4][561][0].apply(exports,arguments)
},{"../../common/var/CommonChars":971,"dup":561}],1353:[function(require,module,exports){
arguments[4][562][0].apply(exports,arguments)
},{"../../common/internal/defineOptionsAccessor":915,"../../common/var/namespaceAliases":988,"./NUMBER_OPTIONS":1352,"dup":562}],1354:[function(require,module,exports){
arguments[4][563][0].apply(exports,arguments)
},{"../date/build/buildNumberUnitMethodsCall":1006,"dup":563,"sugar-core":809}],1355:[function(require,module,exports){
arguments[4][564][0].apply(exports,arguments)
},{"../date/build/buildNumberUnitMethodsCall":1006,"dup":564,"sugar-core":809}],1356:[function(require,module,exports){
arguments[4][565][0].apply(exports,arguments)
},{"../date/build/buildNumberUnitMethodsCall":1006,"dup":565,"sugar-core":809}],1357:[function(require,module,exports){
arguments[4][566][0].apply(exports,arguments)
},{"../date/build/buildNumberUnitMethodsCall":1006,"dup":566,"sugar-core":809}],1358:[function(require,module,exports){
arguments[4][567][0].apply(exports,arguments)
},{"../date/build/buildNumberUnitMethodsCall":1006,"dup":567,"sugar-core":809}],1359:[function(require,module,exports){
arguments[4][568][0].apply(exports,arguments)
},{"../date/build/buildNumberUnitMethodsCall":1006,"dup":568,"sugar-core":809}],1360:[function(require,module,exports){
arguments[4][569][0].apply(exports,arguments)
},{"../date/build/buildNumberUnitMethodsCall":1006,"dup":569,"sugar-core":809}],1361:[function(require,module,exports){
arguments[4][570][0].apply(exports,arguments)
},{"../date/build/buildNumberUnitMethodsCall":1006,"dup":570,"sugar-core":809}],1362:[function(require,module,exports){
arguments[4][571][0].apply(exports,arguments)
},{"../date/build/buildNumberUnitMethodsCall":1006,"dup":571,"sugar-core":809}],1363:[function(require,module,exports){
arguments[4][572][0].apply(exports,arguments)
},{"../date/build/buildNumberUnitMethodsCall":1006,"dup":572,"sugar-core":809}],1364:[function(require,module,exports){
arguments[4][573][0].apply(exports,arguments)
},{"../date/build/buildNumberUnitMethodsCall":1006,"dup":573,"sugar-core":809}],1365:[function(require,module,exports){
arguments[4][574][0].apply(exports,arguments)
},{"../date/build/buildNumberUnitMethodsCall":1006,"dup":574,"sugar-core":809}],1366:[function(require,module,exports){
arguments[4][575][0].apply(exports,arguments)
},{"../date/build/buildNumberUnitMethodsCall":1006,"dup":575,"sugar-core":809}],1367:[function(require,module,exports){
arguments[4][576][0].apply(exports,arguments)
},{"../date/build/buildNumberUnitMethodsCall":1006,"dup":576,"sugar-core":809}],1368:[function(require,module,exports){
arguments[4][577][0].apply(exports,arguments)
},{"../date/build/buildNumberUnitMethodsCall":1006,"dup":577,"sugar-core":809}],1369:[function(require,module,exports){
arguments[4][578][0].apply(exports,arguments)
},{"../date/build/buildNumberUnitMethodsCall":1006,"dup":578,"sugar-core":809}],1370:[function(require,module,exports){
arguments[4][579][0].apply(exports,arguments)
},{"../date/build/buildNumberUnitMethodsCall":1006,"dup":579,"sugar-core":809}],1371:[function(require,module,exports){
arguments[4][580][0].apply(exports,arguments)
},{"../date/build/buildNumberUnitMethodsCall":1006,"dup":580,"sugar-core":809}],1372:[function(require,module,exports){
arguments[4][581][0].apply(exports,arguments)
},{"../date/build/buildNumberUnitMethodsCall":1006,"dup":581,"sugar-core":809}],1373:[function(require,module,exports){
arguments[4][582][0].apply(exports,arguments)
},{"../date/build/buildNumberUnitMethodsCall":1006,"dup":582,"sugar-core":809}],1374:[function(require,module,exports){
arguments[4][583][0].apply(exports,arguments)
},{"./internal/clone":1391,"./internal/mergeWithOptions":1406,"dup":583,"sugar-core":809}],1375:[function(require,module,exports){
arguments[4][584][0].apply(exports,arguments)
},{"./internal/clone":1391,"./internal/mergeAll":1404,"dup":584,"sugar-core":809}],1376:[function(require,module,exports){
arguments[4][585][0].apply(exports,arguments)
},{"../enumerable/internal/average":1199,"dup":585,"sugar-core":809}],1377:[function(require,module,exports){
arguments[4][586][0].apply(exports,arguments)
},{"../internal/buildClassCheckMethods":1390,"dup":586}],1378:[function(require,module,exports){
arguments[4][587][0].apply(exports,arguments)
},{"./internal/clone":1391,"dup":587,"sugar-core":809}],1379:[function(require,module,exports){
arguments[4][588][0].apply(exports,arguments)
},{"../enumerable/internal/objectCount":1210,"dup":588,"sugar-core":809}],1380:[function(require,module,exports){
arguments[4][589][0].apply(exports,arguments)
},{"./internal/defaults":1392,"dup":589,"sugar-core":809}],1381:[function(require,module,exports){
arguments[4][590][0].apply(exports,arguments)
},{"../enumerable/var/objectMatchers":1222,"dup":590,"sugar-core":809}],1382:[function(require,module,exports){
arguments[4][591][0].apply(exports,arguments)
},{"./internal/objectExclude":1407,"dup":591,"sugar-core":809}],1383:[function(require,module,exports){
arguments[4][592][0].apply(exports,arguments)
},{"../enumerable/internal/objectFilter":1211,"dup":592,"sugar-core":809}],1384:[function(require,module,exports){
arguments[4][593][0].apply(exports,arguments)
},{"../enumerable/var/objectMatchers":1222,"dup":593,"sugar-core":809}],1385:[function(require,module,exports){
arguments[4][594][0].apply(exports,arguments)
},{"../enumerable/internal/objectForEach":1212,"dup":594,"sugar-core":809}],1386:[function(require,module,exports){
arguments[4][595][0].apply(exports,arguments)
},{"./internal/fromQueryStringWithOptions":1393,"dup":595,"sugar-core":809}],1387:[function(require,module,exports){
arguments[4][596][0].apply(exports,arguments)
},{"../common/internal/deepGetProperty":907,"dup":596,"sugar-core":809}],1388:[function(require,module,exports){
arguments[4][597][0].apply(exports,arguments)
},{"../common/internal/deepHasProperty":908,"dup":597,"sugar-core":809}],1389:[function(require,module,exports){
arguments[4][598][0].apply(exports,arguments)
},{"./add":1374,"./addAll":1375,"./clone":1378,"./defaults":1380,"./exclude":1382,"./fromQueryString":1386,"./get":1387,"./has":1388,"./intersect":1423,"./invert":1424,"./isArguments":1425,"./isArray":1426,"./isBoolean":1427,"./isDate":1428,"./isEmpty":1429,"./isEqual":1430,"./isError":1431,"./isFunction":1432,"./isMap":1433,"./isNumber":1434,"./isObject":1435,"./isRegExp":1436,"./isSet":1437,"./isString":1438,"./keys":1439,"./merge":1444,"./mergeAll":1445,"./reject":1450,"./remove":1451,"./select":1452,"./set":1453,"./size":1454,"./subtract":1456,"./tap":1458,"./toQueryString":1459,"./values":1460,"dup":598,"sugar-core":809}],1390:[function(require,module,exports){
arguments[4][599][0].apply(exports,arguments)
},{"../../common/internal/defineInstanceAndStaticSimilar":912,"../../common/var/NATIVE_TYPES":975,"../../common/var/classChecks":983,"../../common/var/namespaceAliases":988,"dup":599}],1391:[function(require,module,exports){
arguments[4][600][0].apply(exports,arguments)
},{"./getNewObjectForMerge":1395,"./objectMerge":1409,"dup":600}],1392:[function(require,module,exports){
arguments[4][601][0].apply(exports,arguments)
},{"./mergeAll":1404,"dup":601}],1393:[function(require,module,exports){
arguments[4][602][0].apply(exports,arguments)
},{"../../common/internal/forEach":920,"./parseQueryComponent":1415,"dup":602}],1394:[function(require,module,exports){
arguments[4][603][0].apply(exports,arguments)
},{"../../common/internal/coercePrimitiveToObject":902,"../../common/internal/getKeys":926,"dup":603}],1395:[function(require,module,exports){
arguments[4][604][0].apply(exports,arguments)
},{"../../common/internal/getRegExpFlags":931,"../../common/internal/isPlainObject":943,"../../common/internal/isPrimitive":944,"../../common/var/classChecks":983,"../../common/var/coreUtilityAliases":984,"dup":604}],1396:[function(require,module,exports){
arguments[4][605][0].apply(exports,arguments)
},{"../../common/var/classChecks":983,"../../common/var/coreUtilityAliases":984,"./stringIsDecimal":1419,"dup":605}],1397:[function(require,module,exports){
arguments[4][606][0].apply(exports,arguments)
},{"../../common/var/classChecks":983,"./sanitizeURIComponent":1416,"dup":606}],1398:[function(require,module,exports){
arguments[4][607][0].apply(exports,arguments)
},{"../../common/var/coreUtilityAliases":984,"dup":607}],1399:[function(require,module,exports){
arguments[4][608][0].apply(exports,arguments)
},{"../../common/internal/hasProperty":935,"../../common/var/coreUtilityAliases":984,"dup":608}],1400:[function(require,module,exports){
arguments[4][609][0].apply(exports,arguments)
},{"../var/getOwnPropertyDescriptor":1463,"dup":609}],1401:[function(require,module,exports){
arguments[4][610][0].apply(exports,arguments)
},{"../../common/var/coreUtilityAliases":984,"../var/getOwnPropertyNames":1464,"../var/getOwnPropertySymbols":1465,"./iterateOverKeys":1400,"dup":610}],1402:[function(require,module,exports){
arguments[4][611][0].apply(exports,arguments)
},{"dup":611}],1403:[function(require,module,exports){
arguments[4][612][0].apply(exports,arguments)
},{"../../common/internal/isObjectType":942,"../../common/var/classChecks":983,"dup":612}],1404:[function(require,module,exports){
arguments[4][613][0].apply(exports,arguments)
},{"../../common/internal/forEach":920,"../../common/var/classChecks":983,"./mergeWithOptions":1406,"dup":613}],1405:[function(require,module,exports){
arguments[4][614][0].apply(exports,arguments)
},{"../../common/internal/isDefined":940,"../../common/var/coreUtilityAliases":984,"../var/getOwnPropertyDescriptor":1463,"dup":614}],1406:[function(require,module,exports){
arguments[4][615][0].apply(exports,arguments)
},{"./objectMerge":1409,"dup":615}],1407:[function(require,module,exports){
arguments[4][616][0].apply(exports,arguments)
},{"../../common/internal/getMatcher":927,"../../common/var/coreUtilityAliases":984,"dup":616}],1408:[function(require,module,exports){
arguments[4][617][0].apply(exports,arguments)
},{"../../common/internal/coercePrimitiveToObject":902,"../../common/internal/isEqual":941,"../../common/internal/isObjectType":942,"./objectMerge":1409,"dup":617}],1409:[function(require,module,exports){
arguments[4][618][0].apply(exports,arguments)
},{"../../common/internal/coercePrimitiveToObject":902,"../../common/internal/isDefined":940,"../../common/internal/isObjectType":942,"../../common/internal/isPrimitive":944,"../../common/internal/isUndefined":946,"../../common/var/classChecks":983,"../../common/var/coreUtilityAliases":984,"../var/getOwnPropertyNames":1464,"./getNewObjectForMerge":1395,"./iterateOverProperties":1401,"./mergeByPropertyDescriptor":1405,"dup":618,"sugar-core":809}],1410:[function(require,module,exports){
arguments[4][619][0].apply(exports,arguments)
},{"./selectFromObject":1417,"dup":619}],1411:[function(require,module,exports){
arguments[4][620][0].apply(exports,arguments)
},{"../../common/internal/getMatcher":927,"../../common/var/coreUtilityAliases":984,"dup":620}],1412:[function(require,module,exports){
arguments[4][621][0].apply(exports,arguments)
},{"./selectFromObject":1417,"dup":621}],1413:[function(require,module,exports){
arguments[4][622][0].apply(exports,arguments)
},{"./getKeysWithObjectCoercion":1394,"dup":622}],1414:[function(require,module,exports){
arguments[4][623][0].apply(exports,arguments)
},{"../../common/internal/forEach":920,"../../common/var/coreUtilityAliases":984,"./setQueryProperty":1418,"dup":623}],1415:[function(require,module,exports){
arguments[4][624][0].apply(exports,arguments)
},{"../var/DEEP_QUERY_STRING_REG":1461,"./mapQuerySeparatorToKeys":1402,"./parseDeepQueryComponent":1414,"./setQueryProperty":1418,"dup":624}],1416:[function(require,module,exports){
arguments[4][625][0].apply(exports,arguments)
},{"dup":625}],1417:[function(require,module,exports){
arguments[4][626][0].apply(exports,arguments)
},{"../../common/var/coreUtilityAliases":984,"./matchInObject":1403,"dup":626}],1418:[function(require,module,exports){
arguments[4][627][0].apply(exports,arguments)
},{"../../common/internal/isDefined":940,"./getQueryValueAuto":1396,"dup":627}],1419:[function(require,module,exports){
arguments[4][628][0].apply(exports,arguments)
},{"../var/NON_DECIMAL_REG":1462,"dup":628}],1420:[function(require,module,exports){
arguments[4][629][0].apply(exports,arguments)
},{"../../common/var/classChecks":983,"dup":629}],1421:[function(require,module,exports){
arguments[4][630][0].apply(exports,arguments)
},{"../../common/internal/isObjectType":942,"../../common/var/classChecks":983,"../../common/var/coreUtilityAliases":984,"../var/internalToString":1466,"./getURIComponentValue":1397,"./sanitizeURIComponent":1416,"dup":630}],1422:[function(require,module,exports){
arguments[4][631][0].apply(exports,arguments)
},{"../../common/internal/isUndefined":946,"./toQueryString":1421,"dup":631}],1423:[function(require,module,exports){
arguments[4][632][0].apply(exports,arguments)
},{"./internal/objectIntersectOrSubtract":1408,"dup":632,"sugar-core":809}],1424:[function(require,module,exports){
arguments[4][633][0].apply(exports,arguments)
},{"../common/var/coreUtilityAliases":984,"dup":633,"sugar-core":809}],1425:[function(require,module,exports){
arguments[4][634][0].apply(exports,arguments)
},{"./internal/isArguments":1399,"dup":634,"sugar-core":809}],1426:[function(require,module,exports){
arguments[4][635][0].apply(exports,arguments)
},{"./build/buildClassCheckMethodsCall":1377,"dup":635,"sugar-core":809}],1427:[function(require,module,exports){
arguments[4][636][0].apply(exports,arguments)
},{"./build/buildClassCheckMethodsCall":1377,"dup":636,"sugar-core":809}],1428:[function(require,module,exports){
arguments[4][637][0].apply(exports,arguments)
},{"./build/buildClassCheckMethodsCall":1377,"dup":637,"sugar-core":809}],1429:[function(require,module,exports){
arguments[4][638][0].apply(exports,arguments)
},{"./internal/objectSize":1413,"dup":638,"sugar-core":809}],1430:[function(require,module,exports){
arguments[4][639][0].apply(exports,arguments)
},{"../common/internal/isEqual":941,"dup":639,"sugar-core":809}],1431:[function(require,module,exports){
arguments[4][640][0].apply(exports,arguments)
},{"./build/buildClassCheckMethodsCall":1377,"dup":640,"sugar-core":809}],1432:[function(require,module,exports){
arguments[4][641][0].apply(exports,arguments)
},{"./build/buildClassCheckMethodsCall":1377,"dup":641,"sugar-core":809}],1433:[function(require,module,exports){
arguments[4][642][0].apply(exports,arguments)
},{"./build/buildClassCheckMethodsCall":1377,"dup":642,"sugar-core":809}],1434:[function(require,module,exports){
arguments[4][643][0].apply(exports,arguments)
},{"./build/buildClassCheckMethodsCall":1377,"dup":643,"sugar-core":809}],1435:[function(require,module,exports){
arguments[4][644][0].apply(exports,arguments)
},{"../common/internal/isPlainObject":943,"dup":644,"sugar-core":809}],1436:[function(require,module,exports){
arguments[4][645][0].apply(exports,arguments)
},{"./build/buildClassCheckMethodsCall":1377,"dup":645,"sugar-core":809}],1437:[function(require,module,exports){
arguments[4][646][0].apply(exports,arguments)
},{"./build/buildClassCheckMethodsCall":1377,"dup":646,"sugar-core":809}],1438:[function(require,module,exports){
arguments[4][647][0].apply(exports,arguments)
},{"./build/buildClassCheckMethodsCall":1377,"dup":647,"sugar-core":809}],1439:[function(require,module,exports){
arguments[4][648][0].apply(exports,arguments)
},{"../common/internal/getKeys":926,"dup":648,"sugar-core":809}],1440:[function(require,module,exports){
arguments[4][649][0].apply(exports,arguments)
},{"../enumerable/internal/getLeastOrMost":1206,"dup":649,"sugar-core":809}],1441:[function(require,module,exports){
arguments[4][650][0].apply(exports,arguments)
},{"../enumerable/internal/objectMap":1213,"dup":650,"sugar-core":809}],1442:[function(require,module,exports){
arguments[4][651][0].apply(exports,arguments)
},{"../enumerable/internal/getMinOrMax":1207,"dup":651,"sugar-core":809}],1443:[function(require,module,exports){
arguments[4][652][0].apply(exports,arguments)
},{"../enumerable/internal/median":1209,"dup":652,"sugar-core":809}],1444:[function(require,module,exports){
arguments[4][653][0].apply(exports,arguments)
},{"./internal/mergeWithOptions":1406,"dup":653,"sugar-core":809}],1445:[function(require,module,exports){
arguments[4][654][0].apply(exports,arguments)
},{"./internal/mergeAll":1404,"dup":654,"sugar-core":809}],1446:[function(require,module,exports){
arguments[4][655][0].apply(exports,arguments)
},{"../enumerable/internal/getMinOrMax":1207,"dup":655,"sugar-core":809}],1447:[function(require,module,exports){
arguments[4][656][0].apply(exports,arguments)
},{"../enumerable/internal/getLeastOrMost":1206,"dup":656,"sugar-core":809}],1448:[function(require,module,exports){
arguments[4][657][0].apply(exports,arguments)
},{"../enumerable/internal/objectNone":1214,"dup":657,"sugar-core":809}],1449:[function(require,module,exports){
arguments[4][658][0].apply(exports,arguments)
},{"../enumerable/internal/objectReduce":1215,"dup":658,"sugar-core":809}],1450:[function(require,module,exports){
arguments[4][659][0].apply(exports,arguments)
},{"./internal/objectReject":1410,"dup":659,"sugar-core":809}],1451:[function(require,module,exports){
arguments[4][660][0].apply(exports,arguments)
},{"./internal/objectRemove":1411,"dup":660,"sugar-core":809}],1452:[function(require,module,exports){
arguments[4][661][0].apply(exports,arguments)
},{"./internal/objectSelect":1412,"dup":661,"sugar-core":809}],1453:[function(require,module,exports){
arguments[4][662][0].apply(exports,arguments)
},{"../common/internal/deepSetProperty":909,"dup":662,"sugar-core":809}],1454:[function(require,module,exports){
arguments[4][663][0].apply(exports,arguments)
},{"./internal/objectSize":1413,"dup":663,"sugar-core":809}],1455:[function(require,module,exports){
arguments[4][664][0].apply(exports,arguments)
},{"../enumerable/var/objectMatchers":1222,"dup":664,"sugar-core":809}],1456:[function(require,module,exports){
arguments[4][665][0].apply(exports,arguments)
},{"./internal/objectIntersectOrSubtract":1408,"dup":665,"sugar-core":809}],1457:[function(require,module,exports){
arguments[4][666][0].apply(exports,arguments)
},{"../enumerable/internal/sum":1216,"dup":666,"sugar-core":809}],1458:[function(require,module,exports){
arguments[4][667][0].apply(exports,arguments)
},{"./internal/tap":1420,"dup":667,"sugar-core":809}],1459:[function(require,module,exports){
arguments[4][668][0].apply(exports,arguments)
},{"./internal/toQueryStringWithOptions":1422,"dup":668,"sugar-core":809}],1460:[function(require,module,exports){
arguments[4][669][0].apply(exports,arguments)
},{"./internal/getValues":1398,"dup":669,"sugar-core":809}],1461:[function(require,module,exports){
arguments[4][670][0].apply(exports,arguments)
},{"dup":670}],1462:[function(require,module,exports){
arguments[4][671][0].apply(exports,arguments)
},{"dup":671}],1463:[function(require,module,exports){
arguments[4][672][0].apply(exports,arguments)
},{"dup":672}],1464:[function(require,module,exports){
arguments[4][673][0].apply(exports,arguments)
},{"dup":673}],1465:[function(require,module,exports){
arguments[4][674][0].apply(exports,arguments)
},{"dup":674}],1466:[function(require,module,exports){
arguments[4][675][0].apply(exports,arguments)
},{"dup":675}],1467:[function(require,module,exports){
arguments[4][676][0].apply(exports,arguments)
},{"../internal/buildDateRangeUnits":1476,"dup":676}],1468:[function(require,module,exports){
arguments[4][677][0].apply(exports,arguments)
},{"../common/internal/defineOnPrototype":914,"./internal/Range":1475,"./internal/rangeClamp":1489,"dup":677}],1469:[function(require,module,exports){
arguments[4][678][0].apply(exports,arguments)
},{"../common/internal/defineOnPrototype":914,"./internal/Range":1475,"dup":678}],1470:[function(require,module,exports){
arguments[4][679][0].apply(exports,arguments)
},{"../common/internal/defineOnPrototype":914,"./internal/Range":1475,"dup":679}],1471:[function(require,module,exports){
arguments[4][680][0].apply(exports,arguments)
},{"./build/buildDateRangeUnitsCall":1467,"dup":680}],1472:[function(require,module,exports){
arguments[4][681][0].apply(exports,arguments)
},{"../common/internal/defineOnPrototype":914,"./internal/Range":1475,"./internal/rangeEvery":1490,"dup":681}],1473:[function(require,module,exports){
arguments[4][682][0].apply(exports,arguments)
},{"./build/buildDateRangeUnitsCall":1467,"dup":682}],1474:[function(require,module,exports){
arguments[4][683][0].apply(exports,arguments)
},{"../date/range":1151,"../number/cap":1253,"../number/clamp":1256,"../number/downto":1268,"../number/range":1332,"../number/upto":1350,"../string/range":1565,"./clamp":1468,"./clone":1469,"./contains":1470,"./days":1471,"./every":1472,"./hours":1473,"./intersect":1493,"./isValid":1494,"./milliseconds":1495,"./minutes":1496,"./months":1497,"./seconds":1498,"./span":1499,"./toArray":1500,"./toString":1501,"./union":1502,"./weeks":1510,"./years":1511,"dup":683,"sugar-core":809}],1475:[function(require,module,exports){
arguments[4][684][0].apply(exports,arguments)
},{"./cloneRangeMember":1477,"dup":684}],1476:[function(require,module,exports){
arguments[4][685][0].apply(exports,arguments)
},{"../../common/internal/defineOnPrototype":914,"../../common/internal/forEach":920,"../../common/internal/simpleCapitalize":962,"../../common/var/trunc":989,"../var/DURATION_UNITS":1504,"../var/MULTIPLIERS":1508,"./Range":1475,"./rangeEvery":1490,"dup":685}],1477:[function(require,module,exports){
arguments[4][686][0].apply(exports,arguments)
},{"../../common/var/classChecks":983,"./getRangeMemberPrimitiveValue":1484,"dup":686}],1478:[function(require,module,exports){
arguments[4][687][0].apply(exports,arguments)
},{"../../common/var/namespaceAliases":988,"../var/DurationTextFormats":1506,"./Range":1475,"./getDateForRange":1479,"./getDateIncrementObject":1480,"./incrementDate":1485,"dup":687}],1479:[function(require,module,exports){
arguments[4][688][0].apply(exports,arguments)
},{"../../common/var/classChecks":983,"../../common/var/namespaceAliases":988,"dup":688}],1480:[function(require,module,exports){
arguments[4][689][0].apply(exports,arguments)
},{"../../common/internal/simpleCapitalize":962,"../../common/var/classChecks":983,"../var/DURATION_REG":1503,"dup":689}],1481:[function(require,module,exports){
arguments[4][690][0].apply(exports,arguments)
},{"../../common/var/mathAliases":986,"./getPrecision":1482,"dup":690}],1482:[function(require,module,exports){
arguments[4][691][0].apply(exports,arguments)
},{"../../common/internal/periodSplit":954,"dup":691}],1483:[function(require,module,exports){
arguments[4][692][0].apply(exports,arguments)
},{"../../common/var/classChecks":983,"dup":692}],1484:[function(require,module,exports){
arguments[4][693][0].apply(exports,arguments)
},{"../../common/var/classChecks":983,"dup":693}],1485:[function(require,module,exports){
arguments[4][694][0].apply(exports,arguments)
},{"../../common/internal/callDateGet":899,"../../common/internal/callDateSet":900,"../var/MULTIPLIERS":1508,"dup":694}],1486:[function(require,module,exports){
arguments[4][695][0].apply(exports,arguments)
},{"../../common/internal/withPrecision":969,"dup":695}],1487:[function(require,module,exports){
arguments[4][696][0].apply(exports,arguments)
},{"../../common/var/chr":982,"dup":696}],1488:[function(require,module,exports){
arguments[4][697][0].apply(exports,arguments)
},{"./getRangeMemberPrimitiveValue":1484,"./valueIsNotInfinite":1492,"dup":697}],1489:[function(require,module,exports){
arguments[4][698][0].apply(exports,arguments)
},{"./cloneRangeMember":1477,"dup":698}],1490:[function(require,module,exports){
arguments[4][699][0].apply(exports,arguments)
},{"../../common/var/classChecks":983,"./getDateIncrementObject":1480,"./getGreaterPrecision":1481,"./incrementDate":1485,"./incrementNumber":1486,"./incrementString":1487,"./rangeIsValid":1491,"dup":699}],1491:[function(require,module,exports){
arguments[4][700][0].apply(exports,arguments)
},{"./isValidRangeMember":1488,"dup":700}],1492:[function(require,module,exports){
arguments[4][701][0].apply(exports,arguments)
},{"dup":701}],1493:[function(require,module,exports){
arguments[4][702][0].apply(exports,arguments)
},{"../common/internal/defineOnPrototype":914,"./internal/Range":1475,"dup":702}],1494:[function(require,module,exports){
arguments[4][703][0].apply(exports,arguments)
},{"../common/internal/defineOnPrototype":914,"./internal/Range":1475,"./internal/rangeIsValid":1491,"dup":703}],1495:[function(require,module,exports){
arguments[4][704][0].apply(exports,arguments)
},{"./build/buildDateRangeUnitsCall":1467,"dup":704}],1496:[function(require,module,exports){
arguments[4][705][0].apply(exports,arguments)
},{"./build/buildDateRangeUnitsCall":1467,"dup":705}],1497:[function(require,module,exports){
arguments[4][706][0].apply(exports,arguments)
},{"./build/buildDateRangeUnitsCall":1467,"dup":706}],1498:[function(require,module,exports){
arguments[4][707][0].apply(exports,arguments)
},{"./build/buildDateRangeUnitsCall":1467,"dup":707}],1499:[function(require,module,exports){
arguments[4][708][0].apply(exports,arguments)
},{"../common/internal/defineOnPrototype":914,"../common/var/mathAliases":986,"./internal/Range":1475,"./internal/getRangeMemberNumericValue":1483,"./internal/rangeIsValid":1491,"dup":708}],1500:[function(require,module,exports){
arguments[4][709][0].apply(exports,arguments)
},{"../common/internal/defineOnPrototype":914,"./internal/Range":1475,"./internal/rangeEvery":1490,"dup":709}],1501:[function(require,module,exports){
arguments[4][710][0].apply(exports,arguments)
},{"../common/internal/defineOnPrototype":914,"./internal/Range":1475,"./internal/rangeIsValid":1491,"dup":710}],1502:[function(require,module,exports){
arguments[4][711][0].apply(exports,arguments)
},{"../common/internal/defineOnPrototype":914,"./internal/Range":1475,"dup":711}],1503:[function(require,module,exports){
arguments[4][712][0].apply(exports,arguments)
},{"./DURATION_UNITS":1504,"dup":712}],1504:[function(require,module,exports){
arguments[4][713][0].apply(exports,arguments)
},{"dup":713}],1505:[function(require,module,exports){
arguments[4][714][0].apply(exports,arguments)
},{"../../common/var/classChecks":983,"../internal/Range":1475,"../internal/createDateRangeFromString":1478,"../internal/getDateForRange":1479,"dup":714}],1506:[function(require,module,exports){
arguments[4][715][0].apply(exports,arguments)
},{"./FULL_CAPTURED_DURATION":1507,"dup":715}],1507:[function(require,module,exports){
arguments[4][716][0].apply(exports,arguments)
},{"./DURATION_UNITS":1504,"dup":716}],1508:[function(require,module,exports){
arguments[4][717][0].apply(exports,arguments)
},{"dup":717}],1509:[function(require,module,exports){
arguments[4][718][0].apply(exports,arguments)
},{"../internal/Range":1475,"dup":718}],1510:[function(require,module,exports){
arguments[4][719][0].apply(exports,arguments)
},{"./build/buildDateRangeUnitsCall":1467,"dup":719}],1511:[function(require,module,exports){
arguments[4][720][0].apply(exports,arguments)
},{"./build/buildDateRangeUnitsCall":1467,"dup":720}],1512:[function(require,module,exports){
arguments[4][721][0].apply(exports,arguments)
},{"../common/internal/getRegExpFlags":931,"dup":721,"sugar-core":809}],1513:[function(require,module,exports){
arguments[4][722][0].apply(exports,arguments)
},{"../common/internal/escapeRegExp":917,"dup":722,"sugar-core":809}],1514:[function(require,module,exports){
arguments[4][723][0].apply(exports,arguments)
},{"../common/internal/getRegExpFlags":931,"dup":723,"sugar-core":809}],1515:[function(require,module,exports){
arguments[4][724][0].apply(exports,arguments)
},{"./addFlags":1512,"./escape":1513,"./getFlags":1514,"./removeFlags":1516,"./setFlags":1517,"dup":724,"sugar-core":809}],1516:[function(require,module,exports){
arguments[4][725][0].apply(exports,arguments)
},{"../common/internal/allCharsReg":894,"../common/internal/getRegExpFlags":931,"dup":725,"sugar-core":809}],1517:[function(require,module,exports){
arguments[4][726][0].apply(exports,arguments)
},{"dup":726,"sugar-core":809}],1518:[function(require,module,exports){
arguments[4][727][0].apply(exports,arguments)
},{"../common/internal/getEntriesForIndexes":924,"dup":727,"sugar-core":809}],1519:[function(require,module,exports){
arguments[4][728][0].apply(exports,arguments)
},{"./internal/stringCamelize":1544,"dup":728,"sugar-core":809}],1520:[function(require,module,exports){
arguments[4][729][0].apply(exports,arguments)
},{"./internal/stringCapitalize":1545,"dup":729,"sugar-core":809}],1521:[function(require,module,exports){
arguments[4][730][0].apply(exports,arguments)
},{"./internal/stringEach":1547,"dup":730,"sugar-core":809}],1522:[function(require,module,exports){
arguments[4][731][0].apply(exports,arguments)
},{"./internal/stringCodes":1546,"dup":731,"sugar-core":809}],1523:[function(require,module,exports){
arguments[4][732][0].apply(exports,arguments)
},{"../common/internal/trim":968,"dup":732,"sugar-core":809}],1524:[function(require,module,exports){
arguments[4][733][0].apply(exports,arguments)
},{"./internal/stringUnderscore":1552,"dup":733,"sugar-core":809}],1525:[function(require,module,exports){
arguments[4][734][0].apply(exports,arguments)
},{"./var/base64":1596,"dup":734,"sugar-core":809}],1526:[function(require,module,exports){
arguments[4][735][0].apply(exports,arguments)
},{"./var/base64":1596,"dup":735,"sugar-core":809}],1527:[function(require,module,exports){
arguments[4][736][0].apply(exports,arguments)
},{"../common/var/coreUtilityAliases":984,"./var/HTMLToEntityMap":1588,"./var/HTML_ESCAPE_REG":1590,"dup":736,"sugar-core":809}],1528:[function(require,module,exports){
arguments[4][737][0].apply(exports,arguments)
},{"dup":737,"sugar-core":809}],1529:[function(require,module,exports){
arguments[4][738][0].apply(exports,arguments)
},{"../common/internal/isUndefined":946,"dup":738,"sugar-core":809}],1530:[function(require,module,exports){
arguments[4][739][0].apply(exports,arguments)
},{"./internal/stringEach":1547,"dup":739,"sugar-core":809}],1531:[function(require,module,exports){
arguments[4][740][0].apply(exports,arguments)
},{"../common/internal/isObjectType":942,"./var/stringFormatMatcher":1598,"dup":740,"sugar-core":809}],1532:[function(require,module,exports){
arguments[4][741][0].apply(exports,arguments)
},{"./internal/numberOrIndex":1538,"dup":741,"sugar-core":809}],1533:[function(require,module,exports){
arguments[4][742][0].apply(exports,arguments)
},{"../common/internal/fixArgumentLength":919,"../common/var/ENHANCEMENTS_FLAG":972,"./internal/callIncludesWithRegexSupport":1536,"./var/STRING_ENHANCEMENTS_FLAG":1594,"dup":742,"sugar-core":809}],1534:[function(require,module,exports){
arguments[4][743][0].apply(exports,arguments)
},{"./at":1518,"./camelize":1519,"./capitalize":1520,"./chars":1521,"./codes":1522,"./compact":1523,"./dasherize":1524,"./decodeBase64":1525,"./encodeBase64":1526,"./escapeHTML":1527,"./escapeURL":1528,"./first":1529,"./forEach":1530,"./format":1531,"./from":1532,"./includes":1533,"./insert":1535,"./isBlank":1557,"./isEmpty":1558,"./last":1559,"./lines":1560,"./pad":1561,"./padLeft":1562,"./padRight":1563,"./parameterize":1564,"./remove":1566,"./removeAll":1567,"./removeTags":1568,"./replaceAll":1569,"./reverse":1570,"./shift":1571,"./spacify":1572,"./stripTags":1573,"./titleize":1574,"./to":1575,"./toNumber":1576,"./trimLeft":1577,"./trimRight":1578,"./truncate":1579,"./truncateOnWord":1580,"./underscore":1581,"./unescapeHTML":1582,"./unescapeURL":1583,"./words":1599,"dup":743,"sugar-core":809}],1535:[function(require,module,exports){
arguments[4][744][0].apply(exports,arguments)
},{"../common/internal/isUndefined":946,"dup":744,"sugar-core":809}],1536:[function(require,module,exports){
arguments[4][745][0].apply(exports,arguments)
},{"../../common/var/classChecks":983,"../var/nativeIncludes":1597,"dup":745}],1537:[function(require,module,exports){
arguments[4][746][0].apply(exports,arguments)
},{"../../common/internal/trim":968,"./stringEach":1547,"dup":746}],1538:[function(require,module,exports){
arguments[4][747][0].apply(exports,arguments)
},{"../../common/var/classChecks":983,"dup":747}],1539:[function(require,module,exports){
arguments[4][748][0].apply(exports,arguments)
},{"../../common/internal/isDefined":940,"../../common/internal/repeatString":957,"dup":748}],1540:[function(require,module,exports){
arguments[4][749][0].apply(exports,arguments)
},{"../../common/internal/escapeRegExp":917,"../../common/internal/map":949,"../../common/var/classChecks":983,"./runTagReplacements":1543,"dup":749}],1541:[function(require,module,exports){
arguments[4][750][0].apply(exports,arguments)
},{"dup":750}],1542:[function(require,module,exports){
arguments[4][751][0].apply(exports,arguments)
},{"dup":751}],1543:[function(require,module,exports){
arguments[4][752][0].apply(exports,arguments)
},{"../../common/var/classChecks":983,"./tagIsVoid":1553,"dup":752}],1544:[function(require,module,exports){
arguments[4][753][0].apply(exports,arguments)
},{"../../common/internal/getAcronym":923,"../var/CAMELIZE_REG":1584,"./stringCapitalize":1545,"./stringUnderscore":1552,"dup":753}],1545:[function(require,module,exports){
arguments[4][754][0].apply(exports,arguments)
},{"../../common/internal/simpleCapitalize":962,"../var/CAPITALIZE_REG":1585,"dup":754}],1546:[function(require,module,exports){
arguments[4][755][0].apply(exports,arguments)
},{"dup":755}],1547:[function(require,module,exports){
arguments[4][756][0].apply(exports,arguments)
},{"../../common/internal/escapeRegExp":917,"../../common/internal/getRegExpFlags":931,"../../common/internal/isDefined":940,"../../common/var/classChecks":983,"./runGlobalMatch":1542,"dup":756}],1548:[function(require,module,exports){
arguments[4][757][0].apply(exports,arguments)
},{"../../common/internal/escapeRegExp":917,"dup":757}],1549:[function(require,module,exports){
arguments[4][758][0].apply(exports,arguments)
},{"../../common/internal/escapeRegExp":917,"../../common/internal/getRegExpFlags":931,"../../common/var/classChecks":983,"dup":758}],1550:[function(require,module,exports){
arguments[4][759][0].apply(exports,arguments)
},{"./stringUnderscore":1552,"dup":759}],1551:[function(require,module,exports){
arguments[4][760][0].apply(exports,arguments)
},{"../../common/internal/getAcronym":923,"../../common/internal/getHumanWord":925,"../../common/internal/indexOf":937,"../../common/internal/runHumanRules":958,"../var/DOWNCASED_WORDS":1586,"./eachWord":1537,"./stringCapitalize":1545,"./stringSpacify":1550,"dup":760}],1552:[function(require,module,exports){
arguments[4][761][0].apply(exports,arguments)
},{"../../common/var/Inflections":974,"dup":761}],1553:[function(require,module,exports){
arguments[4][762][0].apply(exports,arguments)
},{"../../common/internal/indexOf":937,"../var/HTML_VOID_ELEMENTS":1591,"dup":762}],1554:[function(require,module,exports){
arguments[4][763][0].apply(exports,arguments)
},{"../../common/internal/filter":918,"../var/TRUNC_REG":1595,"./reverseString":1541,"dup":763}],1555:[function(require,module,exports){
arguments[4][764][0].apply(exports,arguments)
},{"../../common/internal/isUndefined":946,"../../common/var/mathAliases":986,"./truncateOnWord":1554,"dup":764}],1556:[function(require,module,exports){
arguments[4][765][0].apply(exports,arguments)
},{"../../common/var/chr":982,"../var/HTMLFromEntityMap":1587,"../var/HTML_ENTITY_REG":1589,"dup":765}],1557:[function(require,module,exports){
arguments[4][766][0].apply(exports,arguments)
},{"../common/internal/trim":968,"dup":766,"sugar-core":809}],1558:[function(require,module,exports){
arguments[4][767][0].apply(exports,arguments)
},{"dup":767,"sugar-core":809}],1559:[function(require,module,exports){
arguments[4][768][0].apply(exports,arguments)
},{"../common/internal/isUndefined":946,"dup":768,"sugar-core":809}],1560:[function(require,module,exports){
arguments[4][769][0].apply(exports,arguments)
},{"../common/internal/trim":968,"./internal/stringEach":1547,"dup":769,"sugar-core":809}],1561:[function(require,module,exports){
arguments[4][770][0].apply(exports,arguments)
},{"../common/internal/coercePositiveInteger":901,"../common/var/mathAliases":986,"./internal/padString":1539,"dup":770,"sugar-core":809}],1562:[function(require,module,exports){
arguments[4][771][0].apply(exports,arguments)
},{"../common/internal/coercePositiveInteger":901,"../common/var/mathAliases":986,"./internal/padString":1539,"dup":771,"sugar-core":809}],1563:[function(require,module,exports){
arguments[4][772][0].apply(exports,arguments)
},{"../common/internal/coercePositiveInteger":901,"../common/var/mathAliases":986,"./internal/padString":1539,"dup":772,"sugar-core":809}],1564:[function(require,module,exports){
arguments[4][773][0].apply(exports,arguments)
},{"./internal/stringParameterize":1548,"dup":773,"sugar-core":809}],1565:[function(require,module,exports){
arguments[4][774][0].apply(exports,arguments)
},{"../range/var/PrimitiveRangeConstructor":1509,"dup":774,"sugar-core":809}],1566:[function(require,module,exports){
arguments[4][775][0].apply(exports,arguments)
},{"dup":775,"sugar-core":809}],1567:[function(require,module,exports){
arguments[4][776][0].apply(exports,arguments)
},{"./internal/stringReplaceAll":1549,"dup":776,"sugar-core":809}],1568:[function(require,module,exports){
arguments[4][777][0].apply(exports,arguments)
},{"./internal/replaceTags":1540,"dup":777,"sugar-core":809}],1569:[function(require,module,exports){
arguments[4][778][0].apply(exports,arguments)
},{"./internal/stringReplaceAll":1549,"dup":778,"sugar-core":809}],1570:[function(require,module,exports){
arguments[4][779][0].apply(exports,arguments)
},{"./internal/reverseString":1541,"dup":779,"sugar-core":809}],1571:[function(require,module,exports){
arguments[4][780][0].apply(exports,arguments)
},{"../common/var/chr":982,"./internal/stringCodes":1546,"dup":780,"sugar-core":809}],1572:[function(require,module,exports){
arguments[4][781][0].apply(exports,arguments)
},{"./internal/stringSpacify":1550,"dup":781,"sugar-core":809}],1573:[function(require,module,exports){
arguments[4][782][0].apply(exports,arguments)
},{"./internal/replaceTags":1540,"dup":782,"sugar-core":809}],1574:[function(require,module,exports){
arguments[4][783][0].apply(exports,arguments)
},{"./internal/stringTitleize":1551,"dup":783,"sugar-core":809}],1575:[function(require,module,exports){
arguments[4][784][0].apply(exports,arguments)
},{"../common/internal/isUndefined":946,"./internal/numberOrIndex":1538,"dup":784,"sugar-core":809}],1576:[function(require,module,exports){
arguments[4][785][0].apply(exports,arguments)
},{"../common/internal/stringToNumber":967,"dup":785,"sugar-core":809}],1577:[function(require,module,exports){
arguments[4][786][0].apply(exports,arguments)
},{"./var/LEFT_TRIM_REG":1592,"dup":786,"sugar-core":809}],1578:[function(require,module,exports){
arguments[4][787][0].apply(exports,arguments)
},{"./var/RIGHT_TRIM_REG":1593,"dup":787,"sugar-core":809}],1579:[function(require,module,exports){
arguments[4][788][0].apply(exports,arguments)
},{"./internal/truncateString":1555,"dup":788,"sugar-core":809}],1580:[function(require,module,exports){
arguments[4][789][0].apply(exports,arguments)
},{"./internal/truncateString":1555,"dup":789,"sugar-core":809}],1581:[function(require,module,exports){
arguments[4][790][0].apply(exports,arguments)
},{"./internal/stringUnderscore":1552,"dup":790,"sugar-core":809}],1582:[function(require,module,exports){
arguments[4][791][0].apply(exports,arguments)
},{"./internal/unescapeHTML":1556,"dup":791,"sugar-core":809}],1583:[function(require,module,exports){
arguments[4][792][0].apply(exports,arguments)
},{"dup":792,"sugar-core":809}],1584:[function(require,module,exports){
arguments[4][793][0].apply(exports,arguments)
},{"dup":793}],1585:[function(require,module,exports){
arguments[4][794][0].apply(exports,arguments)
},{"dup":794}],1586:[function(require,module,exports){
arguments[4][795][0].apply(exports,arguments)
},{"dup":795}],1587:[function(require,module,exports){
arguments[4][796][0].apply(exports,arguments)
},{"dup":796}],1588:[function(require,module,exports){
arguments[4][797][0].apply(exports,arguments)
},{"../../common/var/coreUtilityAliases":984,"./HTMLFromEntityMap":1587,"dup":797}],1589:[function(require,module,exports){
arguments[4][798][0].apply(exports,arguments)
},{"dup":798}],1590:[function(require,module,exports){
arguments[4][799][0].apply(exports,arguments)
},{"dup":799}],1591:[function(require,module,exports){
arguments[4][800][0].apply(exports,arguments)
},{"dup":800}],1592:[function(require,module,exports){
arguments[4][801][0].apply(exports,arguments)
},{"../../common/var/TRIM_CHARS":980,"dup":801}],1593:[function(require,module,exports){
arguments[4][802][0].apply(exports,arguments)
},{"../../common/var/TRIM_CHARS":980,"dup":802}],1594:[function(require,module,exports){
arguments[4][803][0].apply(exports,arguments)
},{"dup":803}],1595:[function(require,module,exports){
arguments[4][804][0].apply(exports,arguments)
},{"../../common/var/TRIM_CHARS":980,"dup":804}],1596:[function(require,module,exports){
arguments[4][805][0].apply(exports,arguments)
},{"../../common/var/chr":982,"buffer":1604,"dup":805}],1597:[function(require,module,exports){
arguments[4][806][0].apply(exports,arguments)
},{"dup":806}],1598:[function(require,module,exports){
arguments[4][807][0].apply(exports,arguments)
},{"../../common/internal/createFormatMatcher":905,"../../common/internal/deepGetProperty":907,"dup":807}],1599:[function(require,module,exports){
arguments[4][808][0].apply(exports,arguments)
},{"../common/internal/trim":968,"./internal/stringEach":1547,"dup":808,"sugar-core":809}],1600:[function(require,module,exports){
"use strict";

const Request = require("./request");

class Dispatch {
    
    constructor(id) {
        this.id = 1 || id;
        this.requests = { };
    }
    
    singleton(call, send, cancel, timeout, event) {
        if (this.requests[event]) {
            return this.requests[event];
        }
        else {
            let request = new Request(this, event, call, send, cancel, timeout);
            this.requests[event] = request;
            return request;
        }
    }
    
    instance(call, send, cancel, timeout) {
        let request = new Request(this, this.id, call, send, cancel, timeout);
        this.requests[request.id] = request;
        this.id++;
        return request;
    }
    
    data(id, data) {
        if (this.requests[id]) {
            this.requests[id].emit("data", data, () => this.cancel(id));
        }
    }
    
    end(id) {
        if (this.requests[id]) {
            this.requests[id].emit("end", () => this.cancel(id));
        }
    }
    
    error(id, err) {
        if (this.requests[id]) {
            this.requests[id].emit("error", err, () => this.cancel(id));
        }
    }
    
    cancel(id) {
        if (this.requests[id]) {
            this.requests[id].cancel();
        }
    }
    
    connected() {
        for (let p in this.requests) {
            if (this.requests[p] && this.requests[p].emit) {
                this.requests[p].emit("connected");
            }
        }
    }
    
    disconnected() {
        for (let p in this.requests) {
            if (this.requests[p] && this.requests[p].emit) {
                this.requests[p].emit("disconnected");
            }
        }
    }
    
}

module.exports = Dispatch;
},{"./request":1603}],1601:[function(require,module,exports){
"use strict";

const Dispatch = require("./dispatch"),
      relay = require("./relay");

class Proxy {
    
    constructor(socket, dispatch) {
        
        dispatch = dispatch || new Dispatch();
        
        socket.on("connected", msg => {
            dispatch.connected();
        }).on("disconnected", msg => {
            dispatch.disconnected();
        }).on("data", msg => {
            dispatch.data(msg.ref, msg.data);
        }).on("end", msg => {
            dispatch.end(msg.ref);
        }).on("error", msg => {
            dispatch.error(msg.ref, msg.error);
        });
        
        this.isProxy = true;
        
        this.socket = socket;
        
        this.dispatch = dispatch;
        
        this.relay = socket => relay(this, socket);
        
        this.autoOpenOrders = autoBind => {
            socket.emit("command", {
                fn: "autoOpenOrders",
                args: [ autoBind ]
            });
        };
        
        this.globalCancel = () => {
            socket.emit("command", {
                fn: "globalCancel",
                args: [ ]
            });
        };
        
        this.system = request("system", null, socket, dispatch);
        
        this.currentTime = request("currentTime", 2000, socket, dispatch);
        
        this.contractDetails = request("contractDetails", 10000, socket, dispatch);

        this.fundamentalData = request("fundamentalData", 20000, socket, dispatch);
        
        this.historicalData = request("historicalData", 20000, socket, dispatch);
        
        this.headTimestamp = request("headTimestamp", 20000, socket, dispatch);
        
        this.realTimeBars = request("realTimeBars", 10000, socket, dispatch);
        
        this.mktData = request("mktData", 10000, socket, dispatch);
        
        this.mktDepth = request("mktDepth", 10000, socket, dispatch);

        this.scannerParameters = request("scannerParameters", 10000, socket, dispatch);
        
        this.scannerSubscription = request("scannerSubscription", 10000, socket, dispatch);

        this.accountSummary = request("accountSummary", 10000, socket, dispatch);
        
        this.accountUpdates = request("accountUpdates", 10000, socket, dispatch);
        
        this.executions = request("executions", 10000, socket, dispatch);
        
        this.openOrders = request("openOrders", 10000, socket, dispatch);
        
        this.allOpenOrders = request("allOpenOrders", 10000, socket, dispatch);
        
        this.positions = request("positions", 10000, socket, dispatch);
        
        this.orderIds = request("orderIds", 10000, socket, dispatch);
        
        this.placeOrder = request("placeOrder", 10000, socket, dispatch);
        
        this.exerciseOptions = request("exerciseOptions", 10000, socket, dispatch);
        
        this.newsBulletins = request("newsBulletins", null, socket, dispatch);
        
        this.queryDisplayGroups = request("queryDisplayGroups", 10000, socket, dispatch);
        
        this.subscribeToGroupEvents = request("subscribeToGroupEvents", 10000, socket, dispatch);
        
        this.updateDisplayGroup = function(ref, contract) {
            socket.emit("request", {
                fn: "updateDisplayGroup",
                args: [ contract ],
                ref: ref
            });
        };
        
    }
    
}

function request(fn, timeout, socket, dispatch) {
    return function() {
        let args = Array.create(arguments);
        return dispatch.instance(
            fn, 
            req => {
                socket.emit("request", {
                    fn: fn,
                    args: args,
                    ref: req.id
                });
            }, 
            req => {
                socket.emit("cancel", { 
                    ref: req.id
                });
            }, 
            timeout
        );
    };
}

module.exports = Proxy;
},{"./dispatch":1600,"./relay":1602}],1602:[function(require,module,exports){
"use strict";

function relay(service, socket) {
    let map = { };
    
    socket.on("command", command => {
        service[command.fn](...command.args);
    });
    
    socket.on("request", request => {
        request.args = request.args || [ ];
        let req = service[request.fn](...request.args);
        map[request.ref] = req.id;
        req.proxy(socket, request.ref).send();
    }).on("cancel", request => {
        service.dispatch.cancel(map[request.ref]);
        delete map[request.ref];
    });

    let onConnected = () => socket.emit("connected", { time: Date.create() }),
        onDisconnected = () => socket.emit("disconnected", { time: Date.create() });
    
    service.socket
        .on("connected", onConnected)
        .on("disconnected", onDisconnected);

    socket.on("disconnect", () => { 
        Object.values(map).forEach(id => service.dispatch.cancel(id));
        map = null;
        
        service.socket.removeListener("connected", onConnected);
        service.socket.removeListener("disconnected", onDisconnected);
    });
    
    socket.on("error", err => {
        console.log(err);
    });
    
    socket.emit("connected", { time: Date.create() });
}

module.exports = relay;
},{}],1603:[function(require,module,exports){
"use strict";

const Events = require("events");

class Request extends Events {
    
    constructor(dispatch, id, call, send, cancel, timeout, oneOff) {
        super();
        
        this.dispatch = dispatch;
        this.id = id;
        this.call = call;
        
        if (!Object.isFunction(send)) {
            throw new Error("Send must be a function.");
        }
        else {
            this.send = () => {
                if (timeout) {
                    if (!Object.isNumber(timeout) || timeout <= 0) {
                        throw new Error("Timeout must be a positive number.");
                    }

                    this.timeout = setTimeout(() => {
                        this.cancel();

                        let timeoutError = new Error("Request " + (this.call || this.id) + " timed out.");
                        timeoutError.timeout = timeout;
                        this.emit("error", timeoutError, () => this.cancel());
                    }, timeout);

                    this.once("data", () => {
                        if (oneOff) {
                            this.cancel();
                        }
                        else if (this.timeout) {
                            clearTimeout(this.timeout);
                            delete this.timeout;
                        }
                    });

                    this.once("end", () => {
                        if (oneOff) {
                            this.cancel();
                        }
                        else if (this.timeout) {
                            clearTimeout(this.timeout);
                            delete this.timeout;
                        }
                    });

                    this.once("error", () => {
                        if (oneOff) {
                            this.cancel();
                        }
                        else if (this.timeout) {
                            clearTimeout(this.timeout);
                            delete this.timeout;
                        }
                    });
                }
                
                send(this);
                return this;
            };
        }
        
        if (cancel) {
            if (!Object.isFunction(cancel)) {
                throw new Error("Cancel must be a function.");
            }
            
            this.cancel = () => {
                if (this.timeout) {
                    clearTimeout(this.timeout);
                    delete this.timeout;
                }
                
                cancel(this);
                delete this.dispatch.requests[this.id];
                this.emit("close");
                
                this.cancel = () => { };
            };
        }
        else {
            this.cancel = () => {
                if (this.timeout) {
                    clearTimeout(this.timeout);
                    delete this.timeout;
                }
                
                delete this.dispatch.requests[this.id];
                this.emit("close");
                
                this.cancel = () => { };
            };
        }
    }
    
    proxy(destination, ref) {
        let id = this.id;
        this.on("data", data => { 
            destination.emit("data", { id: id, data: data, ref: ref }); 
        });
        
        this.on("end", () => { 
            destination.emit("end", { id: id, ref: ref }); 
        });
        
        this.on("error", error => { 
            destination.emit("error", { 
                id: id, 
                error: { message: error.message, stack: error.stack, timeout: error.timeout }, 
                ref: ref 
            }); 
        });
        
        return this;
    }
    
}

module.exports = Request;
},{"events":1605}],1604:[function(require,module,exports){

},{}],1605:[function(require,module,exports){
// Copyright Joyent, Inc. and other Node contributors.
//
// Permission is hereby granted, free of charge, to any person obtaining a
// copy of this software and associated documentation files (the
// "Software"), to deal in the Software without restriction, including
// without limitation the rights to use, copy, modify, merge, publish,
// distribute, sublicense, and/or sell copies of the Software, and to permit
// persons to whom the Software is furnished to do so, subject to the
// following conditions:
//
// The above copyright notice and this permission notice shall be included
// in all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
// OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN
// NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
// DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
// OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
// USE OR OTHER DEALINGS IN THE SOFTWARE.

function EventEmitter() {
  this._events = this._events || {};
  this._maxListeners = this._maxListeners || undefined;
}
module.exports = EventEmitter;

// Backwards-compat with node 0.10.x
EventEmitter.EventEmitter = EventEmitter;

EventEmitter.prototype._events = undefined;
EventEmitter.prototype._maxListeners = undefined;

// By default EventEmitters will print a warning if more than 10 listeners are
// added to it. This is a useful default which helps finding memory leaks.
EventEmitter.defaultMaxListeners = 10;

// Obviously not all Emitters should be limited to 10. This function allows
// that to be increased. Set to zero for unlimited.
EventEmitter.prototype.setMaxListeners = function(n) {
  if (!isNumber(n) || n < 0 || isNaN(n))
    throw TypeError('n must be a positive number');
  this._maxListeners = n;
  return this;
};

EventEmitter.prototype.emit = function(type) {
  var er, handler, len, args, i, listeners;

  if (!this._events)
    this._events = {};

  // If there is no 'error' event listener then throw.
  if (type === 'error') {
    if (!this._events.error ||
        (isObject(this._events.error) && !this._events.error.length)) {
      er = arguments[1];
      if (er instanceof Error) {
        throw er; // Unhandled 'error' event
      } else {
        // At least give some kind of context to the user
        var err = new Error('Uncaught, unspecified "error" event. (' + er + ')');
        err.context = er;
        throw err;
      }
    }
  }

  handler = this._events[type];

  if (isUndefined(handler))
    return false;

  if (isFunction(handler)) {
    switch (arguments.length) {
      // fast cases
      case 1:
        handler.call(this);
        break;
      case 2:
        handler.call(this, arguments[1]);
        break;
      case 3:
        handler.call(this, arguments[1], arguments[2]);
        break;
      // slower
      default:
        args = Array.prototype.slice.call(arguments, 1);
        handler.apply(this, args);
    }
  } else if (isObject(handler)) {
    args = Array.prototype.slice.call(arguments, 1);
    listeners = handler.slice();
    len = listeners.length;
    for (i = 0; i < len; i++)
      listeners[i].apply(this, args);
  }

  return true;
};

EventEmitter.prototype.addListener = function(type, listener) {
  var m;

  if (!isFunction(listener))
    throw TypeError('listener must be a function');

  if (!this._events)
    this._events = {};

  // To avoid recursion in the case that type === "newListener"! Before
  // adding it to the listeners, first emit "newListener".
  if (this._events.newListener)
    this.emit('newListener', type,
              isFunction(listener.listener) ?
              listener.listener : listener);

  if (!this._events[type])
    // Optimize the case of one listener. Don't need the extra array object.
    this._events[type] = listener;
  else if (isObject(this._events[type]))
    // If we've already got an array, just append.
    this._events[type].push(listener);
  else
    // Adding the second element, need to change to array.
    this._events[type] = [this._events[type], listener];

  // Check for listener leak
  if (isObject(this._events[type]) && !this._events[type].warned) {
    if (!isUndefined(this._maxListeners)) {
      m = this._maxListeners;
    } else {
      m = EventEmitter.defaultMaxListeners;
    }

    if (m && m > 0 && this._events[type].length > m) {
      this._events[type].warned = true;
      console.error('(node) warning: possible EventEmitter memory ' +
                    'leak detected. %d listeners added. ' +
                    'Use emitter.setMaxListeners() to increase limit.',
                    this._events[type].length);
      if (typeof console.trace === 'function') {
        // not supported in IE 10
        console.trace();
      }
    }
  }

  return this;
};

EventEmitter.prototype.on = EventEmitter.prototype.addListener;

EventEmitter.prototype.once = function(type, listener) {
  if (!isFunction(listener))
    throw TypeError('listener must be a function');

  var fired = false;

  function g() {
    this.removeListener(type, g);

    if (!fired) {
      fired = true;
      listener.apply(this, arguments);
    }
  }

  g.listener = listener;
  this.on(type, g);

  return this;
};

// emits a 'removeListener' event iff the listener was removed
EventEmitter.prototype.removeListener = function(type, listener) {
  var list, position, length, i;

  if (!isFunction(listener))
    throw TypeError('listener must be a function');

  if (!this._events || !this._events[type])
    return this;

  list = this._events[type];
  length = list.length;
  position = -1;

  if (list === listener ||
      (isFunction(list.listener) && list.listener === listener)) {
    delete this._events[type];
    if (this._events.removeListener)
      this.emit('removeListener', type, listener);

  } else if (isObject(list)) {
    for (i = length; i-- > 0;) {
      if (list[i] === listener ||
          (list[i].listener && list[i].listener === listener)) {
        position = i;
        break;
      }
    }

    if (position < 0)
      return this;

    if (list.length === 1) {
      list.length = 0;
      delete this._events[type];
    } else {
      list.splice(position, 1);
    }

    if (this._events.removeListener)
      this.emit('removeListener', type, listener);
  }

  return this;
};

EventEmitter.prototype.removeAllListeners = function(type) {
  var key, listeners;

  if (!this._events)
    return this;

  // not listening for removeListener, no need to emit
  if (!this._events.removeListener) {
    if (arguments.length === 0)
      this._events = {};
    else if (this._events[type])
      delete this._events[type];
    return this;
  }

  // emit removeListener for all listeners on all events
  if (arguments.length === 0) {
    for (key in this._events) {
      if (key === 'removeListener') continue;
      this.removeAllListeners(key);
    }
    this.removeAllListeners('removeListener');
    this._events = {};
    return this;
  }

  listeners = this._events[type];

  if (isFunction(listeners)) {
    this.removeListener(type, listeners);
  } else if (listeners) {
    // LIFO order
    while (listeners.length)
      this.removeListener(type, listeners[listeners.length - 1]);
  }
  delete this._events[type];

  return this;
};

EventEmitter.prototype.listeners = function(type) {
  var ret;
  if (!this._events || !this._events[type])
    ret = [];
  else if (isFunction(this._events[type]))
    ret = [this._events[type]];
  else
    ret = this._events[type].slice();
  return ret;
};

EventEmitter.prototype.listenerCount = function(type) {
  if (this._events) {
    var evlistener = this._events[type];

    if (isFunction(evlistener))
      return 1;
    else if (evlistener)
      return evlistener.length;
  }
  return 0;
};

EventEmitter.listenerCount = function(emitter, type) {
  return emitter.listenerCount(type);
};

function isFunction(arg) {
  return typeof arg === 'function';
}

function isNumber(arg) {
  return typeof arg === 'number';
}

function isObject(arg) {
  return typeof arg === 'object' && arg !== null;
}

function isUndefined(arg) {
  return arg === void 0;
}

},{}],1606:[function(require,module,exports){
// shim for using process in browser
var process = module.exports = {};

// cached from whatever global is present so that test runners that stub it
// don't break things.  But we need to wrap it in a try catch in case it is
// wrapped in strict mode code which doesn't define any globals.  It's inside a
// function because try/catches deoptimize in certain engines.

var cachedSetTimeout;
var cachedClearTimeout;

function defaultSetTimout() {
    throw new Error('setTimeout has not been defined');
}
function defaultClearTimeout () {
    throw new Error('clearTimeout has not been defined');
}
(function () {
    try {
        if (typeof setTimeout === 'function') {
            cachedSetTimeout = setTimeout;
        } else {
            cachedSetTimeout = defaultSetTimout;
        }
    } catch (e) {
        cachedSetTimeout = defaultSetTimout;
    }
    try {
        if (typeof clearTimeout === 'function') {
            cachedClearTimeout = clearTimeout;
        } else {
            cachedClearTimeout = defaultClearTimeout;
        }
    } catch (e) {
        cachedClearTimeout = defaultClearTimeout;
    }
} ())
function runTimeout(fun) {
    if (cachedSetTimeout === setTimeout) {
        //normal enviroments in sane situations
        return setTimeout(fun, 0);
    }
    // if setTimeout wasn't available but was latter defined
    if ((cachedSetTimeout === defaultSetTimout || !cachedSetTimeout) && setTimeout) {
        cachedSetTimeout = setTimeout;
        return setTimeout(fun, 0);
    }
    try {
        // when when somebody has screwed with setTimeout but no I.E. maddness
        return cachedSetTimeout(fun, 0);
    } catch(e){
        try {
            // When we are in I.E. but the script has been evaled so I.E. doesn't trust the global object when called normally
            return cachedSetTimeout.call(null, fun, 0);
        } catch(e){
            // same as above but when it's a version of I.E. that must have the global object for 'this', hopfully our context correct otherwise it will throw a global error
            return cachedSetTimeout.call(this, fun, 0);
        }
    }


}
function runClearTimeout(marker) {
    if (cachedClearTimeout === clearTimeout) {
        //normal enviroments in sane situations
        return clearTimeout(marker);
    }
    // if clearTimeout wasn't available but was latter defined
    if ((cachedClearTimeout === defaultClearTimeout || !cachedClearTimeout) && clearTimeout) {
        cachedClearTimeout = clearTimeout;
        return clearTimeout(marker);
    }
    try {
        // when when somebody has screwed with setTimeout but no I.E. maddness
        return cachedClearTimeout(marker);
    } catch (e){
        try {
            // When we are in I.E. but the script has been evaled so I.E. doesn't  trust the global object when called normally
            return cachedClearTimeout.call(null, marker);
        } catch (e){
            // same as above but when it's a version of I.E. that must have the global object for 'this', hopfully our context correct otherwise it will throw a global error.
            // Some versions of I.E. have different rules for clearTimeout vs setTimeout
            return cachedClearTimeout.call(this, marker);
        }
    }



}
var queue = [];
var draining = false;
var currentQueue;
var queueIndex = -1;

function cleanUpNextTick() {
    if (!draining || !currentQueue) {
        return;
    }
    draining = false;
    if (currentQueue.length) {
        queue = currentQueue.concat(queue);
    } else {
        queueIndex = -1;
    }
    if (queue.length) {
        drainQueue();
    }
}

function drainQueue() {
    if (draining) {
        return;
    }
    var timeout = runTimeout(cleanUpNextTick);
    draining = true;

    var len = queue.length;
    while(len) {
        currentQueue = queue;
        queue = [];
        while (++queueIndex < len) {
            if (currentQueue) {
                currentQueue[queueIndex].run();
            }
        }
        queueIndex = -1;
        len = queue.length;
    }
    currentQueue = null;
    draining = false;
    runClearTimeout(timeout);
}

process.nextTick = function (fun) {
    var args = new Array(arguments.length - 1);
    if (arguments.length > 1) {
        for (var i = 1; i < arguments.length; i++) {
            args[i - 1] = arguments[i];
        }
    }
    queue.push(new Item(fun, args));
    if (queue.length === 1 && !draining) {
        runTimeout(drainQueue);
    }
};

// v8 likes predictible objects
function Item(fun, array) {
    this.fun = fun;
    this.array = array;
}
Item.prototype.run = function () {
    this.fun.apply(null, this.array);
};
process.title = 'browser';
process.browser = true;
process.env = {};
process.argv = [];
process.version = ''; // empty string to avoid regexp issues
process.versions = {};

function noop() {}

process.on = noop;
process.addListener = noop;
process.once = noop;
process.off = noop;
process.removeListener = noop;
process.removeAllListeners = noop;
process.emit = noop;
process.prependListener = noop;
process.prependOnceListener = noop;

process.listeners = function (name) { return [] }

process.binding = function (name) {
    throw new Error('process.binding is not supported');
};

process.cwd = function () { return '/' };
process.chdir = function (dir) {
    throw new Error('process.chdir is not supported');
};
process.umask = function() { return 0; };

},{}]},{},[1]);
