
var fs                    = require('fs'),
    join                  = require('path').join,
    os                    = require('os'),
    spawn                 = require('child_process').spawn,
    should                = require('should'),
    cli_sandbox           = require('./../../utils/cli_sandbox'),
    cli_test_helper_path  = join(__dirname, '..', '..', 'utils', 'lib_agent_cli.js'),
    test_file_path        = join(os.tmpDir(), '5b957c999343408e127ee49663383289_test_prey_agent_run'),
    is_windows            = process.platform === 'win32';

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

    it('logs error message', function(){
      result.out.toLowerCase().should.include('no config file found');
    });
  })

  if (!is_windows) {


  describe('events', function(){

    describe('on exit', function(){

      before(function(done){
        fs.unlink(test_file_path, function(){
          done()
        });
      });

      describe('if agent is running', function(){

        var cli,
            test_file_contents;

        before(function(done){
          cli = spawn('node', [cli_test_helper_path, 'config_present', 'agent_running_true', test_file_path]);
          cli.on('close', function(){
            fs.readFile(test_file_path, 'utf8', function(err, data){
              test_file_contents = data;
              done();
            });
          });

          var t = setTimeout(function(){ cli.kill('SIGINT'); }, 300);
        });

        it('calls agent.shutdown', function(){
          test_file_contents.should.match(/^SHUTDOWN/);
        });

        it ('removes pid', function(){
          test_file_contents.should.match(/REMOVEDPID!$/);
        });

        after(function(done){
          fs.unlink(test_file_path, done);
        });
      });

      describe('if agent is NOT running', function(){

        it ('does not try to remove pid', function(done){
          var cli = spawn('node', [cli_test_helper_path, 'config_present', 'agent_running_false', test_file_path]);

          cli.on('close', function (){
            fs.exists(test_file_path, function(exists){
              exists.should.be.false;
              done();
            });
          });

          var t = setTimeout(function(){ cli.kill('SIGINT') }, 300);
        });
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
        var common   = { config: { get: function(key) { return send_exceptions } } } 
        var requires = { './exceptions': { send: function(err) { sent_exception = err } } } 
        result = cli_sandbox.run({ pid: bad_pid, common: common, requires: requires })
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
          sent_exception.message.should.include('ola ke ase');
        });
      });

    });

  });

  } // end `is_windows` condition

  describe('when pid.store returns an existing pidfile', function(){
    
    var result, ctime, fake_pid = 12345;

    var fake_pidfile = function(){
      return {
        pid: fake_pid,
        stat: { ctime: ctime }
      }
    }
    
    var run_cli = function(trigger){
      var fake_store = { store: function(file, cb){ cb(null, fake_pidfile()) } }
      var fake_env   = { env: { TRIGGER: trigger }}
      
      result = cli_sandbox.run({ pid: fake_store, process: fake_env });
    }

    if (!is_windows) {
    describe('and pidfile creation time is earlier than two minutes ago', function(){
      
      before(function(){
        ctime = new Date() - 1000000; // about 16 minutes ago
      })

      describe('and this instance was launched by network trigger', function(){

        before(function(){
          run_cli('network');
        })

        it('exits with status code (10)', function(){
          result.code.should.equal(10);
        });
      });

      describe('and this instance was launched by interval (cron, cronsvc', function(){

        before(function(){
          run_cli(''); // interval does not set the env.TRIGGER variable
        })

        it('exits with status code (10)', function(){
          result.code.should.equal(10);
        });
      });
    });
    } // end `is_windows` condition
  });
});
