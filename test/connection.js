require("sugar");

var chai = require('chai'),
    expect = chai.expect;

chai.should();

describe('IB Connection', function() {
    var ib = require('../lib/connection'),
        constants = require("../lib/constants"),
        connection = null;
    
    ib.client = 100;
    
    it('can connect to IB API interface', function(done) {    
        connection = new ib.Connection();
        connection.connect(function(err, status) {
            expect(err).to.be.null;
            status.should.equal("connected");
            done();
        });
    });
    
    it('can fetch the current server time', function(done) {
        connection.currentTime(function(err, time) {
            expect(err).to.be.null;
            time.should.be.a("number");
            done();
        });
    });
    
    it('can disconnect', function(done) {
        connection.disconnect(function(err, status) {
            expect(err).to.be.null;
            status.should.equal("disconnected");
            done();
        });
    });
    
    it('can disconnect twice', function(done) {
        connection.disconnect(function(err, status) {
            expect(err).to.be.null;
            status.should.equal("disconnected");
            done();
        });
    });
    
    it('can reconnect', function(done) {
        connection.connect(function(err, status) {
            expect(err).to.be.null;
            status.should.equal("connected");
            done();
        });
    });
    
    it('can connect twice', function(done) {
        connection.connect(function(err, status) {
            expect(err).to.be.null;
            status.should.equal("connected");
            done();
        });
    });
    
    it('can still fetch the current server time', function(done) {
        connection.currentTime(function(err, time) {
            expect(err).to.be.null;
            time.should.be.a("number");
            done();
        });
    });
    
    var contract = null;
    it('can create contract', function() {
        contract = connection.contract.stock("AAPL");
        contract.should.be.ok;
        contract.symbol.should.equal("AAPL");
    });
    
    it('can get contract details', function(done) {
        connection.details(contract, function(err, details) {
            expect(err).to.be.null;
            details.should.be.ok;
            done();
        });
    });
    
    it('can get fundamentals', function(done) {
        connection.fundamentals(contract, constants.REPORT.snapshot, function(err, report) {
            expect(err).to.be.null;
            report.should.be.an("object");
            done();
        });
    });
    
    it('can get historical pricing', function(done) {
        this.timeout(10000);
        connection.historicals(contract, { }, function(err, bar) {
            expect(err).to.be.null;
            bar.should.be.an("array");
            done();
        });
    });
    
    it('can get a ticker quote', function(done) {
        connection.ticker(contract, null, function(err, quote, cancel) {
            expect(err).to.be.null;
            quote.should.be.an("object");
            cancel.should.be.a("function");
            
            cancel();
            done();
        });
    });
    
    it('can get a snapshot quote', function(done) {
        connection.snapshot(contract, function(err, quote, cancel) {
            expect(err).to.be.null;
            quote.should.be.an("object");
            cancel.should.be.a("function");
            
            cancel();
            done();
        });
    });
    
    it('can get real-time bars', function(done) {
        connection.bar(contract, { }, function(err, bar, cancel) {
            expect(err).to.be.null;
            bar.should.be.an("object");
            cancel.should.be.a("function");
            
            cancel();
            done();
        });
    });
    
    it.skip('can get level 2 quotes', function(done) {
        connection.marketDepth(connection.contract.stock("SPY", "ISLAND"), 10, function(err, book, cancel) {
            expect(err).to.be.null;
            book.should.be.an("object");
            cancel.should.be.a("function");
            
            cancel();
            done();
        });
    });
    
    it('can set market data type', function() {
        connection.setMarketDataType(0);
    });
    
    it('can fetch scanner parameters', function(done) {
        connection.scannerParameters(function(err, scanners) {
            expect(err).to.be.null;
            done();
        });
    });
    
    it('can set server log level', function() {
        connection.setServerLogLevel(1);
    });
    
    it('can get account summary information', function(done) {
        connection.summary(function(err, data, cancel) {
            expect(err).to.be.null;
            data.should.be.an("array");
            cancel();
            done();
        });
    });
    
    it('can get trade executions', function(done) {
        connection.executions(function(err, data) {
            expect(err).to.be.null;
            data.should.be.an("array");
            done();
        });
    });
    
    it('should have no remaining callbacks registered', function() {
        Object.keys(connection.callbacks).length.should.equal(0);
    });
    
    after(function(done) {
        connection.disconnect(function() {
            done();
        });
    });
});