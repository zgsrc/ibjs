var Session = require("../model/session"),
    Proxy = require("../service/proxy"),
    config = require("../model/config");

window.session = function(socket) {
    return new Session(new Proxy(socket));
};

window.config = config;