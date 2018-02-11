

function relay(service, socket) {
    let map = { };
    
    socket.on("command", command => {
        service[command.fn](...command.args);
    });
    
    socket.on("request", request => {
        request.args = request.args || [ ];
        let req = service[request.fn](...request.args);
        map[request.ref] = req.id;
        req.proxy(socket, request.ref).send();
    }).on("cancel", request => {
        service.dispatch.cancel(map[request.ref]);
        delete map[request.ref];
    });

    let onConnected = () => socket.emit("connected", { time: Date.create() }),
        onDisconnected = () => socket.emit("disconnected", { time: Date.create() });
    
    service.socket
        .on("connected", onConnected)
        .on("disconnected", onDisconnected);

    socket.on("disconnect", () => { 
        Object.values(map).forEach(id => service.dispatch.cancel(id));
        map = null;
        
        service.socket.removeListener("connected", onConnected);
        service.socket.removeListener("disconnected", onDisconnected);
    });
    
    socket.on("error", err => {
        console.log(err);
    });
    
    socket.emit("connected", { time: Date.create() });
}

module.exports = relay;