"use strict";

const sdk = require("..");

sdk.open((err, session) => {
    if (err) {
        console.log(err);
    }
    else {
        // Full balance, position, order, and trade history access
        let account = session.account();
        
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