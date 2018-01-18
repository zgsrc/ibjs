[![Logo](./ib-logo.png)](http://interactivebrokers.com/)

# Interactive Brokers SDK

Interactive Brokers SDK is a high-level object model build atop the [native javascript API](https://github.com/pilwon/node-ib).  It is all about straightforward programmatic access to your portfolio and market data subscriptions.  This is an open source project unrelated to Interactive Brokers.

#### Prerequisites

* An [Interactive Brokers](https://www.interactivebrokers.com/) trading account.
* Install the [IB Gateway](https://www.interactivebrokers.com/en/index.php?f=16457) or [IB TWS (Trader Workstation)](https://www.interactivebrokers.com/en/index.php?f=674&ns=T).

#### How It Works

The [IB Gateway](http://interactivebrokers.github.io) and [IB TWS (Trader Workstation)](https://www.interactivebrokers.com/en/index.php?f=674&ns=T) software are graphical Java processes that encrypt and proxy calls to back-end servers.  Without dedicated communication infrastructure, there is no IB support for direct connections to their server tier.

The SDK uses the [native javascript API](https://github.com/pilwon/node-ib) to manage a TCP socket connection from Node.js to an IB Gateway or TWS instance.

## Installation

    npm install ib-sdk

## Getting Started

Login to the [IB Gateway](http://interactivebrokers.github.io) or [IB TWS (Trader Workstation)](https://www.interactivebrokers.com/en/index.php?f=674&ns=T) software.

* The SDK expects to connect to an authenticated user session.
* The IB software must be configured to accept API connections.
* The SDK connects over `tcp://localhost:4001` by default.
* Use [ib-controller](https://github.com/ib-controller/ib-controller/releases) to automate UI interaction if necessary.

The main interface of the SDK is the `session` object returned by the `sdk.open` method callback.

```javascript
require("ib-sdk").open({
    host: "localhost",
    port: 4001,
    clientId: 0
}, (err, session) => {
    if (err) console.log(err);
    else session.close();
});
```

Invoke `session.close()` to trigger disconnect logic.

## async/await

Use the async/await interface to get setup without a lot of nested code.

```javascript
require("ib-sdk").setup(4001, async function(ib) {
    let account = await ib.account();
    let accountSummary = await ib.accountSummary();
    let positions = await ib.positions();
    let trades = await ib.trades();
    let AAPL = await ib.securities("AAPL stock")[0];
    
    return AAPL;
}).then(AAPL => {

});
```

```javascript

```

## Use Cases

Each `session` is associated with one or more accounts.  The most common case is access to a single [account](./example/account.js).  Other use cases can benefit from the lightweight [account summary](./example/summary.js) model.

Use the SDK's [symbol](./doc/symbols.md) syntax to create [security](./example/security.js) objects from which you can access market data and initiate [orders](./doc/orders.md).

Manage [system](./example/system.js) events like changes in market data farm connectivity, IB bulletins, and FYI's.  If you connect to the graphical TWS software, you can interact with display groups.

This package uses [Sugar](https://sugarjs.com) in extended mode, which modifies javascript prototypes.

The [service](./doc/service.md) module makes interacting with the IB API pub/sub paradigm easier and enables [remoting](./doc/remoting.md) from other processes or the browser.

## License

Copyright 2017 Jonathan Hollinger

Permission to use, copy, modify, and/or distribute this software for any purpose with or without fee is hereby granted, provided that the above copyright notice and this permission notice appear in all copies.

THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES WITH REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR ANY SPECIAL, DIRECT, INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES WHATSOEVER RESULTING FROM LOSS OF USE, DATA OR PROFITS, WHETHER IN AN ACTION OF CONTRACT, NEGLIGENCE OR OTHER TORTIOUS ACTION, ARISING OUT OF OR IN CONNECTION WITH THE USE OR PERFORMANCE OF THIS SOFTWARE.