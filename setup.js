const { session } = require("./index"),
      { processCommandLineArgs, preprocess } = require("./program"),
      repl = require("repl"),
      { observe, computed, dispose } = require("hyperactiv"),
      { Observable, Computable } = require("hyperactiv/mixins"),
      Context = require("./lib/context"),
      symbol = require("./lib/symbol"),
      ObservableObject = Computable(Observable(Object))

async function environment(config, hooks) {
    if (config == null) config = processCommandLineArgs();
    else if (Object.isString(config)) {
        if (config.toLowerCase().endsWith(".json")) config = json(config);
        else if (config.toLowerCase().endsWith(".js")) config = require(config);
        else throw new Error("Unrecognized config " + config);
        config = preprocess(config);
    }
    
    if (hooks) {
        if (Object.isString(hooks)) config.hooks = require(hooks);
        else config.hooks = hooks;
    }
    
    config.hooks = config.hooks || { };
    if (config.hooks.config) await config.hooks.config(config);
    
    let connection;
    if (config.verbose) console.log("Connecting...");
    session(config).then(async session => {
        if (config.verbose) console.log("Session established");
        session.on("error", config.hooks.error || console.error);
        
        if (config.verbose) console.log("Opening subscriptions...");
        let subscriptions = await session.subscribe(config.subscriptions);
        
        if (config.http) {
            if (config.verbose) console.log(`Starting HTTP server on port ${Number.isInteger(config.http) ? config.http : 8080}...`);
            subscriptions = require("./server")(subscriptions, config.http);
        }
        else {
            subscriptions = Object.assign(new ObservableObject({ }), subscriptions);
        }

        let context = new Context(subscriptions, require("./constants"), { observe, computed, dispose, Observable, Computable }, global);
        context.resolvers.push(name => session.quote(name));
        if (config.hooks.context) await config.hooks.context(context);
        
        if (config.repl) {
            if (config.verbose) console.log("Starting REPL...\n");
            let terminal = repl.start({ prompt: "> ", eval: context.replEval });
            terminal.on("exit", () => session.close(true));
        }
        else if (config.verbose) console.log("Ready.");
        
        process.on("exit", config.hooks.exit || (() => session.close()));
        process.on("SIGINT", config.hooks.sigint || (() => session.close()));
        process.on("message", msg => msg == "shutdown" ? session.close() : null);
        if (Object.isFunction(process.send)) process.send("ready");
        if (config.hooks.ready) config.hooks.ready(session, context);
    }).catch(config.hooks.error || (err => {
        console.error(err);
        process.exit(1);
    }));

    if (config.input) {
        config.ib.replay(config.input, config.inputSpeed || 1, config.hooks.afterReplay);
    }
    
    process.on("warning", config.hooks.warning || config.hooks.error || console.warn);
    process.on("uncaughtException", config.hooks.error || console.error);
}

module.exports = environment;