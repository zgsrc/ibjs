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

const BarSizes = {
    "5 secs": {
        text: "5 secs",
        integer: 5,
        duration: "3600 S"
    },
    "10 secs": {
        text: "10 secs",
        integer: 10,
        duration: "7200 S"
    },
    "15 secs": {
        text: "15 secs",
        integer: 15,
        duration: "10800 S"
    },
    "30 secs": {
        text: "30 secs",
        integer: 30,
        duration: "1 D"
    },
    "1 min": {
        text: "1 min",
        integer: 60,
        duration: "2 D"
    },
    "2 mins": {
        text: "2 mins",
        integer: 120,
        duration: "3 D"
    },
    "3 mins": {
        text: "3 mins",
        integer: 180,
        duration: "4 D"
    },
    "5 mins": {
        text: "5 mins",
        integer: 300,
        duration: "1 W"
    },
    "10 mins": {
        text: "10 mins",
        integer: 600,
        duration: "2 W"
    },
    "15 mins": {
        text: "15 mins",
        integer: 900,
        duration: "2 W"
    },
    "20 mins": {
        text: "20 mins",
        integer: 1200,
        duration: "3 W"
    },
    "30 mins": {
        text: "30 mins",
        integer: 1800,
        duration: "1 M"
    },
    "1 hour": {
        text: "1 hour",
        integer: 3600,
        duration: "2 M"
    },
    "2 hours": {
        text: "2 hours",
        integer: 7200,
        duration: "2 M"
    },
    "3 hours": {
        text: "3 hours",
        integer: 10800,
        duration: "3 M"
    },
    "4 hours": {
        text: "4 hours",
        integer: 14400,
        duration: "4 M"
    },
    "8 hours": {
        text: "8 hours",
        integer: 28800,
        duration: "8 M"
    },
    "1 day": {
        text: "1 day",
        integer: 3600 * 24,
        duration: "1 Y"
    },
    "1 week": {
        text: "1W",
        integer: 3600 * 24 * 7,
        duration: "2 Y"
    },
    "1 month": {
        text: "1M",
        integer: 3600 * 24 * 7 * 30,
        duration: "5 Y" 
    }
};

exports.BAR_SIZES = BarSizes;

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
    'USD', 'AUD', 'CAD', 'CHF', 'CNH', 
    'CZK', 'DKK', 'EUR', 'GBP', 'HKD', 
    'HUF', 'ILS', 'JPY', 'MXN', 'NOK', 
    'NZD', 'PLN', 'RUB', 'SEK', 'SGD', 
    'ZAR', 'KRW'
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
    spread: "BAG",
    spreads: "BAG",
    combo: "BAG",
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

const tz = {
    // USA
    EST5EDT: "America/New_York",
    EST: "America/New_York",
    EDT: "America/New_York",
    CST6CDT: "America/Chicago",
    CST: "America/Chicago",
    CDT: "America/Chicago",
    MST7MDT: "America/Denver",
    MST: "America/Denver",
    MDT: "America/Denver",
    PST8PDT: "America/Los_Angeles",
    PST: "America/Los_Angeles",
    PDT: "America/Los_Angeles",
    
    // SOUTH AMERICA
    ART: "America/Buenos_Aires",
    BRST: "America/Sao_Paolo",
    VET: "America/Caracas",
    
    // EUROPE
    WET: "Europe/Lisbon",
    GMT: "Europe/London",
    CET: "Europe/Paris",
    MET: "Europe/Paris",
    EET: "Europe/Helsinki",
    MSK: "Europe/Moscow",
    
    // MIDDLE EAST
    IST: "Asia/Tel_Aviv",
    AST: "Asia/Dubai",
    
    // AFRICA
    SAST: "Africa/Johannesburg",
    
    // ASIA
    IST: "Asia/Kolkata",
    HKT: "Asia/Hong_Kong",
    CST: "Asia/Shanghai",
    KST: "Asia/Seoul",
    JST: "Asia/Tokyo",
    AEDT: "Australia/Sydney"
};

exports.tz = tz;

exports.wellKnownSymbols = { };