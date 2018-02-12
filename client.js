var Session = require("./session"),
    Proxy = require("./service/proxy");

(window || exports).ib = {
    session: socket => new Session(new Proxy(socket)),
    constants: require("./constants"),
    studies: require("./model/studies")
};