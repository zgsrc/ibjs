"use strict";

const sdk = require("..");

sdk.start().then(async session => {
    
    let CL = (await session.securities("Front CL future on NYMEX"))[0];
    
console.log(CL.contract.marketsOpen);
    console.log(CL.contract.marketsLiquid);
    
    let AAPL = (await session.securities(172603798))[0];
    console.log(AAPL.contract);
    
    
    /*
    let AAPL = (await session.securities("AAPL stock"))[0];
    console.log(AAPL.contract);
    console.log(CL.contract);
    
    
    let snapshot = await AAPL.fundamentals("snapshot");
    console.log("SNAPSHOT");
    console.log(snapshot);
    */
    

    session.close();
}).catch(console.log);