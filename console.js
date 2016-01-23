require("sugar");
require("colors");

var commandLine = require('readline').createInterface({ input: process.stdin, output: process.stdout });
commandLine.setPrompt("> ".yellow);
commandLine.prompt();
commandLine.on('line', (input) => { 
    run(input.toString().trim().split(" ").map("trim").compact(true), () => { 
        commandLine.prompt(); 
    }); 
}).on('close', () => { 
    if (ib.connection) ib.connection.disconnect((err) => { process.exit(0); });
    else process.exit(0); 
});

function run(args, cb) {
    var cmd = args.first();
    if (commands[cmd]) commands[cmd](args.from(1), cb);
    else if (cmd == "exit" || cmd == "quit") commandLine.close();
    else {
        console.log(("Unrecognized command " + cmd).red);
        cb();
    }
}

function write(cb) {
    return function(err, data) {
        if (err) console.log(err);
        else console.log(data);
        cb();
    };
}

var ib = require("./index");
var commands = {
    connect: function(args, cb) {
        ib.connect(function(err, cxn) {
            if (err) console.log(err);
            else console.log(cxn.status.blue);
            cb();
        });
    },
    disconnect: function(args, cb) {
        ib.connection.disconnect(function(err) {
            if (err) console.log(err);
            else console.log(ib.connection.status.blue);
            cb();
        });
    },
    stock: function(args, cb) {
        var stock = ib.stock(args[0]);
        if (args[1]) {
            if (args[1] == "contract") {
                console.log(stock.contract());
                cb();        
            }
            else if (args[1] == "details") {
                stock.details(write(cb));
            }
            else if (args[1] == "report") {
                stock.report(args[2], write(cb));
            }
            else if (args[1] == "fundamentals") {
                stock.fundamentals(write(cb));
            }
            else if (args[1] == "chart") {
                stock.chart(write(cb));
            }
            else if (args[1] == "quote") {
                stock.quote(write(cb));
            }
            else {
                console.log("Unrecognized subcommand.".red);
                cb();
            }
        }
        else {
            console.log("Missing subcommand.".red);
            cb();
        }
    }
};