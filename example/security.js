"use strict";

const sdk = require("..");

sdk.start().then(async session => {
    
    let AAPL = (await session.securities("AAPL stock"))[0];
    //console.log(AAPL.contract);

    let snapshot = await AAPL.fundamentals("snapshot");
    //console.log(snapshot);

    if (!AAPL.contract.marketsOpen) {
        session.frozen = true;

        let instant = await AAPL.quote.query();
        console.log(instant);

        let chart = await AAPL.charts.minutes.five.history();
        console.log(chart.series);
    }
    else {
        let quote = (await AAPL.quote.stream())
            .on("update", update => console.log(update))
            .on("error", err => console.log(err));
        
        let depth = (await AAPL.depth.stream())
            .on("update", update => console.log(update))
            .on("error", err => console.log(err));
        
        //let charts = (await AAPL.charts.stream())
        //    .on("update", update => console.log(update))
        //    .on("error", err => console.log(err));
    }
    
    setTimeout(() => session.close(), 10000);
    
}).catch(console.log);