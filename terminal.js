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
            console.log('SDK entry point is "session".'.gray);
            console.log('Load securities with the $("AAPL stock") function.'.gray);
            console.log('Loaded securities are directly addressable (like AAPL.quote).'.gray);
            console.log('A list of loaded securities is stored in "symbols".'.gray);
            console.log("Type .exit to quit.".gray);

            let cmd = repl.start('> ');
            cmd.context.session = session;
            cmd.context.symbols = [ ];
            
            cmd.context.$ = text => {
                session.securities(text, (err, list) => {
                    if (err) printError(err);
                    else {
                        cmd.context.symbols.append(list.map(l => l.contract.summary.localSymbol)).unique().sort();
                        list.forEach(l => {
                            if (cmd.context[l.contract.summary.localSymbol] == null) {
                                cmd.context[l.contract.summary.localSymbol] = l;
                            }
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