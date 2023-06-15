
var fs                    = require('fs'),
    join                  = require('path').join,
    os                    = require('os'),
    spawn                 = require('child_process').spawn,
    should                = require('should'),
    cli_sandbox           = require('./../../utils/cli_sandbox'),
    is_windows            = process.platform === 'win32';

var node_path = join(__dirname, '..', '..', '..', 'bin', 'node');

describe('lib/agent/cli_spec', function(){

  describe('when config file does not exist', function(){

    var result,
        signals = [];

    before(function(){
      var fake_config = { present: function() { return false; } };
      var fake_process_on = function(signal, cb){ signals.push(signal); }

      result = cli_sandbox.run({
        common:  { config: fake_config },
        process: { on: fake_process_on }
      });
    });

    it('exits the process with status 1', function(){
      result.code.should.equal(1);
    });

    it('does not set any signal handlers', function(){
      signals.should.be.empty;
    });

    it('logs error message', function() {
      result.out.toLowerCase().should.containEql('no config file');
    });
  })

  describe('on exit', function(){

    describe('if agent is running', function(){
      it('calls agent.shutdown')
      it('removes pid')
    });

    describe('if agent is NOT running', function(){
      it('does not try to remove pid')
    })

  });

  describe('on uncaughtException', function(){

    var result,
        sent_exception = null;

    // pid.store is the first function we call after setting listeners,
    // so this test provokes the function to throw, and see what happens.
    // this function accepts a boolean as an argument which defines if exceptions are notified
    var run_cli = function(send_exceptions) {
      var bad_pid  = { store: function() { throw(new Error('ola ke ase')) } }
      var common   = {
        config: { get: function(key) { return send_exceptions } },
        exceptions: { send: function(err) { sent_exception = err } }
      }
      result = cli_sandbox.run({ pid: bad_pid, common: common })
    }

    describe('and send_crash_reports if config is false?', function(){

      before(function(){
        run_cli(false)
      })

      it('exits with error code (1)', function(){
        result.code.should.equal(1);
      });

      it('does not send exception to endpoint', function(){
        should.not.exist(sent_exception);
      });

    });

    describe('and send_crash_reports if config is true?', function(){

      before(function(){
        run_cli(true)
      })

      it('exits with error code (1)', function(){
        result.code.should.equal(1);
      });

      it('sends exception to endpoint', function(){
        sent_exception.should.be.an.instanceof(Error);
        sent_exception.message.should.containEql('ola ke ase');
      });

    });

  });

  describe('pid.store', function() {

    var result, ctime;

    var fake_running = function(){
      return {
        pid: 12345,
        stat: { ctime: 123456789 }
      }
    }

    var run_cli = function(store_func) {
      var fake_pid = { store: store_func }
      var fake_common = {
        config: { get: function(key){ return key } },
        exceptions: { send: function() { /* noop */ } }
      }
      result = cli_sandbox.run({ pid: fake_pid, common: fake_common });
    }

    describe('when it returns an error', function() {

      before(function(){
        var store_func = function(file, cb){ cb(new Error('ERR')) }
        run_cli(store_func);
      })

      it('exits with status code 1', function() {
        result.out.should.containEql('Cannot continue');
        result.code.should.equal(1);
      });

    })

    describe('when it returns a running pid', function() {

      before(function(){
        var store_func = function(file, cb){ cb(null, fake_running) }
        run_cli(store_func);
      })

      it('exits with status code (10)', function() {
        result.out.should.containEql('The Prey agent is running');
        result.code.should.equal(10);
      });

    })

  })

});
