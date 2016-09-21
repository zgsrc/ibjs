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

Login to the [IB Gateway](http://interactivebrokers.github.io) or [IB TWS (Trader Workstation)](https://www.interactivebrokers.com/en/index.php?f=674&ns=T) software manually or use [ib-controller](https://github.com/ib-controller/ib-controller) to automate UI interaction.  The API and SDK expect to connect to an authenticated user session.  The IB software must be configured to accept API connections.  The SDK connects over `tcp://localhost:4001` by default.

Kick the tires and make sure sure things work by running the terminal interface from the SDK directory:

    npm start terminal [port]
    
The terminal will give you a default `environment` through the `ib` variable.  Use `watch` as an alias to `ib.watch` and `$` as an alias to `ib.symbols` for ease.

    > watch("AAPL")
    undefined
    > $.AAPL
    [all the things]

> **NOTE**: IB Gateway or TWS can enter a partially functional state with respect to API connections.  If connect works but other calls do not, you may need to restart the IB software.

## How does it work?

The [IB Gateway](http://interactivebrokers.github.io) and [IB TWS (Trader Workstation)](https://www.interactivebrokers.com/en/index.php?f=674&ns=T) software are graphical Java processes that encrypt and proxy calls to back-end servers.  Without dedicated communication infrastructure, there is no IB support for direct connections to their server tier.

The SDK uses the [native javascript API](https://github.com/pilwon/node-ib) to manage a TCP socket connection from Node.js to an IB Gateway or TWS instance.

# Design Paradigm

The SDK seeks to be both easy to use and highly configurable.  To achieve this, it implements:

* a high-level trading environment
* an object model
* request-response management

## High-Level Trading Environment

The trading environment is about getting setup quickly and focusing on the high-value algorithmic work.

Most use cases require a boilerplate dataset like balance information, positions, orders, and trades.  The SDK provides an `Environment` class which is conceptually like a full TWS graphical experience, wherein you have a predefined set of data "windows".

```javascript
let sdk = require("ib-sdk"),
    session = sdk.connect({ host: "localhost", port: 4001 });

session.service.socket.on("connected", () => {
    // default environment
    let ib = session.environment();
    
    // custom environment
    ib = session.environment({ 
        system: true,
        accounts: true,
        positions: true,
        executions: true,
        orders: "all",
        symbols: [
            "SPX index",
            "GOOGL"
        ]
    });
    
    // bad state detection on environment, see note below
    ib.on("badState", () => {
        console.log("IB API unresponsive!!! Try restarting IB software and reconnecting.");
    })
    
    // environment in a loaded and ready state
    ib.on("load", () => {
        let system = ib.system,
            accounts = ib.accounts,
            positions = ib.positions,
            trades = ib.executions,
            orders = ib.orders,
            $ = ib.symbols;
          
        ib.watch("INDU indux");
    });
});
```

### Symbols

An `Environment` manages a collection of `Symbol` objects containing contract details, fundamental and market data.  It also serves as a hard reference from which to create an `Order` ticket.  

Create a `Symbol` using the `watch` method with an optional configuration.  The `Environment` will register the `Symbol` in the `symbols` member variable.

```javascript
ib.watch("AAPL", {
    name: "Apple",
    fundamentals: "all",
    quote: "streaming",
    depth: "all",
    rows: 10,
    bars: {
        ONE_SECOND: false,
        FIVE_SECONDS: false,
        FIFTEEN_SECONDS: false,
        THIRTY_SECONDS: false,
        ONE_MINUTE: false,
        TWO_MINUTES: false,
        THREE_MINUTES: false,
        FIVE_MINUTES: true,
        FIFTEEN_MINUTES: false,
        THIRTY_MINUTES: false,
        ONE_HOUR: false,
        TWO_HOURS: false,
        FOUR_HOURS: false,
        EIGHT_HOURS: false,
        ONE_DAY: false,
    }
});

let apple = ib.symbols.Apple,
    fundamentals = apple.fundamentals,
    quote = apple.quote,
    depth = apple.depth,
    bars = apple.bars.FIVE_MINUTES,
    order = apple.order();
```

The SDK lets you specify financial instruments in a readable string format.

    [date]? [symbol] [side/type]? (in [currency])? (on [exchange])? (at [strike])?

So for example, a stock might look like:

> IBM
> IBM stock
> IBM stock in MXN on BMV

Futures:

> Jan16 CL futures
> Jan16 CL futures in USD on NYMEX

Options:

> Sep16'17 AAPL puts at 110

Currencies:

> USD.EUR currency

Indices:

> INDU index

## Data Model

The data model puts an object-oriented interface around most of the low-level API capabilities, handling complicated `Service` method calls and assembling streaming responses into a comprehensive dataset.

The primary interface for the data model is the `Session` class, a builder object that instantiates components of the data model using a `Service`.

```javascript
let session = sdk.connect({ 
    host: "localhost", 
    port: 4001
});

session.service.socket.on("connected", () => {
    // session ready for use
}).connect();

// or do it yourself with an existing service
session = sdk.Session(service);

// exposes aspects of the data model
let system = session.system(),
    accounts = session.accounts(),
    positions = session.positions(),
    orders = session.orders([all]),
    executions = session.executions(),
    news = session.news([flags]);

session.security(contractDescription, (err, security) => { 
    let fundamentals = security.fundamentals(),
        quote = security.quote(),
        depth = security.depth(),
        order = security.order(), // optional: defaults
        symbol = security.symbol(); // optional: options
});
```

## Request-Response Abstraction

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
service.contractDetails();
service.fundamentalData();
service.historicalData();
service.realTimeBars();
service.mktData();
service.mktDepth();
service.scannerParameters();
service.scannerSubscription();
service.accountSummary();
service.accountUpdates();
service.executions();
service.commissions();
service.openOrders();
service.allOpenOrders();
service.positions();
service.orderids();
service.placeOrder();
service.exerciseOptions();
service.newsBulletins();
serivce.queryDisplayGroups();
service.subscribeToGroupEvents();
serivce.updateDisplayGroup();
```

`Service` instances also supports a mechanism to relay streaming responses to proxy instances of the SDK, enabling a distributed/networked system architecture.  The `relay` method takes a `EventEmitter` compatible (i.e. implements `emit` and `on`) object and relays `data`, `error`, and `end` events.  A `Proxy` is a `Service`-compatible object that can be instantiated remotely and use a similar `EventEmitter` compatible transport (e.g. [socket.io](http://socket.io/)) to communicate with a `Relay` server.

Server
```javascript
let app = require('http').createServer(handler),
    io = require('socket.io')(app).on('connection', socket => sdk.server({
        host: "localhost", port: 4001
    }, socket));

app.listen(8080);
```

Client
```javascript
var io = require('socket.io-client')('http://localhost:8080'),
    session = sdk.client(io);
```

## License

Copyright (c) 2016, Jonathan Hollinger

Permission to use, copy, modify, and/or distribute this software for any purpose with or without fee is hereby granted, provided that the above copyright notice and this permission notice appear in all copies.

THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES WITH REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR ANY SPECIAL, DIRECT, INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES WHATSOEVER RESULTING FROM LOSS OF USE, DATA OR PROFITS, WHETHER IN AN ACTION OF CONTRACT, NEGLIGENCE OR OTHER TORTIOUS ACTION, ARISING OUT OF OR IN CONNECTION WITH THE USE OR PERFORMANCE OF THIS SOFTWARE.