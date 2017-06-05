## Accounts

The `Accounts` class provides access to complete balance, margin, and positions information for all accounts to which that the authenticated session has access.  

First, a subscription to a summary of accounts is opened, which populates the `Accounts.summary` object.  Then, for each account in the summary, a subscription to account updates is opened, which populate the `Account.details` and `Account.positions` variables.

```javascript
let accounts = ib.accounts,
    summary = accounts.summary,
    details = accounts.details,
    positions = accounts.positions;
```

## System

The `System` class emits all system messages using the `update` event.

Messages relating to market data server connectivity are parsed and posted to the `System.marketDataConnections` member variable.  Changes to connectivity trigger the `marketDataConnectionChange` event.

```javascript
let connectivity = ib.system.marketDataConnections;

ib.system.on("marketDataConnectionChange", (name, status) => {
    connectivity[name] === status;
});
```