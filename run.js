const fs = require("fs"),
      json = file => JSON.parse(fs.readFileSync(file).toString()),
      program = require("commander"),
      ibjs = require("./index");

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
    .option("--orders [type]", "Specify session order processing", "passive")
    .option("--repl", "Terminal interface")
    .option("--http [port]", "Launch http subscription interface using port", parseInt)
    .option("--html <path>", "Configure static HTML path", parseInt)
    .option("--output [file]", "Record events with optional file name")
    .option("--symbols <file>", "Configure well known symbols")
    .option("--subscriptions <file>", "Configure initial subscriptions")
    .option("--global <path>", "Configure global path", "./global")
    .option("--module <path>", "Configure module path", "./module")
    .option("--hooks <file>", "Configure hooks")
    .action(options => ibjs.environment(filter(preprocess(options))));

program
    .command("init")
    .description('Initialize a new environment')
    .action(() => { 
        console.log("Setting up environment in " + process.cwd())
        try {
            fs.writeFileSync(process.cwd() + "/startup.js", fs.readFileSync(__dirname + "/example/startup.js").toString())
            fs.mkdirSync(process.cwd() + "/global")
            fs.mkdirSync(process.cwd() + "/module")
            console.log("Success! Configure startup.js to customize environment");
            console.log();
            process.exit(0);
        }
        catch(ex) {
            console.log("Failure!");
            console.log(ex);
            process.exit(1);
        }
    });

program
    .command("subscribe")
    .description('Connect to an IBJS node')
    .option("--host <host>", "Specifies the host", "localhost")
    .option("--port <port>", "Specifies the port", parseInt, 8080)
    .option("--timeout <millis>", "Specifies the connection timeout", parseInt, 2500)
    .option("--repl", "Terminal interface")
    .option("--http [port]", "Launch http subscription interface using port", parseInt)
    .action(options => config = filter(options));

program.parse(process.argv);