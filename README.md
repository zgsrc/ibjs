[![Logo](./ib-logo.png)](http://interactivebrokers.com/)

# Interactive Brokers SDK

Interactive Brokers SDK is a framework build atop the [native javascript API](https://github.com/pilwon/node-ib).  Straightforward programmatic access to your portfolio and market data subscriptions.

## Prerequisites

* An [Interactive Brokers](https://www.interactivebrokers.com/) trading account.
* Install [Java](https://java.com/en/download/).
* Install the [IB Gateway](http://interactivebrokers.github.io) or [IB TWS (Trader Workstation)](https://www.interactivebrokers.com/en/index.php?f=674&ns=T).

## Installation

Install with npm:

    npm install ib-sdk

Clone repo with git:

    git clone https://github.com/triploc/ib-sdk.git

Download over HTTPS:

    wget https://github.com/triploc/ib-sdk/archive/master.zip
    unzip master.zip

## Getting Started

Login to the [IB Gateway](http://interactivebrokers.github.io) or [IB TWS (Trader Workstation)](https://www.interactivebrokers.com/en/index.php?f=674&ns=T) software manually or use [ib-controller](https://github.com/ib-controller/ib-controller) to automate UI interaction.

You can run the mocha tests to make sure things work.  Outside of market hours, tests on realtime market data calls will fail.

    npm test

The API and SDK expect to connect to an authenticated user session.  Connect to the IB process like so:

```javascript
var sdk = require("ib-sdk");

sdk.connect({ host: "localhost", port: 4001 }, (err, cxn) => {
    if (err) console.log(err);
    else {
        // Use high-level interface rather than cxn directly
        var ib = new sdk.Interface(cxn);

        // Set some options after connection
        cxn.options.verbose = true;
        
        // Do stuff
        var AAPL = ib.stock("AAPL");
        AAPL.ticker((err, ticker) => {
            ticker.on("update", update => {
                if (ticker.last < 110.00) {
                    AAPL.buy(100, (err, order) => {
                        if (order.status == "COMPLETE") {
                            console.log("Filled!");
                        }
                    });
                }
            });
        })
    }
});
```

Play around using the console.  The default port is 4001, but you can override it.

    npm start [port]
    
The console has an `ib` variable that is an `sdk.Interface` object like one constructed in the code above.

> **NOTE**: IB Gateway or TWS can enter a partially functional state with respect to API connections.  If connect works but other calls do not, you may need to restart the IB software.
    
## How does it work?

The [IB Gateway](http://interactivebrokers.github.io) and [IB TWS (Trader Workstation)](https://www.interactivebrokers.com/en/index.php?f=674&ns=T) software are graphical Java processes that encrypt and proxy calls to back-end servers.  Without dedicated communication infrastructure, there is no IB support for direct connections to their server tier.

The SDK uses the [native javascript API](https://github.com/pilwon/node-ib) to manage a TCP socket connection from Node.js to an IB Gateway or TWS instance.    
    
## Why an SDK?

Like most realtime systems, the low-level IB API works on a subscription model.  You tell it what you want, and it starts feeding you updates.  This approach is efficient and durable for that purpose.  But because requests and responses are logically decoupled, it makes procedural code awkward (e.g. do this, then this, then take an action).

```javascript
socket.makeRequest();

socket.on('response', function(data) {
    // figure out how this data is related to requests we've previously made
});
```
    
The first thing the SDK does is wrap the API operations.  The `Connection` class handles request-response plumbing and exposes a standard javascript asynchronous paradigm.

```javascript
connection.request(function(err, data) {
    // the error or data are directly linked to the request made
});
```

The second thing the SDK does is plop that `Connection` inside an object model that:

1) Provides a high-level programming model
2) Integrates realtime updates into a single composite model

Finally, the SDK provides a toolkit to help get done what needs doing.

# SDK High-Level Interface

Helper methods construct Security objects.

```javascript
ib.stock("AAPL");

ib.option("AAPL", "28/08/2015", 120, "Call");

ib.currency("EUR");

ib.future("EM", "14/12/2015");
```

Security objects have methods to access details, fundamentals, and market data.

```javascript
// Create a symbol
var AAPL = ib.stock("AAPL");

// Get basic contract info
console.log(AAPL.contract());

AAPL.details(function(err, details) {
    // Details of security
});

AAPL.fundamentals(function(err, reports) {
    // Get all fundamental data for symbol
});

AAPL.report(REPORT, function(err, reports) {
    // Get specific report for symbol
});

AAPL.chart({ 
    endTime: new Date(),
    duration: "1 d",
    timeframe: BAR_SIZE,
    regularTradingHours: true,
    field: FIELD,
    dateFormat: 1,
    locale: TIME_ZONE,
    realtime: true
}, function(err, bars, cancel) {
    // Get historical bars and real-time updates until cancel is called
});

AAPL.quote(function(err, quote) {
    // Get snapshot quote
});

AAPL.ticker(function(err, ticker) {
    ticker.on("beforeUpdate", function(update) {
        // View the update or look at the ticker.
    });

    ticker.on("afterUpdate", function(update) {
        // View the update or look at the ticker.
    });
});

AAPL.offers(exchange, function(err, book) {
    // Level 2 order book from a specific exchange
});
```

## License

Copyright (c) 2016, Jonathan Hollinger

Permission to use, copy, modify, and/or distribute this software for any purpose with or without fee is hereby granted, provided that the above copyright notice and this permission notice appear in all copies.

THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES WITH REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR ANY SPECIAL, DIRECT, INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES WHATSOEVER RESULTING FROM LOSS OF USE, DATA OR PROFITS, WHETHER IN AN ACTION OF CONTRACT, NEGLIGENCE OR OTHER TORTIOUS ACTION, ARISING OUT OF OR IN CONNECTION WITH THE USE OR PERFORMANCE OF THIS SOFTWARE.