# Session

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