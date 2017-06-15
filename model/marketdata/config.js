"use strict";

module.exports = () => {
    
    return {
                
        /* Market data subscriptions that are opened by default. */
        "symbol": {

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