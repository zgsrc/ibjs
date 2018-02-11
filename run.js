const fs = require("fs"),
      repl = require("repl"),
      chalk = require("chalk"),
      config = require("commander"),
      ibjs = require("./index"),
      mock = require("./service/mock");

config.version('0.13.0')
    .usage('[options] [files]')
    .option('-h, --host <host>', 'Specifies the host', 'localhost')
    .option('-p, --port <port>', 'Specifies the port (otherwise IB gateway default port)', parseInt, 4001)
    .option('--paper', 'Uses the IB gateway default paper trading port', 4002)
    .option('--tws', 'Uses the TWS default port', 7496)
    .option('-t, --timeout <millis>', 'Specifies the connection timeout', parseInt, 2500)
    .option('-i, --input <file>', 'Mock events from trace file')
    .option('-o, --output [file]', 'Record events with optional file name')
    .option('-r, --repl', 'Terminal interface', false)
    .parse(process.argv);

if (config.paper) config.port = config.paper;
else if (config.tws) config.port = config.tws;
delete config.paper;
delete config.tws;

if (config.output) {
    let file = config.output;
    if (Object.isBoolean(file)) {
        file = (new Date()).getTime() + ".log";
    }

    config.trace = (name, data) => {
        let msg = (new Date()).getTime() + "|" + name + "|" + JSON.stringify(data) + "\n";
        fs.appendFile(file, msg, err => err ? console.error(err) : null);
    };
}

if (config.input) {
    config.ib = new Mock();
    delete config.host;
    delete config.port;
}

console.log("Connecting...");
ibjs.session(config).then(async session => {
    session.on("error", console.error).on("disconnected", () => console.log("Disconnected"));
    
    let scope = await session.scope();
    let context = scope.context();
    console.log(await context.evaluate("return account.balances"))
    
    
}).catch(err => {
    console.error(err.message);
    process.exit(1);
});

if (config.input) {
    config.ib.replay(config.input, config.inputSpeed || 1);
}





return;


let files = config.args;
context.session = session;
if (files && files.length) {
    files.map(async file => {
        console.log("Loading module " + file);
        await require(file)(context);
    }).reduce((promise, func) =>
        promise.then(result => func().then(Array.prototype.concat.bind(result))),
        Promise.resolve([])
    ).then(() => {
        console.log("All modules loaded successfully.");
        if (config.repl) startTerminal(context);
    }).catch(console.error);
}
else if (config.repl) startTerminal(context);

function startTerminal(context) {
    console.log("Starting REPL...\n");
    
    let terminal = repl.start({ 
        prompt: "> ", 
        ignoreUndefined: true, 
        useGlobal: true 
    });
    
    Object.assign(terminal.context, context);

    terminal.defineCommand('stock', function(localSymbol) {
        terminal.clearBufferedCommand();
        context.session.contract(localSymbol + " stock").then(contract => {
            terminal.context[contract.summary.localSymbol] = contract;
            console.log(chalk.gray("Contract stored in symbol " + contract.summary.localSymbol));
            terminal.displayPrompt();
        }).catch(err => {

        });
    });

    terminal.on("exit", () => context.session.close());
}

process.on('uncaughtException', console.error);