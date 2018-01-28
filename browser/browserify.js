var Session = require("../model/session"),
    Proxy = require("../service/proxy");

window.ib = {
    session: socket => new Session(new Proxy(socket)),
    flags: require("../model/flags"),
    studies: require("../model/marketdata/studies")
};