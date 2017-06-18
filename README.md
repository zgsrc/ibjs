[![Logo](./ib-logo.png)](http://interactivebrokers.com/)

# Interactive Brokers SDK

Interactive Brokers SDK is a framework build atop the [native javascript API](https://github.com/pilwon/node-ib).  Straightforward programmatic access to your portfolio and market data subscriptions.

## Installation

    npm install ib-sdk

### Prerequisites

* An [Interactive Brokers](https://www.interactivebrokers.com/) trading account.
* Install the [IB Gateway](http://interactivebrokers.github.io) or [IB TWS (Trader Workstation)](https://www.interactivebrokers.com/en/index.php?f=674&ns=T).

The [IB Gateway](http://interactivebrokers.github.io) and [IB TWS (Trader Workstation)](https://www.interactivebrokers.com/en/index.php?f=674&ns=T) software are graphical Java processes that encrypt and proxy calls to back-end servers.  Without dedicated communication infrastructure, there is no IB support for direct connections to their server tier.

The SDK uses the [native javascript API](https://github.com/pilwon/node-ib) to manage a TCP socket connection from Node.js to an IB Gateway or TWS instance.

## Setup

1. Login to the [IB Gateway](http://interactivebrokers.github.io) or [IB TWS (Trader Workstation)](https://www.interactivebrokers.com/en/index.php?f=674&ns=T) software.
    * The API and SDK expect to connect to an authenticated user session.
    * The IB software must be configured to accept API connections.
    * The SDK connects over `tcp://localhost:4001` by default.
    * Use [ib-controller](https://github.com/ib-controller/ib-controller/releases) to automate UI interaction if so desired.
2. Make sure sure things work by running the terminal interface from the SDK directory.  Any issues encountered during startup will be reported and the terminal will exit.

        $ cd ib-sdk
        $ npm start [port]
    
3. If the SDK can establish a working connection and load the object model, the terminal will start successfully.

        Use the 'session' variable to access the session. Type .exit to quit.
        > 

Explore the SDK using the terminal.

## Programming

[Account](./examples/account.js)

[Summary](./examples/summary.js)

[System](./examples/system.js)

[Symbols](./docs/symbols.md)

[Security](./examples/security.js)

## Advanced

[Service](./docs/service.md)

[Remoting](./docs/remoting.md)

## License

Copyright (c) 2017, Jonathan Hollinger

Permission to use, copy, modify, and/or distribute this software for any purpose with or without fee is hereby granted, provided that the above copyright notice and this permission notice appear in all copies.

THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES WITH REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR ANY SPECIAL, DIRECT, INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES WHATSOEVER RESULTING FROM LOSS OF USE, DATA OR PROFITS, WHETHER IN AN ACTION OF CONTRACT, NEGLIGENCE OR OTHER TORTIOUS ACTION, ARISING OUT OF OR IN CONNECTION WITH THE USE OR PERFORMANCE OF THIS SOFTWARE.