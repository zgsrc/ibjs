"use strict";

module.exports = () => {
    return {
        
        /* Settings for socket connection to IB software. */
        "connection": {
            "host": "localhost",
            "port": 4001,
            "timeout": 1000
        },
        
        /* Environment configuration. */
        "environment": {
            
            /* Subscribe to system notifications and connectivity status updates. */
            "system": true,

            /* Subscribe to realtime account balance and position values.
               - Boolean value subscribes to all account info.
               - An array of tags (i.e. [ "TAG1", "TAG2" ]) subscribes to select values.  (Print Environment.accounts.TAGS variable for a list of tags.) */
            "accounts": true,

            /* Subscribe to basic position info across accounts. */
            "positions": true,

            /* Subscribe to trade history, past and ongoing trades. 
               - Boolean value loads today's trades.
               - A filter object adjusts the scope of trades. */
            "executions": true,

            /* Subscribe to pending orders.
               - "all" subscribes to all orders placed in IB.
               - "local" subscribes only to orders placed through this process. */
            "orders": "all",

            /* Watchlist of securities. */
            "symbols": [
                "GOOGL",
                [ "AAPL", { /* Override defaults */ } ],
                { 
                    "description": "IBM", 
                    "options": { /* Override defaults */ }
                }
            ],
            
            /* Load timeout in milliseconds */
            timeout: 30000

        },
                
        /* Market data subscriptions that are opened by default. */
        "symbols": {

            /* Download fundamental data.
               - The "all" option fetches all available fundamental data.
               - Any other string fetches the fundamental report by that name.
               - An array of strings fetch all reports in the array.  (Print Symbol.fundamentals.REPORT_TYPES variable for a list of reports.) */
            "fundamentals": "all",

            /* Subscribe to quote data.
               - Boolean value opens a streaming quote of price and volume data.
               - The "snapshot" string fetches a snapshot of quote data without initializing a streaming subscription.
               - An array of strings registers specific streaming quote fields.  (Print Symbol.quote.TICK_TYPES variable for a list of fields.) */
            "quote": true,

            /* Subscribe to level 2 data.
               - The "all" string subscribes to level 2 data from all valid exchanges.
               - An array of strings subscribes to specific market data centers. */
            "level2": {
                "markets": "all",
                "rows": 10
            },

            /* Subscribes to a bar chart data.  Must use one of the bar sizes below.
               - Boolean loads one history period and subscribes to realtime updates
               - Positive integer loads that many historical periods and subscribes to realtime updates */
            "bars": {
                "ONE_SECOND": false,
                "FIVE_SECONDS": false,
                "FIFTEEN_SECONDS": false,
                "THIRTY_SECONDS": false,
                "ONE_MINUTE": false,
                "TWO_MINUTES": false,
                "THREE_MINUTES": false,
                "FIVE_MINUTES": true,
                "FIFTEEN_MINUTES": false,
                "THIRTY_MINUTES": false,
                "ONE_HOUR": false,
                "TWO_HOURS": false,
                "FOUR_HOURS": false,
                "EIGHT_HOURS": false,
                "ONE_DAY": false
            }

        }        
        
    };
};