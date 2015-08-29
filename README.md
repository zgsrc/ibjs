# Interactive Brokers SDK

Interactive Brokers SDK framework build atop the native javascript API.

## Prerequisites

* Open an Interactive Brokers trading account.
* Install [Java](https://java.com/en/download/)
* Install the [IB Gateway](http://interactivebrokers.github.io) or [IB TWS (Trader Workstation)](https://www.interactivebrokers.com/en/index.php?f=674&ns=T)

## How do I get it?

Install with npm

    npm install ib-sdk

Clone repo with git

    git clone https://github.com/triploc/ib-sdk.git

Download over HTTP

    wget https://github.com/triploc/ib-sdk/archive/master.zip
    unzip master.zip

## How do I use it?

The SDK connects to a local IB Gateway or TWS instance, which it turn connects to IB back-end servers.

Login to the Gateway or TWS software manually or use [ib-controller](https://github.com/ib-controller/ib-controller) to automate this interaction.

Once the IB proxy-of-your-choice is running, you can get at it through a node.js process using the SDK like so:

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