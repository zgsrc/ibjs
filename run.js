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

const context = { 
    constants: ibjs.constants,
    info: msg => {
        console.log(chalk.gray(msg));
    },
    warn: (msg) => {
        console.log(chalk.yellow(JSON.stringify(msg)));
    },
    error: (err) => {
        if (err.stack) console.log(chalk.red(err.stack));
        else console.log(chalk.red(err.message || err));
    },
    include: async (file) => {
        await require(file)(context);
    }
};

if (config.output) {
    let file = config.output;
    if (Object.isBoolean(file)) {
        file = (new Date()).getTime() + ".log";
    }

    config.trace = (name, data) => {
        let msg = (new Date()).getTime() + "|" + name + "|" + JSON.stringify(data) + "\n";
        fs.appendFile(file, msg, err => err ? context.error(err) : null);
    };
}

if (config.input) {
    config.ib = new Mock();
    delete config.host;
    delete config.port;
}

context.info("Connecting...");
ibjs.session(config).then(session => {
    context.info("Connected");
    
    session.on("error", context.error)
           .on("connectivity", context.warn)
           .on("disconnected", () => context.info("Disconnected"));
    
    let files = config.args;
    context.session = session;
    if (files && files.length) {
        files.map(async file => {
            context.info("Loading module " + file);
            await require(file)(context);
        }).reduce((promise, func) =>
            promise.then(result => func().then(Array.prototype.concat.bind(result))),
            Promise.resolve([])
        ).then(() => {
            context.info("All modules loaded successfully.");
            if (config.repl) startTerminal(context);
        }).catch(context.error);
    }
    else if (config.repl) startTerminal(context);
}).catch(err => {
    context.error(err.message, true);
    process.exit(1);
});

if (config.input) {
    config.ib.replay(config.input);
}

function startTerminal(context) {
    context.info("Starting REPL...\n");
    
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

process.on('uncaughtException', context.error);