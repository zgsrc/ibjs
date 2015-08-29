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

The IB Gateway and TWS software are graphical desktop Java processes that proxy calls to the back-end servers.  There is no IB support for direct connections to their server tier.

The SDK uses the [native javascript API](https://github.com/pilwon/node-ib) to manage a binary TCP socket connection from Node.js to a local IB Gateway or TWS instance.

## How do I get it?

Install with npm

    npm install ib-sdk

Clone repo with git

    git clone https://github.com/triploc/ib-sdk.git

Download over HTTPS

    wget https://github.com/triploc/ib-sdk/archive/master.zip
    unzip master.zip

## How do I use it?

Login to the Gateway or TWS software manually or use [ib-controller](https://github.com/ib-controller/ib-controller) to automate UI interaction.

Connect and interact with the IB instance.

    var ib = require("ib-sdk");
    
    ib.connection.verbose = true;
    
    ib.stock("AAPL").ticker(function(err, ticker) {
        ticker.on("beforeUpdate", function(update) {
            // View the update or look at the ticker.
        });
        
        ticker.on("afterUpdate", function(update) {
            // View the update or look at the ticker.
        });
    });

## License

Copyright (c) 2015, Jonathan Hollinger

Permission to use, copy, modify, and/or distribute this software for any purpose with or without fee is hereby granted, provided that the above copyright notice and this permission notice appear in all copies.

THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES WITH REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR ANY SPECIAL, DIRECT, INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES WHATSOEVER RESULTING FROM LOSS OF USE, DATA OR PROFITS, WHETHER IN AN ACTION OF CONTRACT, NEGLIGENCE OR OTHER TORTIOUS ACTION, ARISING OUT OF OR IN CONNECTION WITH THE USE OR PERFORMANCE OF THIS SOFTWARE.