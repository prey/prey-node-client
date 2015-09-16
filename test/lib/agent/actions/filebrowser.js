var should = require('should'),
    sinon = require('sinon'),
    http = require('http'),
    StringDecoder = require('string_decoder').StringDecoder,
    helpers = require('./../../../helpers'),
    fb = helpers.load('actions/filebrowser');

var decoder = new StringDecoder('utf-8');

describe('on start', function () {
  var emitter,
      tunnelUrl;

  before(function(done) {
    fb.start({host: 'http://prey.io:1443'}, function(err, em) {
      emitter = em;
      emitter.on('filebrowser_opened', function(url) {
        tunnelUrl = url;
        done();
      })
    });
  });

  after(function() {
    fb.stop();
  });

  it('brings up server that reply with status 200', function(done) {
    http.get(tunnelUrl, function(res) {
      res.statusCode.should.equal(200);
      done();
    });
  });

  it('emitts an event with the tunnel url', function() {
    // Matches http://sub.domain.com:1234
    var urlRegex = /http:\/\/[a-zA-Z0-9]*.[a-zA-Z0-9]*.[a-zA-Z0-9]*:[0-9]{4,5}/;

    tunnelUrl.should.not.be.empty();
    tunnelUrl.should.match(urlRegex);
  });
});
