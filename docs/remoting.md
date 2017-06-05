## Remoting

`Service` instances also supports a mechanism to relay streaming responses to proxy instances of the SDK, enabling a distributed/networked system architecture.  The `relay` method takes a `EventEmitter` compatible (i.e. implements `emit` and `on`) object and relays `data`, `error`, and `end` events.  A `Proxy` is a `Service`-compatible object that can be instantiated remotely and use a similar `EventEmitter` compatible transport (e.g. [socket.io](http://socket.io/)) to communicate with a `Relay` server.

__Server__
```javascript
let app = require('http').createServer(handler),
    session = sdk.connect({ host: "localhost", port: 4001 }),
    io = require('socket.io')(app);
    
session.service.socket.on("connected", () => {
    session.service.relay(io);
    app.listen(8080);
}).connect();
```

__Client__
```javascript
var io = require('socket.io-client')('http://localhost:8080'),
    session = sdk.proxy(io);
    
session.service.relay(socket);
```