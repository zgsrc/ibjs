var Session = require("../model/session"),
    Proxy = require("../service/proxy");

window.connect = socket => new Session(new Proxy(socket));