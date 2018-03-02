require("ibjs").environment({
    
    /* Auto set client id */
    id: -1,
    /* Think out loud */
	verbose: true,
    /* Host of IB API */
	host: "localhost",
    /* Port of IB API */
	port: 4001,
    /* Connection timeout */
	timeout: 2500,
    
    /* Session order processing ("all", "local", "passive") */
    orders: "passive",
    
    /* REPL interface */
    repl: true,
    /* HTTP interface/port */
	http: 8080,
    /* Save raw API events to file */
	output: true,
    
    /* Well known symbols */
	symbols: { },
    
    /* Initial subscriptions */
	subscriptions: {
        /* System errors, bulletins, and fyi's */
        system: true,
        /* Account details (bool for default or specify id) */
        account: true,
        /* Summaries of all accounts */
        accounts: false,
        /* Summaries of all positions */
        positions: false,
        /* Trade history (default today or specify options object) */
        trades: true,
        /* Pending and saved orders */
        orders: true,
        /* Display groups used in TWS */
        displayGroups: false,
        /* Contract descriptions of quotes to load */
        quotes: [],
        /* Automatically stream quotes (bool or "all" for depth and candlesticks) */
        autoStreamQuotes: false
    },
    
    /* Global code */
    globals: [ ],
    /* Modules whose scope is encapsulated */
    modules: [ ],
    /* Lifecycle hooks */
	hooks: {
        async init(config) {
            /* Modify config after it has been loaded */
        },    
        async setup(session, context) {
            /* Modify context after it has been setup */
        },
        async ready(session, context) {
            /* Called after all initialization has completed */
        },
        async load(session, context) {
            /* Called after all globals and modules are loaded */
        },
        afterReplay(session, context) { 
            /* Called after all events have been replayed from a file */
        },
        sigint(session, context) { 
            /* Called if the process receives as SIGINT message */
            session.close()
        },
        exit(session, context) {
            /* Called if the process receives an 'exit' events from the terminal */
            session.close()
        },
        warning(msg) {
            /* Handles warnings */
            console.warn(msg)
        },
        error(err) {
            /* Handles errors */
            console.error(err)
        }
    }
    
})