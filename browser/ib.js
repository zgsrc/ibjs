(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
var Session = require("../model/session"),
    Proxy = require("../service/proxy");

window.ib = {
    session: () => new Session(new Proxy(socket)),
    flags: require("../model/flags")
};
},{"../model/flags":7,"../model/session":20,"../service/proxy":22}],2:[function(require,module,exports){
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
},{"../realtime":19}],3:[function(require,module,exports){
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
},{"../flags":7,"../realtime":19}],4:[function(require,module,exports){
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
},{"../realtime":19}],5:[function(require,module,exports){
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
},{"../realtime":19}],6:[function(require,module,exports){
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
},{"../realtime":19}],7:[function(require,module,exports){
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
    financials: "ReportsFinSummary",
    ownership: "ReportsOwnership",
    snapshot: "ReportSnapshot",
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
    options: "OPT",
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

const MARKET_DATA_TYPE = {
    live: 1,
    frozen: 2,
    delayed: 3
};

exports.MARKET_DATA_TYPE = MARKET_DATA_TYPE;

},{}],8:[function(require,module,exports){
"use strict";

const MarketData = require("./marketdata"),
      studies = require("./studies"),
      flags = require("../flags");

class Bars extends MarketData {
    
    constructor(session, contract, charts, barSize) {
        super(session, contract);

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
},{"../flags":7,"./marketdata":14,"./studies":18}],9:[function(require,module,exports){
"use strict";

const MarketData = require("./marketdata");

class Chain extends MarketData {
    
    constructor(session, securities, symbol) {
        super(session, securities.sortBy(s => s.contract.expiry).map("contract"));
        
        let expirations = securities.groupBy(s => s.contract.summary.expiry);
        
        Object.keys(expirations).forEach(date => {
            expirations[date] = {
                calls: expirations[date].filter(s => s.contract.summary.right == "C").sortBy("strike"),
                puts: expirations[date].filter(s => s.contract.summary.right == "P").sortBy("strike")
            };
        });
        
        Object.defineProperty(this, "expirations", { value: expirations });
        Object.defineProperty(this, "symbol", { value: symbol || this.contract.first().summary.symbol + "_options" });
    }
    
}

module.exports = Chain;
},{"./marketdata":14}],10:[function(require,module,exports){
"use strict";

const MarketData = require("./marketdata"),
      Bars = require("./bars"),
      flags = require("../flags");

Date.getLocale('en').addFormat('{yyyy}{MM}{dd}  {hh}:{mm}:{ss}');

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
                text: "2 hours",
                integer: 7200,
                duration: "2 M"
            }).on("error", err => this.emit("error", err)),
            three: new Bars(session, contract, this, {
                text: "3 hours",
                integer: 10800,
                duration: "3 M"
            }).on("error", err => this.emit("error", err)),
            four: new Bars(session, contract, this, {
                text: "4 hours",
                integer: 14400,
                duration: "4 M"
            }).on("error", err => this.emit("error", err)),
            eight: new Bars(session, contract, this, {
                text: "8 hours",
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
            text: "1W",
            integer: 3600 * 24 * 7,
            duration: "2 Y"
        }).on("error", err => this.emit("error", err));
        
        this.monthly = new Bars(session, contract, this, {
            text: "1M",
            integer: 3600 * 24 * 7 * 30,
            duration: "5 Y" 
        }).on("error", err => this.emit("error", err));
    }
    
    get(text) {
        return this.all.find(f => f.barSize.text == text);
    }
    
    get all() {
        return Object.values(this.seconds)
                     .append(Object.values(this.minutes))
                     .append(Object.values(this.hours))
                     .append(this.daily)
                     .append(this.weekly)
                     .append(this.monthly);
    }
    
    each(cb) {
        Object.values(this.seconds).forEach(cb);
        Object.values(this.minutes).forEach(cb);
        Object.values(this.hours).forEach(cb);
        cb(this.daily);
        cb(this.weekly);
        cb(this.monthly);
        return this;
    }
    
    stream(retry) {
        this.service.headTimestamp(this.contract.summary, this.field, 0, 1).once("data", data => {
            this.earliestDataTimestamp = Date.create(data);
        }).send();
        
        let req = this.service.realTimeBars(this.contract.summary, 5, this.field, false).on("data", data => {
            data.date = Date.create(data.date * 1000);
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
},{"../flags":7,"./bars":8,"./marketdata":14}],11:[function(require,module,exports){
"use strict";

const flags = require("../flags"),
      RealTime = require("../realtime");

function details(session, summary, cb) {
    let list = [ ];
    session.service.contractDetails(summary)
        .on("data", contract => list.push(new Contract(session, contract)))
        .once("error", err => cb(err, list))
        .once("end", () => cb(null, list))
        .send();
}

function notify(time, cb) {
    if (time.isPast() || time.secondsFromNow() < 10) cb();
    else {
        return setTimeout(() => {
            setTimeout(() => {
                cb();
            }, time.millisecondsFromNow() - 5);
        }, time.millisecondsFromNow() - 5000);
    }
}

class Contract extends RealTime {
    
    constructor(session, data) {
        super(session);
        
        this._timers = [ ];
        this._exclude.push("_timers");
        
        this.merge(data);
    } 
    
    merge(data) {
        Object.merge(this, data);
        
        this.symbol = this.summary.localSymbol.compact().parameterize().underscore().toUpperCase();
        this.orderTypes = this.orderTypes.split(",").compact();
        this.validExchanges = this.validExchanges.split(",").compact();

        if (this.summary.expiry) {
            this.expiry = Date.create(Date.create(this.summary.expiry).format("{Month} {dd}, {yyyy}") + " 00:00:00 " + this.timeZoneId);
        }
        
        let timeZoneId = this.timeZoneId,
            tradingHours = (this.tradingHours || "").split(';').map(d => d.split(':')),
            liquidHours = (this.liquidHours || "").split(';').map(d => d.split(':'));
        
        let schedule = { };
        tradingHours.forEach(arr => {
            if (arr[1] == "CLOSED") return;
            
            let date = Date.create(arr[0], { future: true });
            
            let label = date.format("{Mon}{dd}");
            if (!schedule[label]) schedule[label] = { };
            
            let times = arr[1].split(',').map(d => d.split('-').map(t => t.to(2) + ":" + t.from(2)));
            
            schedule[label].start = [ ];
            schedule[label].end = [ ];
            
            times.forEach(time => {
                let start = Date.create(date.format("{Month} {dd}, {yyyy}") + " " + time[0] + ":00 " + timeZoneId, { future: true }),
                    end = Date.create(date.format("{Month} {dd}, {yyyy}") + " " + time[1] + ":00 " + timeZoneId, { future: true });

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
            
            let date = Date.create(arr[0], { future: true });
            
            let label = date.format("{Mon}{dd}");
            if (!schedule[label]) schedule[label] = { };
            
            let times = arr[1].split(',').map(d => d.split('-').map(t => t.to(2) + ":" + t.from(2)));
            
            schedule[label].open = [ ];
            schedule[label].close = [ ];
            
            times.forEach(time => {
                let start = Date.create(date.format("{Month} {dd}, {yyyy}") + " " + time[0] + ":00 " + timeZoneId, { future: true }),
                    end = Date.create(date.format("{Month} {dd}, {yyyy}") + " " + time[1] + ":00 " + timeZoneId, { future: true });

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
                let now = Date.create(),
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
        
        Object.defineProperty(schedule, 'next', {
            get: function() {
                let now = Date.create(),
                    today = schedule[now.format("{Mon}{dd}")],
                    advances = 0;
                
                while (today == null && advances < 7) {
                    advances++;
                    now.addDays(1);
                    today = schedule[now.format("{Mon}{dd}")];
                    if (today && today.end.every(end => end.isPast())) {
                        today = null;
                    }
                }
                
                return today;
            }
        });
        
        Object.defineProperty(this, 'schedule', { value: schedule });
        
        delete this.tradingHours;
        delete this.liquidHours;
        
        Object.values(schedule).map(day => {            
            day.start.forEach(start => {
                if (start.isFuture()) {
                    this._timers.push(notify(start, () => this.emit("startOfDay")));
                    this._timers.push(notify(start.addSeconds(-5), () => this.emit("beforeStartOfDay")));
                    this._timers.push(notify(start.addSeconds(10), () => this.emit("afterStartOfDay")));
                }
            });
            
            day.open.forEach(open => {
                if (open.isFuture()) {
                    this._timers.push(notify(open, () => this.emit("marketOpen")));
                    this._timers.push(notify(open.addSeconds(-5), () => this.emit("beforeMarketOpen")));
                    this._timers.push(notify(open.addSeconds(10), () => this.emit("afterMarketOpen")));
                }
            });
            
            day.close.forEach(close => {
                if (close.isFuture()) {
                    this._timers.push(notify(close, () => this.emit("marketClose")));
                    this._timers.push(notify(close.addSeconds(-5), () => this.emit("beforeMarketClose")));
                    this._timers.push(notify(close.addSeconds(10), () => this.emit("afterMarketClose")));
                }
            });
            
            day.end.forEach(end => {
                if (end.isFuture()) {
                    this._timers.push(notify(end, () => this.emit("endOfDay")));
                    this._timers.push(notify(end.addSeconds(-5), () => this.emit("beforeEndOfDay")));
                    this._timers.push(notify(end.addSeconds(10), () => this.emit("afterEndOfDay")));
                }
            });
        });
    }
    
    get nextOpen() {
        if (this.marketsOpen) return Date.create();
        else return this.schedule.next.start.find(start => start.isFuture());
    }
    
    get marketsOpen() {
        let now = Date.create(), hours = this.schedule.today;
        if (hours && hours.start && hours.end) {
            for (let i = 0; i < hours.start.length; i++) {
                if (now.isBetween(hours.start[i], hours.end[i])) return true;
            }
        }
        
        return false;
    }
    
    get marketsLiquid() {
        let now = Date.create(), hours = this.schedule.today;
        if (hours && hours.open && hours.close) {
            for (let i = 0; i < hours.open.length; i++) {
                if (now.isBetween(hours.open[i], hours.close[i])) return true;
            }
        }
        
        return false;
    }
    
    refresh(cb) {
        this._timers.forEach(timer => clearTimeout(timer));
        this._timers = [ ];
    
        this.session.service.contractDetails(this.summary)
            .once("data", contract => merge(data))
            .once("error", err => cb(err, list))
            .once("end", () => cb(null, list))
            .send();
    } 
    
}

exports.details = details;

let frontMonth = exports.frontMonth = function(cutOffDay, offset) {
    let date = Date.create();
    
    if (date.getDate() >= cutOffDay) {
        date.addMonths(1);
    }
    
    if (offset) {
        date.addMonths(offset);
    }

    return date;
};

function parse(definition) {
    if (typeof definition == "number") {
        definition = { conId: definition };
    }
    else if (typeof definition == "string") {
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
                if (date.toLowerCase().startsWith("front") || date.toLowerCase().startsWith("first")) {
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
                    if (year == "") year = Date.create().fullYear();

                    date = Date.create(month + " " + year);
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

    if (typeof definition == "object") {
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
},{"../flags":7,"../realtime":19}],12:[function(require,module,exports){
"use strict";

const MarketData = require("./marketdata");

class Curve extends MarketData {
    
    constructor(session, securities, symbol) {
        super(session, securities.sortBy(s => s.contract.expiry).map("contract"));
        Object.defineProperty(this, "securities", { value: securities.sortBy(s => s.contract.expiry) });
        Object.defineProperty(this, "symbol", { value: symbol || this.contract.first().summary.symbol + "_curve" });
    }
    
    get points() {
        let p = this.securities.map(s => {
            return {
                expiry: s.contract.expiry, 
                timestamp: s.quote.lastTimestamp,
                last: s.quote.last
            };
        });
        
        p[0].spread = 0;
        for (let i = 1; i < p.length; i++) {
            p[i].spread = p[i].last - p[i - 1].last;
        }
        
        return p;
    }
    
    stream() {
        this.securities.map(s => {
            s.quote.stream()
                .on("error", err => this.emit("error", err))
                .on("update", data => this.emit("update", data));
        });
    }
    
    cancel() {
        this.securities.map(s => s.quote.cancel());
    }
    
}

module.exports = Curve;
},{"./marketdata":14}],13:[function(require,module,exports){
"use strict";

const MarketData = require("./marketdata");

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
            
            let copy = Object.clone(this.contract.summary);
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
        if (typeof exchanges == "number") {
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
},{"./marketdata":14}],14:[function(require,module,exports){
"use strict";

const RealTime = require("../realtime");

class MarketData extends RealTime {
    
    constructor(session, contract) {
        super(session);
        Object.defineProperty(this, 'contract', { value: contract });
    }
    
}

module.exports = MarketData;
},{"../realtime":19}],15:[function(require,module,exports){
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
},{"../flags":7,"./marketdata":14}],16:[function(require,module,exports){
"use strict";

const MarketData = require("./marketdata"),
      flags = require("../flags"),
      TICKS = flags.QUOTE_TICK_TYPES;

Date.getLocale('en').addFormat('{yyyy}{MM}{dd}-{hh}:{mm}:{ss}');

class Quote extends MarketData {
    
    constructor(session, contract) {
        super(session, contract);
        this._fieldTypes = Array.create();
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
            if (this[datum.key] && !this.loaded) {
                this.loaded = true;
                this.emit("load");
            }
            
            let oldValue = this[datum.key];
            this[datum.key] = datum.value;
            this.emit("update", { key: datum.key, newValue: datum.value, oldValue: oldValue });
        }).on("error", err => {
            this.emit("error", err);
        }).send();
        
        return this;
    }
    
    tickBuffer(duration) {
        return new FieldBuffer(this, duration || 5000, "rtVolume");
    }
    
    newsBuffer(duration) {
        return new FieldBuffer(this, duration || 60000 * 60, "newsTick");
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
},{"../flags":7,"./marketdata":14}],17:[function(require,module,exports){
"use strict";

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
        this.reports = { };
    }
    
    fundamentals(type, cb) {
        this.service.fundamentalData(this.contract.summary, flags.FUNDAMENTALS_REPORTS[type] || type)
            .once("data", data => {
                let keys = Object.keys(data);
                if (keys.length == 1) this.reports[type] = data[keys.first()];
                else this.reports[type] = data;
                
                if (cb) cb(null, this.reports[type]);
            })
            .once("end", () => {
                if (cb) cb(new Error("Could not load " + type + " fundamental data for " + this.contract.symbol + ". " + err.message))
            })
            .once("error", err => {
                if (cb) cb(new Error("Could not load " + type + " fundamental data for " + this.contract.symbol + ". " + err.message))
            })
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
},{"../flags":7,"./charts":10,"./depth":13,"./marketdata":14,"./order":15,"./quote":16}],18:[function(require,module,exports){
module.exports = { };
},{}],19:[function(require,module,exports){
"use strict";

const Events = require("events");

class RealTime extends Events {
    
    constructor(session) {
        super();
        this._exclude = [ ];
        Object.defineProperty(this, 'session', { value: session });
        Object.defineProperty(this, 'service', { value: session.service });
    }
    
    get fields() {
        return Object.keys(this).exclude(/\_.*/).subtract(this._exclude).exclude("cancel").exclude("domain");
    }
    
    get snapshot() {
        let obj = Object.select(this, this.fields);
        for (let prop in obj) {
            let snapshot = null;
            if (snapshot = obj[prop].snapshot) {
                obj[prop] = snapshot;
            }
        }
        
        return obj;
    }
    
    each(fn) {
        this.fields.forEach((e, i) => fn(this[e], e, i));
    }
    
    cancel() {
        return false;
    }
    
    either(event1, event2, cb) {
        let done = false;
        this.once(event1, arg => { 
            if (!done) {
                done = true;
                cb(arg, null);
            }
        }).once(event2, arg => { 
            if (!done) {
                done = true;
                cb(null, arg);
            }
        });
        
        return this;
    }
    
}

module.exports = RealTime;
},{"events":25}],20:[function(require,module,exports){
(function (process){
"use strict";

const Events = require("events"),
      flags = require("./flags"),
      Accounts = require("./accounting/accounts"),
      Positions = require("./accounting/positions"),
      Orders = require("./accounting/orders"),
      Trades = require("./accounting/trades"),
      Account = require("./accounting/account"),
      Curve = require("./marketdata/curve"),
      Chain = require("./marketdata/chain"),
      contract = require("./marketdata/contract"),
      securities = require("./marketdata/security");

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

                    this.connectivity[name] = { status: status, time: Date.create() };   
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
    
    get frozen() {
        return this.service.lastMktDataType == flags.MARKET_DATA_TYPE.frozen;
    }
    
    set frozen(value) {
        this.service.mktDataType(value ? flags.MARKET_DATA_TYPE.frozen : flags.MARKET_DATA_TYPE.live);
    }
    
    close(exit) {
        this.service.socket.disconnect();
        if (exit) process.exit();
    }
    
    account(options) {
        if (options === true) options = { };
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
    
    curve(description, cb) {
        securities(this, description, (err, securities) => {
            if (err) cb(err);
            else cb(null, new Curve(this, securities));
        });
    }
    
    chain(description, cb) {
        securities(this, description, (err, securities) => {
            if (err) cb(err);
            else cb(null, new Chain(this, securities));
        });
    }
    
}

module.exports = Session;
}).call(this,require('_process'))
},{"./accounting/account":2,"./accounting/accounts":3,"./accounting/orders":4,"./accounting/positions":5,"./accounting/trades":6,"./flags":7,"./marketdata/chain":9,"./marketdata/contract":11,"./marketdata/curve":12,"./marketdata/security":17,"_process":26,"events":25}],21:[function(require,module,exports){
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
},{"./request":24}],22:[function(require,module,exports){
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
},{"./dispatch":21,"./relay":23}],23:[function(require,module,exports){
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
},{}],24:[function(require,module,exports){
"use strict";

const Events = require("events");

class Request extends Events {
    
    constructor(dispatch, id, call, send, cancel, timeout, oneOff) {
        super();
        
        this.dispatch = dispatch;
        this.id = id;
        this.call = call;
        
        if (!typeof send == "function") {
            throw new Error("Send must be a function.");
        }
        else {
            this.send = () => {
                if (timeout) {
                    if (typeof timeout != "number" || timeout <= 0) {
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
            if (!typeof cancel == "function") {
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
},{"events":25}],25:[function(require,module,exports){
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

},{}],26:[function(require,module,exports){
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
