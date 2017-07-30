var Session = require("../model/session"),
    Proxy = require("../service/proxy");

window.ib = {
    session: () => new Session(new Proxy(socket)),
    flags: require("../model/flags")
};