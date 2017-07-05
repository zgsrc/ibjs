"use strict";

const sdk = require("..");

sdk.open((err, session) => {
    if (err) {
        console.log(err);
    }
    else {
        session.securities("AAPL stock", (err, secs) => {
            if (err) {
                console.log(err);
            }
            else {
                let AAPL = secs[0];
                
                AAPL.fundamental(sdk.flags.FUNDAMENTALS_REPORTS.financials, (err, report) => {
                    if (err) console.log(err);
                    else console.log(report);
                });
                
                AAPL.quote.snapshot((err, quote) => {
                    if (err) console.log(err);
                    else console.log(quote);
                });
                
                if (AAPL.contract.marketsOpen) {
                    AAPL.quote.stream().on("update", data => {
                        console.log(data);
                    });

                    AAPL.depth.stream().on("update", data => {
                        console.log(data);
                    });

                    AAPL.charts.stream();
                    
                    AAPL.charts.minutes.five.on("update", data => {
                        console.log(data);
                    });
                }
                else {
                    // Streaming won't work so well.
                }
                
                AAPL.charts.minutes.five.history(() => {
                    console.log(AAPL.charts.minutes.five.series);
                });
                
                AAPL.charts.minutes.five.study("SMA20", 20, "SMA");
                
                sdk.studies.CUSTOM = window => window.sum("volume");
                AAPL.charts.minutes.five.study("CUMVOL20", 20, "CUSTOM");
            }
        });
        
        setTimeout(() => {
            session.close();
        }, 10000);
    }
});