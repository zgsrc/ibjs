[![Logo](./ib-logo.png)](http://interactivebrokers.com/)

# Interactive Brokers SDK

Interactive Brokers SDK is a framework build atop the [native javascript API](https://github.com/pilwon/node-ib).  Straightforward programmatic access to your portfolio and market data subscriptions.

## Installation

    npm install ib-sdk

### Prerequisites

* An [Interactive Brokers](https://www.interactivebrokers.com/) trading account.
* Install [Java](https://java.com/en/download/).
* Install the [IB Gateway](http://interactivebrokers.github.io) or [IB TWS (Trader Workstation)](https://www.interactivebrokers.com/en/index.php?f=674&ns=T).

The [IB Gateway](http://interactivebrokers.github.io) and [IB TWS (Trader Workstation)](https://www.interactivebrokers.com/en/index.php?f=674&ns=T) software are graphical Java processes that encrypt and proxy calls to back-end servers.  Without dedicated communication infrastructure, there is no IB support for direct connections to their server tier.

The SDK uses the [native javascript API](https://github.com/pilwon/node-ib) to manage a TCP socket connection from Node.js to an IB Gateway or TWS instance.

## Kick The Tires

Login to the [IB Gateway](http://interactivebrokers.github.io) or [IB TWS (Trader Workstation)](https://www.interactivebrokers.com/en/index.php?f=674&ns=T) software manually or use [ib-controller](https://github.com/ib-controller/ib-controller) to automate UI interaction.  The API and SDK expect to connect to an authenticated user session.  The IB software must be configured to accept API connections.  The SDK connects over `tcp://localhost:4001` by default.

Make sure sure things work by running the terminal interface from the SDK directory:

    npm start terminal [port]
    
The terminal will give you a default `environment` through the `ib` variable.  Use `watch` as an alias to `ib.watch` and `$` as an alias to `ib.symbols` for ease.

    > watch("AAPL")
    undefined
    > $.AAPL
    [all the things]

> **NOTE**: IB Gateway or TWS can enter a "bad state" with respect to API connections.  If connect works but other calls do not, you may need to restart the IB software.

## Get Started

An `Environment` is a realtime object model of your brokerage account(s).  The default configuration subscribes to system notices, account information, open positions, pending orders, and trade history.  All realtime objects share an interface and pattern of behavior.

* `update` event signals a single data point has changed
* `error` event signals an asynchronous error was encountered
* `cancel` method closes the underlying data subscription and takes the object offline

```javascript
"use strict";

const sdk = require("ib-sdk");

sdk.environment("./config.json", (err, ib) => {
    if (err) {
        console.log("Connection error: " + err.message);
    }
    else {
        let system = ib.system,
            accounts = ib.accounts,
            positions = ib.positions,
            orders = ib.orders,
            trades = ib.executions,
            $ = ib.symbols;
            
        // monitor updates
        accounts.on("update", data => {  });
        
        // handle specific errors
        accounts.on("error", err => accounts.cancel());
    
        // catch all errors
        ib.on("error", err => console.log(err));
        
        // cleanup before exit
        ib.exit(0, () => console.log("Disconnected"));
    }
});
```

### Configuration

The first parameter to the `sdk.environment(config, cb)` method may be either:

* a string, in which case it is assumed to be a path to a JSON file
* or an object, in which case it is interpretted literally

```javascript
{
    "connection": {
        "host": "localhost",
        "port": 4001,
        "timeout": 1000
    },
    "environment": {
    
        /* Subscribe to system notifications and connectivity status updates. */
        "system": true,

        /* Subscribe to realtime account balance and position values.
           - Boolean value subscribes to all account info.
           - An array of tags (i.e. [ "TAG1", "TAG2" ]) subscribes to select values.  (Print Environment.accounts.TAGS variable for a list of tags.) */
        "accounts": true,

        /* Subscribe to basic position info across accounts. */
        "positions": true,

        /* Subscribe to trade history, past and ongoing trades. 
           - Boolean value loads today's trades.
           - A filter object adjusts the scope of trades. */
        "executions": true,

        /* Subscribe to pending orders.
           - "all" subscribes to all orders placed in IB.
           - "local" subscribes only to orders placed through this process. */
        "orders": "all",

        /* Watchlist of securities. */
        "symbols": {
        
            /* Defines the market data subscriptions that are opened by default.  If omitted, uses defaults below. */
            "defaults": {

                /* Download fundamental data.
                   - The "all" option fetches all available fundamental data.
                   - Any other string fetches the fundamental report by that name.
                   - An array of strings fetch all reports in the array.  (Print Symbol.fundamentals.REPORT_TYPES variable for a list of reports.) */
                "fundamentals": "all",

                /* Subscribe to quote data.
                   - Boolean value opens a streaming quote of price and volume data.
                   - The "snapshot" string fetches a snapshot of quote data without initializing a streaming subscription.
                   - An array of strings registers specific streaming quote fields.  (Print Symbol.quote.TICK_TYPES variable for a list of fields.) */
                "quote": true,
                
                /* Subscribe to level 2 data.
                   - The "all" string subscribes to level 2 data from all valid exchanges.
                   - An array of strings subscribes to specific market data centers. */
                "depth": {
                    "markets": "all",
                    "rows": 10
                },
                
                /* Subscribes to a bar chart data.  Must use one of the bar sizes below.
                   - Boolean loads one history period and subscribes to realtime updates
                   - Positive integer loads that many historical periods and subscribes to realtime updates */
                "bars": {
                    "ONE_SECOND": false,
                    "FIVE_SECONDS": false,
                    "FIFTEEN_SECONDS": false,
                    "THIRTY_SECONDS": false,
                    "ONE_MINUTE": false,
                    "TWO_MINUTES": false,
                    "THREE_MINUTES": false,
                    "FIVE_MINUTES": true,
                    "FIFTEEN_MINUTES": false,
                    "THIRTY_MINUTES": false,
                    "ONE_HOUR": false,
                    "TWO_HOURS": false,
                    "FOUR_HOURS": false,
                    "EIGHT_HOURS": false,
                    "ONE_DAY": false
                }
                
            },
            
            /* A list of symbols to load.  An array or object can be used to override default options specified above. */
            "securities": [
                "GOOGL",
                [ "GOOGL", { /* Override defaults */ } ],
                { 
                    "description": "GOOGL", 
                    "options": { /* Override defaults */ }
                }
            ]
            
        }
        
    }
}
```

### [Symbols](#symbols)

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

# Advanced Use

The `Environment` is a good way to get setup quickly and focus on ultimate programming tasks.  Certain use cases benefit from a more light-weight or customized configuration.

## Session

Login to IB software and connect using the `connect` method with proper host and port parameters.  This method handles actual connection logic and timeouts.

```javascript
const sdk = require("ib-sdk");

sdk.connect({ host: "localhost", port: 4001 }, (err, session) => {
    if (err) {
        console.log("Connection error: " + err.message);
    }
    else {
        // default environment
        let ib = session.environment();

        // bad state detection on environment, see note in section above
        ib.on("badState", () => {
            console.log("IB API unresponsive!!! Try restarting IB software and reconnecting.");
        }).on("load", () => {
                 
        }).on("error", err => {
            console.log(err);
        });
    }
});
```

After connecting to the IB software, a `Session` object is returned with methods to create realtime objects or entire environments.  The `Environment` class will detect an initial sequence of timeouts, indicating a bad state in the IB software (see note in previous section).  The `badState` event handling in the code example above handles this exception.

```javascript
let system = session.system(),
    accounts = session.accounts(),
    positions = session.positions(),
    orders = session.orders([all]),
    executions = session.executions(),
    news = session.news([flags]);
```

A `Session` can also create `Security` objects with methods to initiate market data subscriptions.  Similar to how an `Environment` uses a `Session` and a configuration to assemble a realtime object model, a `Symbol` uses a `Security` and a configuration to assemble and manage market data subscriptions.

```javascript
session.security("AAPL stock", (err, security) => { 
    let fundamentals = security.fundamentals(),
        quote = security.quote(),
        depth = security.depth(),
        order = security.order(), // optional: defaults
        symbol = security.symbol(); // optional: options
});
```

The `session` method or `Session` class can be used directly for advanced use or when supplying an existing socket connection to IB.  In this case, connection and any timeout logic need to be written manually.

```javascript
let IB = require("node-ib");

let session = new sdk.Session({
    socket: new IB({ host: 'localhost', port: 4001 })
});

// alternatively
session = sdk.session({ host: 'localhost', port: 4001 });

// connection and timeout logic
let timeout = setTimeout(() => {
    throw new Error("Connection timeout!");
}, 5000);

session.service.socket.on("connected", () => {
    cancelTimeout(timeout);
    // session ready for use
}).connect();
```

## Service

The low-level native javascript API is directly encapsulated by the `Service` class, which makes streaming API reponses more reliable and cogent.

```javscript
let IB = require("ib"),
    sdk = require("ib-sdk");

let socket = new IB({ 
    host: "localhost", 
    port: 4001 
});

let service = new sdk.Service(socket);

service.socket.on("connected", () => {
    // service ready for use
}).connect();
```

A `Service` uses a `Dispatch` to deconflict requests routed through the same socket.  In most cases, there is one `Socket`, one `Dispatch`, and one `Service` in use.  So by default, the `Service` class instantiates its own `Dispatch`.  However, in cases where multiple `Service` instances utilize the same `Socket`, they should share a `Dispatch`.

```javascript
let optionalRequestSeed = 1, // default is 1
    dispatch = new sdk.Dispatch(optionalRequestSeed),
    service = new sdk.Service(socket, dispatch);
    
service.dispath === dispatch;
```

The `Service` class provides method analogs to the native API calls that synchronously return promise-esque `Request` objects.

```javascript
service.positions()
    .on("error", (err, cancel) => {
        if (err.timeout) console.log("timeout!");
        else console.log(err);
        cancel();
    }).on("data", (data, cancel) => {
        console.log(data);
    }).on("end", cancel => {
        console.log("done");
    }).on("close", () => {
        console.log("cancel was called.");
    }).send();

// service requests
service.system();
service.currentTime();
service.contractDetails(contract);
service.fundamentalData(contract, reportType);
service.historicalData(contract, endDateTime, durationStr, barSizeSetting, whatToShow, useRTH, formatDate);
service.realTimeBars(contract, barSize, whatToShow, useRTH);
service.mktData(contract, genericTickList, snapshot);
service.mktDepth(contract, numRows);
service.scannerParameters();
service.scannerSubscription(subscription);
service.accountSummary(group, tags);
service.accountUpdates(subscribe, acctCode);
service.executions(filter);
service.commissions();
service.openOrders();
service.allOpenOrders();
service.positions();
service.orderIds(numIds);
service.placeOrder(contract, order);
service.exerciseOptions(contract, exerciseAction, exerciseQuantity, account, override);
service.newsBulletins(allMsgs);
serivce.queryDisplayGroups();
service.subscribeToGroupEvents();
serivce.updateDisplayGroup();
```

## Remoting

`Service` instances also supports a mechanism to relay streaming responses to proxy instances of the SDK, enabling a distributed/networked system architecture.  The `relay` method takes a `EventEmitter` compatible (i.e. implements `emit` and `on`) object and relays `data`, `error`, and `end` events.  A `Proxy` is a `Service`-compatible object that can be instantiated remotely and use a similar `EventEmitter` compatible transport (e.g. [socket.io](http://socket.io/)) to communicate with a `Relay` server.

__Server__
```javascript
let app = require('http').createServer(handler),
    session = sdk.connect({ host: "localhost", port: 4001 }),
    io = require('socket.io')(app);
    
session.service.socket.on("connected", () => {
    session.service.relay(io);
    app.listen(8080);
}).connect();
```

__Client__
```javascript
var io = require('socket.io-client')('http://localhost:8080'),
    session = sdk.proxy(io);
    
session.service.relay(socket);
```

## Terminal

The terminal uses the `REPL` package to expose an `Environment` to the command line.

Starting the terminal is as easy as running the `npm start` command with the `terminal [port]` parameter.

    npm start terminal [port]
    
Or running the index.js file directly.
    
    node index.js terminal [port]

Programmatically, a terminal can be created like so:

```javascript
sdk.terminal(sdk.session({ port: 4001 }));
```

## License

Copyright (c) 2016, Jonathan Hollinger

Permission to use, copy, modify, and/or distribute this software for any purpose with or without fee is hereby granted, provided that the above copyright notice and this permission notice appear in all copies.

THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES WITH REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR ANY SPECIAL, DIRECT, INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES WHATSOEVER RESULTING FROM LOSS OF USE, DATA OR PROFITS, WHETHER IN AN ACTION OF CONTRACT, NEGLIGENCE OR OTHER TORTIOUS ACTION, ARISING OUT OF OR IN CONNECTION WITH THE USE OR PERFORMANCE OF THIS SOFTWARE.