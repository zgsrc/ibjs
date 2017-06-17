"use strict";

const sdk = require("../index");

sdk.open({ port: 4001 }, (err, session) => {
    if (err) {
        console.log(err);
    }
    else {
        // IB news bulletins (margin calls, special labelling, etc)
        let bulletins = session.bulletins;
        session.on("bulletin", data => { });

        // Market data farm connections
        let connectivity = session.connectivity;
        session.on("connectivity", data => { });

        // Multiple account summaries
        let accounts = session.accountSummary(),
            positions = session.positions(),
            orders = session.orders(),
            trades = session.trades();

        // Close connection and fire 'disconnect' event
        session.close();
    }
});