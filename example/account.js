"use strict";

const sdk = require("..");

sdk.start().then(async session => {
    
    session.on("error", console.log);
    
    let account = await session.account();

    console.log("Balances:");
    account.balances.each((value, name) => console.log(`${name}: ${value}`));

    console.log("Positions:");
    account.positions.each(position => console.log(position));

    console.log("Orders:");
    account.orders.each(order => console.log(order));

    console.log("Trades:");
    account.trades.each(trade => console.log(trade));
    
    account.session.close();
    
}).catch(err => console.log("ERROR: " + err.message));