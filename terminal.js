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
    console.log("Starting...".green);
    let session = ib.session(configuration).on("connected", () => {
        console.log("Connected.".green);
    }).on("error", err => {
        printError(err);
    }).on("ready", () => {
        console.log("Ready.".green);
        console.log("Use the 'session' variable to access the session. Type .exit to quit.".gray);
        
        let cmd = repl.start('> ');
        cmd.context.session = session;
        cmd.on("exit", () => {
            console.log("Disconnecting...".gray);
            session.service.socket.disconnect();
        });
    }).on("disconnected", () => {
        console.log("Disconnected".red)
        process.exit(0);
    });
};

terminal();