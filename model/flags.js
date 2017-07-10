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

const TAGS = {
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

exports.ACCOUNT_TAGS = TAGS;

const TICKS = {  
    optionVolume: 100,
    optionOpenInterest: 101,
    futuresOpenInterest: 588,
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
    dividends: 456
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
    immediateOrCancel: "IOC",
    goodUntil: "GTD"
};

exports.TIME_IN_FORCE = TIME_IN_FORCE;