require("sugar");
require("colors");

var async = require("async"),
    ib = require("./index");

process.stdout.write("> ".yellow);
process.stdin.on("readable", function() {
    var input = process.stdin.read();
    if (input) {
        var args = input.toString().trim().split(" ").map("trim").compact(true);
        run(args, () => { process.stdout.write("> ".yellow); });
    } 
});

function run(args, cb) {
    var cmd = args.first();
    if (cmd == "connect") {
        ib.connect(function(err, cxn) {
            if (err) console.log(err);
            else console.log(cxn.status.blue);
            cb();
        });
    }
    else if (cmd == "disconnect") {
        ib.connection.disconnect(function(err) {
            if (err) console.log(err);
            else console.log(ib.connection.status.blue);
            cb();
        });
    }
    else if (cmd == "account") {
        var accounts = ib.accounts();
        cb();
    }
    else if (cmd == "stock") {
        var stock = ib.stock(args[1]);
        if (args[2]) {
            if (args[2] == "contract") {
                console.log(stock.contract());
                cb();        
            }
            else if (args[2] == "details") {
                stock.details(function(err, details) {
                    if (err) console.log(err);
                    else console.log(details);
                    cb();
                });
            }
        }
        
    }
    else if (cmd == "exit" || cmd == "quit") {
        ib.connection.disconnect(function() {
            process.exit();
        });
    }
    else {
        console.log("Unrecognized command " + cmd);
        cb();
    }
}