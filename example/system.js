"use strict";

const sdk = require("..");

sdk.start().then(async session => {
    
    session.on("error", console.log);
    session.on("disconnected", () => console.log("Disconnected."));
    
    await session.system();
    
    // IB news bulletins (margin calls, special labelling, etc)
    let bulletins = session.bulletins;
    console.log(bulletins);
    
    session.on("bulletin", console.log);

    // Market data farm connections
    let connectivity = session.connectivity;
    console.log(connectivity);
    
    session.on("connectivity", console.log);

    // Access display groups
    session.displayGroups.forEach(group => console.log(group.contract));
    
    session.on("displayGroupUpdated", group => console.log(group.contract));

    // Update display group
    session.displayGroups[0].update("8314");

    setTimeout(() => session.close(), 10000);
    
}).catch(console.log);