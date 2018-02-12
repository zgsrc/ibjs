The entry point is the `session` returned by the `ibjs.session` promise.  Each `session` is associated with one or more accounts.  The most common case is access to a single account.

```javascript
ibjs.session({
    host: "localhost",
    port: 4001,
    timeout: 500,
    orders: "passive"
}).then(async session => {
    // Only one account can be subscribed to at a time.
    let account = await session.account();
    console.log(account);
    
    // For multiple managed accounts, account summary must be used.
    let accounts = await session.accounts();
    console.log(accounts);
                                      
    // Trade history
    let trades = await session.trades();
    console.log(trades);
                                      
    // Orders are a singleton attached to the session
    console.log(session.orders);
    
    session.close();
}).catch(console.log);
```

Use the [symbol](./doc/symbols.md) syntax to lookup `contracts`.

```javascript
let AAPL = session.contract("AAPL stock");
console.log(AAPL.contract);

let snapshot = await AAPL.fetchReport("snapshot");
console.log(snapshot);

(await AAPL.quote.stream()).log();
    
let chart = await AAPL.charts["5 mins"].history();
console.log(chart.series);
```

## License

Copyright 2017 Jon Hollinger

This is an open source project unrelated to Interactive Brokers.

Permission to use, copy, modify, and/or distribute this software for any purpose with or without fee is hereby granted, provided that the above copyright notice and this permission notice appear in all copies.

THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES WITH REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR ANY SPECIAL, DIRECT, INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES WHATSOEVER RESULTING FROM LOSS OF USE, DATA OR PROFITS, WHETHER IN AN ACTION OF CONTRACT, NEGLIGENCE OR OTHER TORTIOUS ACTION, ARISING OUT OF OR IN CONNECTION WITH THE USE OR PERFORMANCE OF THIS SOFTWARE.