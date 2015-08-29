require("sugar");

var async = require("async"),
    IB = require("./lib/connection"),
    cxn = IB.connect({ verbose: false });

exports.connection = cxn;

process.on('beforeExit', function(code) {
    cxn.disconnect();
});

var constants = require("./lib/constants");
for (var c in constants) {
    exports[c] = constants[c];
}

var Security = require("./lib/security").Security,
    Accounts = require("./lib/accounts").Accounts,
    Order = require("./lib/order").Order,
    Scanner = require("./lib/scanner").Scanner;

exports.stock = function(symbol, exchange, currency) {
    return new Security(cxn, cxn.contract.stock(symbol, exchange, currency));
};

exports.option = function(symbol, expiry, strike, right, exchange, currency) {
    return new Security(cxn, cxn.contract.option(symbol, expiry, strike, right, exchange, currency));
};

exports.currency = function(symbol, currency) {
    return new Security(cxn, cxn.contract.forex(symbol, currency));
};

exports.future = function(symbol, expiry, currency) {
    return new Security(cxn, cxn.contract.future(symbol, expiry, currency));
};

exports.accounts = function() {
    return new Accounts(cxn);
};

exports.cancelAllOrders = function() {
    cxn.globalCancel();
};

exports.scanner = function() {
    return new Scanner();
};

exports.scanners = function(cb) {
    cxn.scanners(cb);
};