var assert  = require('assert'),
    sinon   = require('sinon'),
    should  = require('should'),
    needle  = require('needle'),
    api     = require('../../api'),
    request = require('../../api/request'),
    getter  = api.devices.get,
    keys    = api.keys,
    long_polling = require('..'),
    hooks   = require('../../../../hooks'),
    common  = require('../../../../../common'),
    EventEmitter = require('events').EventEmitter,
    test_server  = require('./test_server');


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
  config: {
    get: (key) => {
      if (key == 'protocol') return prey_cfg.protocol;
      if (key == 'host')     return prey_cfg.host;
    }
  },
  logger: common.logger,
  system: common.system
};

var spy,
    keys_stub,
    server;

function load(cb) {
  spy.resetHistory();

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
    spy = sinon.spy(needle, 'get');
    keys_stub = sinon.stub(keys, 'get').callsFake(() => {
      return {device: prey_cfg.device_key, api: prey_cfg.api_key}
    });
  });

  after(function() {
    spy.resetHistory();
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

  describe('on connected', function() {
    it('triggers request once', function(done) {
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

    describe('and response has status code != 200', function() {

      it('triggers error and re-schedules', function(done) {
        var responses = 0;

        server_up(function(req, res) {
          if (responses > 2) return server_down();
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
            unload(function() {
              server_down(function() {
                hooks.remove('error', listener);
                setTimeout(() =>{
                  done();
                }, 2000)
              });
            });
          }
        });
      });
    });

    describe('and response status code is 200', function() {

      describe('and valid command object', function() {

        it('emmits command', function(done) {
          var command = [{"command":"get","target":"location"}]
          var responses = 0;

          server_up(function(req, res) {
            if (responses) return server_down();
            res.statusCode = 200;
            res.write(JSON.stringify(command))
            res.end();
            responses++;
          });

          load(function(err, em, spy) {
            
            getter_spy = spy;
            hooks.trigger('connected');
            em.on('command', function(cmd) {
              responses++;
              JSON.stringify(cmd).should.eql(JSON.stringify(command[0]));
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

      describe('and invalid command object', function() {

        it('triggers error', function(done) {
          var command = {"command":"get","target":"location"},
              responses = 0;

          server_up(function(req, res) {
            if (responses > 2) return server_down();
            res.statusCode = 200;
            res.write(command.toString());
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
