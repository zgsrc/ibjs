var chai = require('chai');

var expect = chai.expect;
chai.should();

describe('IB Connection', function() {
    var cxn = require('../lib/connection');
    
    it('Connects to a running IB API instance', function(done) {    
        var connection = cxn.connect({ }, function(err, status) {
            expect(err).to.be.a("null");
            status.should.equal("connected");
            done();
            
            it('Can fetch the current server time', function(done) {
                connection.currentTime(function(err, time) {
                    expect(err).to.be.a("null");
                    time.should.be.a("number");
                    done();
                });
            });
        });
    });
});