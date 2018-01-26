"use strict";

const sdk = require("..");

sdk.start().then(async session => {
    let account = await session.account();

    console.log("Balances:");
    account.balances.each((value, name) => console.log(`${name}: ${value}`));

    console.log("Positions:");
    account.positions.each(position => console.log(JSON.stringify(position, null, '\t')));

    console.log("Orders:");
    account.orders.each(order => console.log(JSON.stringify(order, null, '\t')));

    console.log("Trades:");
    account.trades.each(trade => console.log(JSON.stringify(trade, null, '\t')));
    
    session.close();
}).catch(console.log);