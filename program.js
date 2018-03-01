const fs = require("fs"),
      json = file => JSON.parse(fs.readFileSync(file).toString()),
      program = require("commander");

let config = null;

program.version("0.15.0")
    .usage("command [options]");

program
    .command("init")
    .description('Setup a local environment')
    .action(() => { 
        console.log("Setting up environment in " + process.cwd())
        fs.writeFileSync("./config.json", JSON.stringify({
            verbose: true,
            host: "localhost",
            port: 4001,
            timeout: 2500,
            symbols: "symbols.json",
            subscriptions: {
                session: true,
                system: true,
                account: true,
                accounts: false,
                positions: false,
                trades: true,
                orders: true,
                displayGroups: false,
                quotes: [ ] || { },
                autoStreamQuotes: false
            },
            repl: true,
            http: 8080,
            output: true
        }, null, '\t'))
    
        fs.writeFileSync("./symbols.json", JSON.stringify({ "AAPL": "AAPL stock on SMART" }, null, '\t'));
        console.log("Success!")
        console.log("Configure config.json and symbols.json to customize environment");
        console.log();
        process.exit(0);
    });

program
    .command("run")
    .description('Setup environment with a "config.json" file')
    .option("--file [file]", "Specify config file", "config.json")
    .action(options => config = preprocess(json(options.file)));

program
    .command("start")
    .description('Connect to TWS or IB Gateway software')
    .option("--verbose", "Think out loud")
    .option("--host <host>", "Specifies the host", "localhost")
    .option("--port <port>", "Specifies the port (otherwise IB gateway default port)", parseInt, 4001)
    .option("--paper", "Uses the IB gateway default paper trading port", 4002)
    .option("--tws", "Uses the TWS default port", 7496)
    .option("--timeout <millis>", "Specifies the connection timeout", parseInt, 2500)
    .option("--symbols <file>", "Configure well known symbols", json)
    .option("--subscriptions <file>", "Configure initial subscriptions", json)
    .option("--repl", "Terminal interface")
    .option("--http [port]", "Launch server using port", parseInt)
    .option("--output [file]", "Record events with optional file name")
    .action(options => config = preprocess(options));

function preprocess(config) {
    if (config.paper) {
        config.port = config.paper;
        delete config.paper;
    }
    
    else if (config.tws) {
        config.port = config.tws;
        delete config.tws;
    }
    
    if (config.scope) {
        config.scope = json(config.scope);
    }
    
    config.files = config.args;
    delete config.args;
    
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
    
    if (config.resolvers) {
        if (!Array.isArray(config.resolvers)) config.resolvers = [ config.resolvers ];
        config.resolvers = config.resolvers.map(resolver => {
            if (Object.isString(resolver)) return require(resolver);
            else return resolver;
        });
    }
    
    if (config.hooks && Object.isString(config.hooks)) {
        config.hooks = require(config.hooks);
    }
    
    return config;
}

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