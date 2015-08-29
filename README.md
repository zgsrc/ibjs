# Interactive Brokers SDK

Interactive Brokers SDK framework build atop the native javascript API.

## How does it work?

* Get the IB Gateway or IB TWS (Trader Workstation)
* Login manually or use ib-controller
* ib-sdk gives you high-level, node-friendly access to the IBAPI

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

ISC license because I don't know any better.