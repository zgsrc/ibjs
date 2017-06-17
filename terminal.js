"use strict";

const repl = require("repl"),
      colors = require("colors"),
      ib = require("./index");

function printError(err, prefix) {
    if (err) {
        console.log(err.message.red);
        if (err.errors) {
            err.errors.each(e => {
                console.log((" - " + err.message).gray)
                if (e.errors) {
                    e.errors.each(x => {
                        console.log(("    - " + x.message).gray);
                    });
                }
            });
        }
    }
}

const terminal = exports.terminal = configuration => {
    process.on('uncaughtException', err => printError(err));
    
    if (configuration) {
        configuration = { port: configuration };
    }
    
    ib.open(configuration, (err, session) => {
        if (err) printError(err);
        else {
            console.log("Use the 'session' variable to access the session. Type .exit to quit.".gray);

            let cmd = repl.start('> ');
            cmd.context.session = session;
            cmd.context.$ = text => {
                session.securities(text, (err, list) => {
                    if (err) printError(err);
                    else {
                        list.map(l => {
                            cmd.context.$[l.contract.summary.localSymbol] = l;
                            console.log(l.contract.summary.localSymbol);
                        });
                    }
                });
            };
            
            cmd.on("exit", () => session.close());
            
            session.on("disconnected", () => {
                console.log("Disconnected".red);
                process.exit(0);
            });
        }
    });
};

terminal(process.argv[2]);