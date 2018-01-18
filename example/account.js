"use strict";

const sdk = require("..");

sdk.account().then(async account => {
    
    account.session.on("error", console.log);

    /*
    console.log("Balances:");
    account.balances.each((value, name) => console.log(`${name}: ${value}`));

    console.log("Positions:");
    account.positions.each(position => console.log(position));

    console.log("Orders:");
    account.orders.each(order => console.log(order));

    console.log("Trades:");
    account.trades.each(trade => console.log(trade));
    */
    
    
    let AAPL = await account.session.securities("AAPL stock");
    console.log("AAPL Stock:");
    console.log(AAPL.contract);
    
    /*
    let financials = await AAPL.fundamental(sdk.flags.FUNDAMENTALS_REPORTS.financials);
    console.log("Financials:");
    console.log(financials);
    */
    
    account.session.close();
    
}).catch(err => console.log("ERROR: " + err.message));