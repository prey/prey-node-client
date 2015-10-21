var assert = require("assert"),
    sinon = require("sinon"),
    should = require("should"),
    api = require('../../api'),
    request = require('../../api/request'),
    getter = api.devices.get,
    keys = api.keys,
    long_polling = require('..'),
    hooks = require('../../../../hooks'),
    common = require('../../../../../common'),
    EventEmitter = require('events').EventEmitter,
    test_server = require('./test_server');


var server_port = 13375,
    prey_cfg = {
      host: 'localhost:' + server_port,
      protocol: 'http',
      api_key: 'asdfzomgbbq',
      device_key: 'notkey'
    };

request.use(prey_cfg);

var common_obj = {
  hooks: hooks,
  config: common.config,
  logger: common.logger
};

var spy,
    keys_stub,
    server;

function load(cb) {
  spy.reset();

  long_polling.load.call(common_obj, function(err, em) {
    cb(err, em, spy);
  });
}

function unload(cb) {
  long_polling.unload.call(common_obj, function(unloaded) {
    if (cb) return cb(unloaded);
  });
}

function server_up(cb) {
  server = test_server.open(server_port, cb);
}

function server_down(cb) {
  if (server) {
    test_server.close(cb);
    server = null;
  }
}

describe('long-polling', function() {

  before(function() {
    spy = sinon.spy(getter, 'commands');
    keys_stub = sinon.stub(keys, 'get', function() {
      return {device: prey_cfg.device_key, api: prey_cfg.api_key}
    });
  });

  after(function() {
    spy.restore();
    keys_stub.restore();
  });

  describe('on load', function() {
    it('passes emitter to callback', function(done) {
      load(function(err, em, spy) {
        (em instanceof EventEmitter).should.equal(true);
        done();
      });
    });
  });

  describe('on connected', function(done) {
    it('triggers request once', function() {
      server_up(function(req, res) {
        res.end();
      });

      load(function(err, em, spy) {
        hooks.trigger('connected');
        spy.calledOnce.should.equal(true);
        server_down(function() {
          unload(function() {
            done();
          });
        });
      });
    });
  });

  describe('when agent is connected to the Internet', function() {

    describe('and response has status code != 200', function(done) {
      it('triggers error and re-schedules', function() {
        var responses = 0;

        server_up(function(req, res) {
          if (responses) return server_down();
          res.statusCode = 302;
          res.end();
          responses++;
        });

        load(function(err, em, spy) {
          getter_spy = spy;
          hooks.trigger('connected');
          hooks.on('error', listener);

          var errors = {};

          function listener(err) {
            if (spy.callCount < 3) {
              errors[err] ? errors[err].count++ : errors[err] = {count: 1};
            } else {
              finish();
            }
          }

          function finish() {
            spy.callCount.should.equal(3);
            errors.should.eql({ 'Error: Invalid response received with status code 302': { count: 2 } });
            errors.should.exist;
            server_down(function() {
              unload(function() {
                hooks.remove('error', listener);
                done();
              });
            });
          }

        });
      });
    });

    describe('and response status code is 200', function(done) {

      describe('and valid command object', function() {
        it('emmits command', function() {
          var command = {command: 'get', target: 'location'};
          server_up(function(req, res) {
            res.statusCode = 200;
            res.writeHead(200, {'Content-Type': 'application/json'});
            res.end(JSON.stringify([command]));
          });

          load(function(err, em, spy) {
            getter_spy = spy;
            hooks.trigger('connected');
            em.on('command', function(cmd) {
              JSON.stringify(cmd).should.eql(JSON.stringify(command));
              finish();
            });


            function finish() {
              server_down(function() {
                unload(function() {
                  done();
                });
              });
            }

          });
        });
      });

      describe('and invalid command object', function(done) {

        it('triggers error', function() {
          var command = {command: 'get', target: 'location'};
          server_up(function(req, res) {
            res.statusCode = 200;
            res.writeHead(200, {'Content-Type': 'application/json'});
            res.end('simon says: start alarm');
          });

          load(function(err, em, spy) {
            getter_spy = spy;
            hooks.trigger('connected');
            hooks.on('error', listener);

            var errors = {};

            function listener(err) {
              if (spy.callCount < 3) {
                errors[err] ? errors[err].count++ : errors[err] = {count: 1};
              } else {
                finish();
              }
            }
            function finish() {
              server_down(function() {
                unload(function() {
                  hooks.remove('error', listener);
                  spy.callCount.should.equal(3);
                  errors.should.eql({ 'Error: Invalid command object': { count: 2 } });
                  done();
                });
              });
            }
          });
        });

      });

    });

  });

  describe('when agent is disconnected from the Internet', function() {});

  describe('on unload', function() {
    it('returns true to cb', function(done) {
      long_polling.load.call(common_obj, function() {
        unload(function(unloaded) {
          unloaded.should.be.true;
          done();
        });
      });
    });
  });

});
