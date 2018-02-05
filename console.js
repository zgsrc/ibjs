const fs = require("fs"),
      repl = require("repl"),
      config = require('commander'),
      sdk = require("./index"),
      mock = require("./service/mock"),
      integer = val => parseInt(val);

config.version('0.1.0')
    .usage('[options] [files]')
    .option('-h, --host <host>', 'Specifies the host', 'localhost')
    .option('-p, --port <port>', 'Specifies the port (otherwise IB gateway default port)', integer, 4001)
    .option('--paper', 'Uses the IB gateway default paper trading port', 4002)
    .option('--tws', 'Uses the TWS default port', 7496)
    .option('-t, --timeout <millis>', 'Specifies the connection timeout', integer, 2500)
    .option('-i, --input <file>', 'Mock events from trace file')
    .option('-o, --output [file]', 'Record events with optional file name')
    .option('-r, --repl', 'Terminal interface', false)
    .parse(process.argv);

if (config.output) {
    let file = config.output;
    if (Object.isBoolean(file)) {
        file = (new Date()).getTime() + ".log";
    }

    config.trace = (name, data) => {
        let msg = (new Date()).getTime() + "|" + name + "|" + JSON.stringify(data) + "\n";
        fs.appendFile(file, msg, err => err ? console.log(err) : null);
    };
}

if (config.input) {
    config.ib = new Mock();
    delete config.host;
    delete config.port;
}

sdk.start(config).then(session => {
    session.on("error", console.log)
        .on("connected", () => console.log("Connected"))
        .on("disconnected", () => console.log("Disconnected"));
    
    if (config.repl) {
        let terminal = repl.start({
            prompt: "> ",
            ignoreUndefined: true
        });
        
        terminal.context.session = session;
        terminal.context.container = sdk.container;
        terminal.on("exit", () => session.close());
    }
    
    let files = config.args;
    if (files) {
        files.forEach(file => require(file)(context));
    }
}).catch(console.log);

if (config.input) {
    config.ib.replay(config.input);
}

process.on('uncaughtException', console.log);