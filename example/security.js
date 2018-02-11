

const sdk = require("..");

sdk.start().then(async session => {
    
    let AAPL = await session.security("AAPL stock");
    console.log(AAPL.contract);

    let snapshot = await AAPL.fundamentals("snapshot");
    console.log(JSON.stringify(snapshot, null, '\t'));

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
    
    setTimeout(() => session.close(), 10000);
    
}).catch(console.log);