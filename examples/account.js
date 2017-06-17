"use strict";

const sdk = require("..");

sdk.open((err, session) => {
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

        // Full balance, position, order, and trade history access
        let account = session.account().on("load", () => {
            console.log("Account:");
            account.each((value, name) => console.log(`${name}: ${value}`));

            console.log("Positions:");
            account.positions.each(position => console.log(position));

            console.log("Orders:");
            account.orders.each(order => console.log(order));

            console.log("Trades:");
            account.trades.each(trade => console.log(trade));

            // Close connection and fire 'disconnect' event
            session.close();
        }); 
    }
});