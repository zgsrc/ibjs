"use strict";

require("sugar");

const repl = require("repl"),
      colors = require("colors"),
      sdk = require("./index");

let port = process.argv[2] || 4001;

console.log("Connecting...".gray);
sdk.connect({ port: port }, function(err, cxn) {
    if (err) {
        console.log(("Error: " + err.message).red);
    }
    else {
        console.log("Connected".green);
        console.log("Use the ib variable to access interface. Type .exit to quit.".gray);
        
        const ib = new sdk.Interface(cxn),
              cmd = repl.start('> ');
        
        cmd.context.ib = ib;
        cmd.on('exit', () => {
            console.log("Disconnecting...".gray);
            ib.connection.disconnect(function() {
                console.log("Disconnected".red);
                process.exit(0);  
            });
        });
    }
});