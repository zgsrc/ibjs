# Symbols

The SDK lets you specify financial instruments in a readable symbol format.

    [date]? [symbol] [side/type]? (in [currency])? (on [exchange])? (at [strike])?

So for example, a stock might look like:

* IBM
* IBM stock
* IBM stock in MXN on BMV

Futures:

* Jan16 CL futures
* Jan16 CL futures in USD on NYMEX

Options:

* Sep16'17 AAPL puts at 110

Currencies:

* USD.EUR currency

Indices:

* INDU index

> **NOTE**: This capability does not serve as a security search.  Use the [IB contract search](https://pennies.interactivebrokers.com/cstools/contract_info) for that.

An `Environment` manages a watchlist of `Symbol` objects in the `symbols` member variable.  Create a `Symbol` using the `Environment.watch(symbol, options)` method with a variable name and an optional configuration object.

```javascript
// Will register the symbol using the local symbol name.
ib.watch("AAPL");
ib.symbols.AAPL !== null;

// Will register the symbol using the supplied name.
ib.watch("AAPL", "Apple");
ib.watch("AAPL", { name: "Apple" });
ib.symbols.Apple !== null;
```

When a `Symbol` is declared, a set of market data subscriptions (e.g. fundamentals, quotes, level 2 data) will be opened (depending on the options supplied and the environment symbol defaults).

```javascript
let apple = ib.symbols.Apple;

let fundamentals = apple.fundamentals,
    quote = apple.quote,
    level2 = apple.depth,
    barChart = apple.bars;
```

Even if the symbol configuration does not subscribe to certain market data facets, they are instantiated and can still be used programmatically.

### Fundamentals

```javascript
let fundamentals = apple.fundamentals;

// Report specific methods
fundamentals.loadSnapshot((err, report) => { });
fundamentals.loadFinancials((err, report) => { });
fundamentals.loadRatios((err, report) => { });
fundamentals.loadStatements((err, report) => { });
fundamentals.loadConsensus((err, report) => { });
fundamentals.loadCalendar((err, report) => { });

// Load some or all reports
let reportTypes = fundamentals.REPORT_TYPES;
fundamentals.load("snapshot", (err, report) => { });
fundamentals.loadSome([ "snapshot", "financials" ], err => { });
fundamentals.loadAll(err => { });

// Access reports by name directly on object
let report = fundamentals.snapshot;
```

### Quotes

```javascript
// Generic quote data
let quote = apple.quote;

quote.pricing()
    .fundamentals()
    .volatility()
    .options()
    .short()
    .news();
    
quote.refresh(err => { /* snapshot quote */ });

quote.stream();
quote.cancel();
```

### Level 2 Price Data

```javascript
// Level 2 data 
let depth = apple.depth;

depth.open("NYSE", 10);
depth.openAll([ "NYSE", "ARCA" ], 10);
depth.openAllValidExchanges(10);

depth.close("NYSE");
depth.cancel();
```

### Bar Charts

```javascript
let bars = apple.bars.FIVE_MINUTES;

// Load "n" periods of history and stream
bars.load(3, err => { });

// Load 1 period of history
bars.history(err => { });

// Open streaming bars
bars.stream();

// Close streaming bars
bars.cancel();

// Get bar for specific time
bars.lookup((new Date()).getTime());

// Setup bar study
let studies = bars.studies;
bars.study("SMA", 20, studies.SMA);
```