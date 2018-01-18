"use strict";

const sdk = require("..");

sdk.start().then(async session => {
    
    let AAPL = (await session.securities("AAPL stock"))[0];
    
    let snapshot = await AAPL.fundamentals("snapshot");
    console.log("SNAPSHOT");
    console.log(snapshot);
    
    

    session.close();
}).catch(console.log);