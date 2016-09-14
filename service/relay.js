"use strict";

function relay(service, socket) {
    let map = { };
    socket.on("request", request => {
        let req = service[request.fn](request.args);
        map[request.ref] = req.id;
        req.proxy(socket, request.ref).send();
    }).on("cancel", request => {
        service.dispatch.cancel(map[request.ref]);
        delete map[request.ref];
    })

    service.socket.on("connected", () => {
        socket.emit("connected", { 
            time: Date.create() 
        });    
    }).on("disconnected", () => {
        socket.emit("disconnected", { 
            time: Date.create() 
        });
    });

    socket.emit("connected", { 
        time: Date.create() 
    });
}

module.exports = relay;