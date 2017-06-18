"use strict";

const sdk = require("../index");

sdk.open({ port: 4001 }, (err, session) => {
    if (err) {
        console.log(err);
    }
    else {
        // Multiple account summaries
        let accounts = session.accountSummary(),
            positions = session.positions(),
            orders = session.orders(),
            trades = session.trades();

        // Close connection and fire 'disconnect' event
        session.close();
    }
});