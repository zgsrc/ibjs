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
    
The terminal will give you a default `environment` through the `ib` variable.  Use `define` as an alias to `ib.define` and `$` as an alias to `ib.symbols` for ease.

    > define("AAPL")
    undefined
    > $.AAPL
    [all the things]

Connect to the IB process like so:

```javascript
let sdk = require("ib-sdk"),
    session = sdk.connect({ host: "localhost", port: 4001 });

session.service.socket.on("connected", () => {
    let ib = session.environment().on("badState", () => {
        console.log("IB API unresponsive!!! Try restarting IB software and reconnecting.");
    });
    
    ib.define("AAPL");
});
```

> **NOTE**: IB Gateway or TWS can enter a partially functional state with respect to API connections.  If connect works but other calls do not, you may need to restart the IB software.

# Miscellaneous

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

## License

Copyright (c) 2016, Jonathan Hollinger

Permission to use, copy, modify, and/or distribute this software for any purpose with or without fee is hereby granted, provided that the above copyright notice and this permission notice appear in all copies.

THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES WITH REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR ANY SPECIAL, DIRECT, INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES WHATSOEVER RESULTING FROM LOSS OF USE, DATA OR PROFITS, WHETHER IN AN ACTION OF CONTRACT, NEGLIGENCE OR OTHER TORTIOUS ACTION, ARISING OUT OF OR IN CONNECTION WITH THE USE OR PERFORMANCE OF THIS SOFTWARE.