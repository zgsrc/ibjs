"use strict";

const sdk = require("../index");

sdk.open({ port: 4001 }, (err, session) => {
    if (err) {
        console.log(err);
    }
    else {
        // Multiple account summaries (options parameter optional)
        let accounts = session.accountSummary({
            positions: true,
            groups: "all",
            tags: Object.values(sdk.flags.ACCOUNT_TAGS).join(',')
        });
        
        // Positions summary across accounts
        let positions = session.positions();
        
        // Orders across accounts (options parameter optional)
        let orders = session.orders({
            all: true,
            autoOpen: false
        });
        
        // Trades across accounts (filter parameter optional)
        let trades = session.trades({
            account: null,
            client: null,
            exchange: null,
            secType: null,
            side: null,
            symbol: null,
            time: null
        });

        // Close connection and fire 'disconnect' event
        session.close();
    }
});