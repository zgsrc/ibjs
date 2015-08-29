// FUNDAMENTALS TYPE
exports.REPORT = {
    snapshot: "ReportSnapshot",
    financials: "ReportsFinSummary",
    ratios: "ReportRatios",
    statements: "ReportsFinStatements",
    consensus: "RESC",
    calendar: "CalendarReport"
};

// QUOTE TICK TYPES
exports.TICKS = {
    optionVolume: 100,
    optionOpenInterest: 101,
    historicalVolatility: 104,
    optionImpliedVolatility: 106,
    indexFuturePremium: 162,
    miscellaneousStats: 165,
    markPrice: 221,
    auctionValues: 225,
    realTimeVolume: 233,
    shortable: 236,
    inventory: 256,
    fundamentalRatios: 258,
    news: 292,
    realtimeHistoricalVolatility: 411,
    dividends: 456
};

// HISTORICALS FIELDS
exports.FIELDS = {
    trades: "TRADES",
    midpoint: "MIDPOINT",
    bid: "BID",
    ask: "ASK",
    spread: "BID_ASK",
    historicalVolatility: "HISTORICAL_VOLATILITY",
    impliedVolatility: "OPTION_IMPLIED_VOLATILITY"
};

exports.TIME_UNITS = {
    seconds: "S",
    days: "D",
    weeks: "W",
    months: "M",
    years: "Y"
};

exports.BAR_SIZE = {
    ONE_SECOND: "1 sec",
    FIVE_SECONDS: "5 secs",
    FIFTEEN_SECONDS: "15 secs",
    THIRTY_SECONDS: "30 secs",
    ONE_MINUTE: "1 min",
    TWO_MINUTES: "2 mins",
    THREE_MINUTES: "3 mins",
    FIVE_MINUTES: "5 mins",
    FIFTEEN_MINUTES: "15 mins",
    THIRTY_MINUTES: "30 mins",
    ONE_HOUR: "1 hour",
    ONE_DAY: "1 day"
};

// ACCOUNT SUMMARY TAGS
exports.TAGS = {
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

exports.TIME_ZONE = {
    greenwichMeanTime: "GMT",
    easternStandardTime: "EST",
    mountainStandardTime: "MST",
    pacificStandardTime: "PST",
    atlanticStandardTime: "AST",
    japanStandardTime: "JST",
    australianStandardTime: "AET"
};

// ORDER PARAMETERS
exports.SIDE = {
    buy: "BUY",
    sell: "SELL",
    short: "SSHORT"
};

exports.ORDER_TYPE = {
    limit: "LMT",
    marketToLimit: "MTL",
    marketWithProtection: "MKT PRT",
    requestForQuote: "QUOTE",
    stop: "STP",
    stopLimit: "STP LMT",
    trailingLimitIfTouched: "TRAIL LIT",
    trailingMarketIfTouched: "TRAIL MIT",
    trailingStop: "TRAIL",
    trailingStopLimit: "TRAIL LIMIT",
    market: "MKT",
    marketIfTouched: "MIT",
    marketOnClose: "MOC",
    marketOnOpen: "MOO",
    peggedToMarket: "PEG MKT",
    relative: "REL",
    boxTop: "BOX TOP",
    limitOnClose: "LOC",
    limitOnOpen: "LOO",
    limitIfTouched: "LIT",
    peggedToMidpoint: "PEG MID",
    VWAP: "VWAP",
    goodAfter: "GAT",
    goodUntil: "GTD",
    goodUntilCancelled: "GTC",
    immediateOrCancel: "IOC",
    oneCancelsAll: "OCA",
    volatility: "VOL"
};

exports.RULE80A = { 
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

exports.TIME_IN_FORCE = {
    day: "DAY",
    goodUntilCancelled: "GTC",
    immediateOrCancel: "IOC",
    goodUntil: "GTD"
};

// SCANNER SECURITY TYPE
exports.SECURITY_TYPE = {
    stock: "STK",
    option: "OPT",
    future: "FUT",
    index: "IND",
    forward: "FOP",
    cash: "CASH",
    bag: "BAG",
    news: "NEWS"
};

// SCANNER STOCK TYPE FILTER
exports.STOCK_TYPE_FILTER = {
    corporation: "CORP",
    depositaryReceipt: "ADR",
    etf: "ETF",
    reit: "REIT",
    closedEndFund: "CEF"
};