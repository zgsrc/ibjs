"use strict";

const sdk = require("..");

sdk.open((err, session) => {
    if (err) {
        console.log(err);
    }
    else {
        // By default, the first value in session.managedAccounts array is used.
        let account = session.account();
        
        // Otherwise you can supply options manually
        account = session.account({
            id: session.managedAccounts[0],
            orders: true,
            trades: true
        });
        
        // Best effort (timer-based) to let a consistent initial state load.
        account.on("load", () => {
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