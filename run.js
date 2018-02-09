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
    ibjs: ibjs,
    info: msg => console.log(chalk.gray(msg)),
    warn: msg => console.log(chalk.yellow(msg.message || msg)),
    error: (err, nobreak) => {
        if (!nobreak) console.log();
        if (err.stack) console.log(chalk.red(err.stack));
        else console.log(chalk.red(err.message || err));
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
ibjs.start(config).then(session => {
    session.on("error", context.error)
           .on("connectivity", context.warn)
           .on("disconnected", () => context.info("Disconnected"));
    
    context.info("Ready");
    
    let files = config.args;
    context.session = session;
    if (files && files.length) {
        Promise.all(files.map(async file => {
            context.info("Loading module " + file);
            await require(file)(context);
        })).then(() => {
            context.info("All modules loaded successfully.");
            
        }).catch(context.error);
    }
    
    if (config.repl) {
        context.info("Starting REPL...\n");
        let terminal = repl.start({ prompt: "> ", ignoreUndefined: true });
        Object.assign(terminal.context, context);
        terminal.on("exit", () => session.close());
    }
}).catch(err => {
    context.error(err.message, true);
    process.exit(1);
});

if (config.input) {
    config.ib.replay(config.input);
}

process.on('uncaughtException', context.error);