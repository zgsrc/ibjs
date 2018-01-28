[![Logo](./ib-logo.png)](http://interactivebrokers.com/)

# Interactive Brokers Javascript Library

This is a high-level javascript library build atop the [native javascript API](https://github.com/pilwon/node-ib).

#### Prerequisites

* An [Interactive Brokers](https://www.interactivebrokers.com/) trading account.
* Install the [IB Gateway](https://www.interactivebrokers.com/en/index.php?f=16457) or [IB TWS (Trader Workstation)](https://www.interactivebrokers.com/en/index.php?f=674&ns=T).

#### How It Works

The [IB Gateway](http://interactivebrokers.github.io) and [IB TWS (Trader Workstation)](https://www.interactivebrokers.com/en/index.php?f=674&ns=T) software are graphical Java processes that encrypt and proxy calls to back-end servers.  Without special infrastructure there is no support for direct connections to IB servers, so the library uses the [native javascript API](https://github.com/pilwon/node-ib) to manage a TCP socket connection from Node.js to an IB Gateway or TWS instance.

## Installation

    npm install ibjs

## Getting Started

Login to the [IB Gateway](http://interactivebrokers.github.io) or [IB TWS (Trader Workstation)](https://www.interactivebrokers.com/en/index.php?f=674&ns=T) software.

* The library expects to connect to an authenticated user session.
* The IB software must be configured to accept API connections.
* The library connects over `tcp://localhost:4001` by default.
* Use [ib-controller](https://github.com/ib-controller/ib-controller/releases) to automate UI interaction if necessary.

The entry point is the `session` returned by the `ibjs.start` promise.  Each `session` is associated with one or more accounts.  The most common case is access to a single [account](./example/account.js).

```javascript
ibjs.start().then(async session => {
    let account = await session.account();

    console.log("Balances:");
    account.balances.each((value, name) => console.log(`${name}: ${value}`));

    console.log("Positions:");
    account.positions.each(position => console.log(position));

    console.log("Orders:");
    account.orders.each(order => console.log(order));

    console.log("Trades:");
    account.trades.each(trade => console.log(trade));
    
    session.close();
}).catch(console.log);
```

For multiple managed accounts, the [accounts](./example/accounts.js) summary must be used.  Otherwise only one account can be subscribed to at a time.

```javascript
let accounts = await session.accounts();
accounts.each((account, name) => {
    console.log(name);

    console.log("Balances:");
    account.balances.each((value, name) => console.log(`${name}: ${value}`));

    console.log("Positions:");
    account.positions.each(position => console.log(position));
});

console.log("Orders:");
accounts.orders.each(order => console.log(order));

console.log("Trades:");
accounts.trades.each(trade => console.log(trade));

session.close();
```

## Market Data

Use the [symbol](./doc/symbols.md) syntax to create `securities` from which you can access market data.

```javascript
let AAPL = session.security("AAPL stock");
console.log(AAPL.contract);

let snapshot = await AAPL.fundamentals("snapshot");
console.log(snapshot);

if (!AAPL.contract.marketsOpen) {
    session.frozen = true;
    
    let instant = await AAPL.quote.query();
    console.log(instant);
    
    let chart = await AAPL.charts.minutes.five.history();
    chart.study("SMA20", 20, "SMA");
    console.log(chart.series);
}
else {
    (await AAPL.quote.stream()).log();
    (await AAPL.depth.stream()).log();
    (await AAPL.charts.stream()).log();
}
```

## System

Manage [system](./example/system.js) events like changes in market data farm connectivity, IB bulletins, and FYI's.  If you connect to the graphical TWS software, you can interact with display groups.

```javascript
session
    .on("error", console.log)
    .on("disconnected", () => console.log("Disconnected."))
    .on("connectivity", console.log)
    .on("displayGroupUpdated", group => console.log(group.security.contract.summary))
    .on("bulletin", console.log);

// Make sure stuff has loaded
await session.system();

// IB news bulletins (margin calls, special labelling, etc)
let bulletins = session.bulletins;
console.log(bulletins);

// Market data farm connections
let connectivity = session.connectivity;
console.log(connectivity);

// Access display groups
session.displayGroups.forEach(group => {
    if (group.security) console.log(group.security.contract.summary);
});

// Update display group
session.displayGroups[0].update(await session.security("AAPL"));

setTimeout(() => session.close(), 10000);
```

## Advanced

The [service](./doc/service.md) module makes interacting with the IB API pub/sub paradigm easier and enables [remoting](./doc/remoting.md) from other processes or the browser.

This package uses [Sugar](https://sugarjs.com) in extended mode, which modifies javascript prototypes.

## License

Copyright 2017 Jonathan Hollinger

This is an open source project unrelated to Interactive Brokers.

Permission to use, copy, modify, and/or distribute this software for any purpose with or without fee is hereby granted, provided that the above copyright notice and this permission notice appear in all copies.

THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES WITH REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR ANY SPECIAL, DIRECT, INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES WHATSOEVER RESULTING FROM LOSS OF USE, DATA OR PROFITS, WHETHER IN AN ACTION OF CONTRACT, NEGLIGENCE OR OTHER TORTIOUS ACTION, ARISING OUT OF OR IN CONNECTION WITH THE USE OR PERFORMANCE OF THIS SOFTWARE.