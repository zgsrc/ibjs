require("sugar").extend();

const dop = require("dop");

let root = (window || module.exports)
    
root.subscribe = async () => {
    let server = dop.connect({ url: "ws://localhost:4444" }) // Native WebSockets using this url: 'ws://localhost:4444'
    let model = await server.subscribe()
    
    console.log(model);
    
    root.remote = server;
    root.model = model;
    
    return model;
}