# Interactive Brokers SDK

Interactive Brokers SDK framework build atop the native javascript API.

## How does it work?

* Get the IB Gateway or IB TWS (Trader Workstation)
* Login manually or use ib-controller
* ib-sdk gives you high-level, node-friendly access to the IBAPI

## How do I get it?

From GitHub

    git clone https://github.com/triploc/ib-sdk.git

From NPM

    npm install ib-sdk

## How do I use it?

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