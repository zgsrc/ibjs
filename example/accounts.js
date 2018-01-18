"use strict";

const sdk = require("../index");

sdk.start().then(async session => {
    
    let accounts = await session.accounts();

    accounts.each(account => {

        console.log("Balances:");
        account.balances.each((value, name) => console.log(`${name}: ${value}`));

        console.log("Positions:");
        account.positions.each(position => console.log(position));

    });

    console.log("Orders:");
    accounts.orders.each(order => console.log(order));

    console.log("Trades:");
    accounts.trades.each(trade => console.log(trade));    
    
});