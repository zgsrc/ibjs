# Service

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
service.contractDetails(contract);
service.fundamentalData(contract, reportType);
service.historicalData(contract, endDateTime, durationStr, barSizeSetting, whatToShow, useRTH, formatDate);
service.realTimeBars(contract, barSize, whatToShow, useRTH);
service.mktData(contract, genericTickList, snapshot);
service.mktDepth(contract, numRows);
service.scannerParameters();
service.scannerSubscription(subscription);
service.accountSummary(group, tags);
service.accountUpdates(subscribe, acctCode);
service.executions(filter);
service.commissions();
service.openOrders();
service.allOpenOrders();
service.positions();
service.orderIds(numIds);
service.placeOrder(contract, order);
service.exerciseOptions(contract, exerciseAction, exerciseQuantity, account, override);
service.newsBulletins(allMsgs);
serivce.queryDisplayGroups();
service.subscribeToGroupEvents();
serivce.updateDisplayGroup();
```