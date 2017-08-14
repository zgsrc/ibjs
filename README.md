[![Logo](./ib-logo.png)](http://interactivebrokers.com/)

# Interactive Brokers SDK

Interactive Brokers SDK is a framework build atop the [native javascript API](https://github.com/pilwon/node-ib).  Straightforward programmatic access to your portfolio and market data subscriptions.

## Installation

    npm install ib-sdk

### Prerequisites

* An [Interactive Brokers](https://www.interactivebrokers.com/) trading account.
* Install the [IB Gateway](https://www.interactivebrokers.com/en/index.php?f=16457) or [IB TWS (Trader Workstation)](https://www.interactivebrokers.com/en/index.php?f=674&ns=T).

The [IB Gateway](http://interactivebrokers.github.io) and [IB TWS (Trader Workstation)](https://www.interactivebrokers.com/en/index.php?f=674&ns=T) software are graphical Java processes that encrypt and proxy calls to back-end servers.  Without dedicated communication infrastructure, there is no IB support for direct connections to their server tier.

The SDK uses the [native javascript API](https://github.com/pilwon/node-ib) to manage a TCP socket connection from Node.js to an IB Gateway or TWS instance.

## Programming

Each session is associated with one or more accounts.  The most common case is access to a single [account](./examples/account.js).  Other use cases can benefit from the lightweight [account summary](./examples/summary.js) model.

Use the SDK's [symbol](./docs/symbols.md) syntax to create [security](./examples/security.js) objects from which you can access market data and initiate [orders](./docs/orders.md).

Manage [system](./examples/system.js) events like changes in market data farm connectivity, IB bulletins, and FYI's.  If you connect to the graphical TWS software, you can interact with display groups.

This package makes use of the [Sugar](https://sugarjs.com) library, which modifies javascript prototypes (at least the way it is used in this case).  In the end, this is a design decision about how trading system logic can most effectively be expressed and implemented.

## Advanced

The programming model is built on top of the [service](./docs/service.md) module, which makes interacting with the IB API pub/sub paradigm easier.

## Resources

* [Headless IB Gateway Installation on Ubuntu Server](https://github.com/roblav96/headless-ib-gateway-installation-ubuntu-server)

## License

Copyright 2017 Jonathan Hollinger

Permission to use, copy, modify, and/or distribute this software for any purpose with or without fee is hereby granted, provided that the above copyright notice and this permission notice appear in all copies.

THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES WITH REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR ANY SPECIAL, DIRECT, INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES WHATSOEVER RESULTING FROM LOSS OF USE, DATA OR PROFITS, WHETHER IN AN ACTION OF CONTRACT, NEGLIGENCE OR OTHER TORTIOUS ACTION, ARISING OUT OF OR IN CONNECTION WITH THE USE OR PERFORMANCE OF THIS SOFTWARE.
