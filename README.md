# Interactive Brokers SDK

Interactive Brokers SDK framework build atop the [native javascript API](https://github.com/pilwon/node-ib).

* Build your own trading system.
* Create custom risk models.
* Autonomous algorithmic trading.
* Market data analysis.
* Manage multiple accounts.

## Prerequisites

* An [Interactive Brokers](https://www.interactivebrokers.com/) trading account.
* Install [Java](https://java.com/en/download/).
* Install the [IB Gateway](http://interactivebrokers.github.io) or [IB TWS (Trader Workstation)](https://www.interactivebrokers.com/en/index.php?f=674&ns=T).

## How does it work?

The IB Gateway and TWS software are graphical Java processes that encrypt and proxy calls to back-end servers.  Without dedicated communication infrastructure, there is no IB support for direct connections to their server tier.

The SDK uses the [native javascript API](https://github.com/pilwon/node-ib) to manage a binary TCP socket connection from Node.js to a local IB Gateway or TWS instance.

## How do I get it?

Install with npm:

    npm install ib-sdk

Clone repo with git:

    git clone https://github.com/triploc/ib-sdk.git

Download over HTTPS:

    wget https://github.com/triploc/ib-sdk/archive/master.zip
    unzip master.zip

## How do I use it?

Login to the Gateway or TWS software manually or use [ib-controller](https://github.com/ib-controller/ib-controller) to automate UI interaction. You can run the mocha tests to make sure things work. Outside of market hours, tests on real-time market data calls will fail.

    npm test

Connect to the IB Java process with an authenticated user session.

    var ib = require("ib-sdk");
    
    ib.connect({ host: "localhost", port: 4001 }, function(err, status) {
        if (!err && status == "connected") {
            ib.connection.currentTime(function(err, time) {
                if (!err && time) {
                    // It's all good. Do what what you need to do.
                }
            });
        }
    });
    
    // Set some options after connection
    ib.connection.options.verbose = true;

> **NOTE**: IB Gateway or TWS can enter a partially functional state with respect to API connections. If connect works but other calls do not, you may need to restart the IB software.

Helper methods construct Security objects.

    ib.stock("AAPL");
    
    ib.option("AAPL", "28/08/2015", 120, "Call");
    
    ib.currency("EUR");
    
    ib.future("EM", "14/12/2015");

Security objects have methods to access details, fundamentals, and market data.

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

## License

Copyright (c) 2015, Jonathan Hollinger

Permission to use, copy, modify, and/or distribute this software for any purpose with or without fee is hereby granted, provided that the above copyright notice and this permission notice appear in all copies.

THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES WITH REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR ANY SPECIAL, DIRECT, INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES WHATSOEVER RESULTING FROM LOSS OF USE, DATA OR PROFITS, WHETHER IN AN ACTION OF CONTRACT, NEGLIGENCE OR OTHER TORTIOUS ACTION, ARISING OUT OF OR IN CONNECTION WITH THE USE OR PERFORMANCE OF THIS SOFTWARE.