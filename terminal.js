"use strict";

const Environment = require("./model/environment"),
      ib = require("./index"),
      repl = require("repl"),
      colors = require("colors");

const terminal = exports.terminal = configuration => {
    process.on('uncaughtException', err => console.log(err));
    ib.open(configuration ? { port: configuration } : null, (err, session) => {
        if (err) console.log(err);
        else {
            console.log('SDK entry point is "session".'.gray);
            console.log('Load securities with the $("AAPL stock") function.'.gray);
            console.log('Loaded securities are directly addressable (like AAPL.quote).'.gray);
            console.log('A list of loaded securities is stored in "symbols".'.gray);
            console.log("Type .exit to quit.".gray);
            console.log();
            
            session.on("disconnected", () => {
                console.log("Disconnected".red);
                process.exit(0);
            }).on("error", err => console.log(err));
            
            let env = new Environment(session);
            env.on("error", err => console.log(err));
            env.setup().terminal(repl.start("> "));
        }
    });
};

terminal(process.argv[2]);