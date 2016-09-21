var Session = require("./model/session"),
    Proxy = require("./service/proxy");

function connect(socket) {
    return new Session(new Proxy(socket));
}