"use strict";

const sdk = require("../index");

sdk.open({ port: 4001 }, (err, session) => {
    if (err) {
        console.log(err);
    }
    else {
        // IB news bulletins (margin calls, special labelling, etc)
        let bulletins = session.bulletins;
        session.on("bulletin", data => console.log(data));

        // Market data farm connections
        let connectivity = session.connectivity;
        session.on("connectivity", data => console.log(data));
        
        // Access display groups
        session.displayGroups.forEach(group => console.log(group.contract));
        session.on("displayGroupUpdated", group => console.log(group.contract));
        
        // Update display group
        session.displayGroups[0].update(8314);

        // Close connection and fire 'disconnect' event
        setTimeout(() => session.close(), 2500);
    }
});