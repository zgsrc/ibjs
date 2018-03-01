const fs = require("fs"),
      json = file => JSON.parse(fs.readFileSync(file).toString()),
      program = require("commander");

let config = null;

function filter(config) {
    let command = config._name, keys = Object.keys(config).filter(k => k[0] != '_' && typeof config[k] !== 'object');
    config = Object.select(config, keys);
    if (command && !config.command) {
        config.command = command;
    }
    
    return config;
}

function preprocess(config) {
    if (config.paper) {
        config.port = config.paper;
        delete config.paper;
    }
    else if (config.tws) {
        config.port = config.tws;
        delete config.tws;
    }
    
    if (config.symbols && typeof config.symbols === 'string') {
        if (config.symbols.endsWith(".json")) config.symbols = json(process.cwd() + "/" + config.symbols);
        else config.symbols = require(process.cwd() + "/" + config.symbols);
    }
    
    if (config.subscriptions && typeof config.subscriptions === 'string') {
        if (config.subscriptions.endsWith(".json")) config.subscriptions = json(process.cwd() + "/" + config.subscriptions);
        else config.subscriptions = require(process.cwd() + "/" + config.subscriptions);
    }
    
    if (config.hooks && typeof config.hooks === 'string') {
        config.hooks = require(process.cwd() + "/" + config.hooks);
    }
    
    if (config.output) {
        let file = config.output;
        if (Object.isBoolean(file)) {
            file = (new Date()).getTime() + ".log";
        }

        config.trace = (name, data) => {
            let msg = (new Date()).getTime() + "|" + name + "|" + JSON.stringify(data) + "\n";
            fs.appendFile(file, msg, err => err ? config.hooks.traceError(err) || console.error(err) : null);
        };
    }
    
    return config;
}

program.version("0.15.0")
    .usage("command [options]");

program
    .command("connect")
    .description('Connect to TWS or IB Gateway software and setup container')
    .option("--verbose", "Think out loud")
    .option("--id <id>", "Specifies the client id", parseInt, -1)
    .option("--host <host>", "Specifies the host", "localhost")
    .option("--port <port>", "Specifies the port (otherwise IB gateway default port)", parseInt, 4001)
    .option("--paper", "Uses the IB gateway default paper trading port", 4002)
    .option("--tws", "Uses the TWS default port", 7496)
    .option("--timeout <millis>", "Specifies the connection timeout", parseInt, 2500)
    .option("--symbols <file>", "Configure well known symbols")
    .option("--subscriptions <file>", "Configure initial subscriptions")
    .option("--hooks <file>", "Configure hooks")
    .option("--repl", "Terminal interface")
    .option("--http [port]", "Launch http subscription interface using port", parseInt)
    .option("--output [file]", "Record events with optional file name")
    .action(options => config = filter(preprocess(options)));

program
    .command("subscribe")
    .description('Connect to an IBJS node')
    .option("--host <host>", "Specifies the host", "localhost")
    .option("--port <port>", "Specifies the port", parseInt, 8080)
    .option("--timeout <millis>", "Specifies the connection timeout", parseInt, 2500)
    .option("--repl", "Terminal interface")
    .option("--http [port]", "Launch http subscription interface using port", parseInt)
    .action(options => config = filter(options));

program
    .command("init")
    .description('Setup a primary environment')
    .action(() => { 
        console.log("Setting up environment in " + process.cwd())
    
        try {
            fs.writeFileSync("./index.js", fs.readFileSync(__dirname + "/defaults/index.js").toString())
            fs.writeFileSync("./config.json", fs.readFileSync(__dirname + "/defaults/config.json").toString())
            fs.writeFileSync("./symbols.json", fs.readFileSync(__dirname + "/defaults/symbols.json").toString())
            fs.writeFileSync("./subscriptions.json", fs.readFileSync(__dirname + "/defaults/subscriptions.json").toString())
            fs.writeFileSync("./hooks.js", fs.readFileSync(__dirname + "/defaults/hooks.js").toString());
        }
        catch(ex) {
            console.log("Failure!");
            console.log(ex);
            process.exit(1);
        }
    
        console.log("Success!")
        console.log("Configure config.json to customize environment");
        console.log();
        process.exit(0);
    });

program
    .command("init-client")
    .description('Setup a secondary environment')
    .action(() => { 
        console.log("Setting up environment in " + process.cwd())
    
        try {
            fs.writeFileSync("./config.json", JSON.stringify({
                verbose: true,
                host: "localhost",
                port: 8080,
                timeout: 2500,
                hooks: "hooks.js",
                repl: true,
                http: 8080,
                output: true
            }, null, '\t'))

            fs.writeFileSync("./hooks.js", fs.readFileSync(__dirname + "/hooks.js").toString());
        }
        catch(ex) {
            console.log("Failure!");
            console.log(ex);
            process.exit(1);
        }
    
        console.log("Success!")
        console.log("Configure config.json to customize environment");
        console.log();
        process.exit(0);
    });

program
    .command("run")
    .description('Setup container using a local "config.json" file')
    .option("--file [file]", "Specify config file", "config.json")
    .action(options => config = preprocess(json(options.file)));

function processCommandLineArgs() {
    try {
        program.parse(process.argv);
        return config;
    }
    catch (ex) {
        console.error(ex.message);
        process.exit(1);
    }
}

module.exports = { processCommandLineArgs, preprocess };