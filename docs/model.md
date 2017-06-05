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

### [Orders](#orders)

An `Order` can be initiated from a `Symbol` (or `Security`) and has chainable methods to build and transmit an order.

```javascript
let order = ib.symbols.Apple.order();

order.sell(100)
     .show(10)
     .limit(100.50)
     .goodUntilCancelled()
     .transmit();
```

Quantity and market side can be set with an appropriate method.  Display size can be set an extra parameter or with the separate `show` method.

```javascript
order.buy(100).show(10);
order.buy(100, 10);
order.trade(100, 10);

order.sell(100).show(10);
order.sell(100, 10);
order.trade(-100, -10);
```

Order type is set with an appropriate method or manually.

```javascript
order.market();
order.marketWithProtection();
order.marketThenLimit();
order.limit(100.50);

order.stop(100.50);
order.stopLimit(100.50, 100.48);
order.stopWithProtection(100.50);
```

Time in force is presumed to be "DAY" unless otherwise specified.  Timeframe can be set with appropriate methods.

```javascript
order.goodToday()
order.immediateOrCancel();
order.goodUntilCancelled().outsideRegularTradingHours();
```

Order transmission can be performed in a single transaction or in parts.

```javascript
// Will suppress certain IB warnings for large trades
order.overridePercentageConstraints();

// Will open the order without transmitting it.
order.open();

// Will open the order and trasmit it.
order.transmit();
```

Once an order is opened, it flows to the `Orders` object.

```javascript
let orders = ib.orders.all;

ib.orders.on("update", order => { 
    order.cancel();
});
```

As the order is being executed, `Positions` will update.

```javascript
for (account in ib.positions.accounts) {
    let accountPositions = positions.accounts[account];
    for (id in accountPositions) {
        let position = accountPositions[id];
    }
}
```

After an order is executed or cancelled, it flows to the `Executions` object, which is a trade history.

```javascript
let trades = ib.executions.trades;

ib.executions.on("update", trade => {
    console.log(trade);
});
```

## Accounts

The `Accounts` class provides access to complete balance, margin, and positions information for all accounts to which that the authenticated session has access.  

First, a subscription to a summary of accounts is opened, which populates the `Accounts.summary` object.  Then, for each account in the summary, a subscription to account updates is opened, which populate the `Account.details` and `Account.positions` variables.

```javascript
let accounts = ib.accounts,
    summary = accounts.summary,
    details = accounts.details,
    positions = accounts.positions;
```

## System

The `System` class emits all system messages using the `update` event.

Messages relating to market data server connectivity are parsed and posted to the `System.marketDataConnections` member variable.  Changes to connectivity trigger the `marketDataConnectionChange` event.

```javascript
let connectivity = ib.system.marketDataConnections;

ib.system.on("marketDataConnectionChange", (name, status) => {
    connectivity[name] === status;
});
```