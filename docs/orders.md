### [Orders](#orders)

An `Order` can be initiated from a `Symbol` (or `Security`) and has chainable methods to build and transmit an order.

```javascript
let order = ib.symbols.Apple.order();

order.sell(100)
     .show(10)
     .limit(100.50)
     .goodUntilCancelled()
     .transmit();
```

Quantity and market side can be set with an appropriate method.  Display size can be set an extra parameter or with the separate `show` method.

```javascript
order.buy(100).show(10);
order.buy(100, 10);
order.trade(100, 10);

order.sell(100).show(10);
order.sell(100, 10);
order.trade(-100, -10);
```

Order type is set with an appropriate method or manually.

```javascript
order.market();
order.marketWithProtection();
order.marketThenLimit();
order.limit(100.50);

order.stop(100.50);
order.stopLimit(100.50, 100.48);
order.stopWithProtection(100.50);
```

Time in force is presumed to be "DAY" unless otherwise specified.  Timeframe can be set with appropriate methods.

```javascript
order.goodToday()
order.immediateOrCancel();
order.goodUntilCancelled().outsideRegularTradingHours();
```

Order transmission can be performed in a single transaction or in parts.

```javascript
// Will suppress certain IB warnings for large trades
order.overridePercentageConstraints();

// Will open the order without transmitting it.
order.open();

// Will open the order and trasmit it.
order.transmit();
```

Once an order is opened, it flows to the `Orders` object.

```javascript
let orders = ib.orders.all;

ib.orders.on("update", order => { 
    order.cancel();
});
```

As the order is being executed, `Positions` will update.

```javascript
for (account in ib.positions.accounts) {
    let accountPositions = positions.accounts[account];
    for (id in accountPositions) {
        let position = accountPositions[id];
    }
}
```

After an order is executed or cancelled, it flows to the `Executions` object, which is a trade history.

```javascript
let trades = ib.executions.trades;

ib.executions.on("update", trade => {
    console.log(trade);
});
```