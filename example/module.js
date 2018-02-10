export default async function(context) {
    
    await context.include("./some-file.js");
    
    let $ = context.session;
    
    let AAPL = await $.contract("AAPL stock");
    
}


export default async function(context) {
    
    let _ = context,
        include = _.include,
        info = _.info,
        warn = _.warn,
        error = _.error;
    
    let ib = _.session,
        connectivity = ib.connectivity,
        bulletins = ib.bulletins,
        orders = ib.orders,
        $ = ib.contract,
        $$ = ib.contracts,
        $$$ = ib.combo;
    
    Object.keys(_.constants).forEach(key => {
        let key = _.constants[key];
    })
    
    
    
    await include("./some-file.js");
    
    let AAPL = await $("AAPL stock");
    
}