# Orders

An `Order` can be initiated from a `Security` and has chainable methods to build and transmit an order.

```javascript
session.security("AAPL stock", (err, securities) => {
    if (err) console.log(err);
    else {
        let AAPL = securities[0],
            order = AAPL.order();
        
        order.sell(100)
             .show(10)
             .limit(100.50)
             .goodUntilCancelled()
             .transmit();
    }
});
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
order.save();

// Will open the order and trasmit it.
order.transmit();

// Will update existing order.
order.save();

// Will cancel order.
order.cancel();
```