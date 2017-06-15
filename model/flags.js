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
    fundamentalValues: 47,
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