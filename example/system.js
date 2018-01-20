"use strict";

const sdk = require("..");

sdk.start().then(async session => {
    
    session
        .on("error", console.log)
        .on("disconnected", () => console.log("Disconnected."))
        .on("connectivity", console.log)
        .on("displayGroupUpdated", group => console.log(group.contract))
        .on("bulletin", console.log);

    // Make sure stuff has loaded
    await session.system();

    // IB news bulletins (margin calls, special labelling, etc)
    let bulletins = session.bulletins;
    console.log(bulletins);

    // Market data farm connections
    let connectivity = session.connectivity;
    console.log(connectivity);

    // Access display groups
    session.displayGroups.forEach(group => console.log(group.contract));

    // Update display group
    session.displayGroups[0].update("8314");

    setTimeout(() => session.close(), 10000);
    
}).catch(console.log);