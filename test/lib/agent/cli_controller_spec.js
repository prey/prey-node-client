
var 
  join                  = require('path').join,
  sandbox               = require('sandboxed-module'),
  exec                  = require('child_process').exec,
  spawn                 = require('child_process').spawn,
  cli_test_helper_path  = join(__dirname, '..', '..', 'utils', 'lib_agent_cli.js'),
  prey_config_path      = require('path').resolve(__dirname, '..', '..', '..'),
  is_windows            = process.platform === 'win32';

console.log(prey_config_path)

describe('lib/agent/cli_controller_spec', function(){
  
  describe('when config file does not exist', function(){

    it('returns an error');
    it('does not run agent');
  });

  if (!is_windows) {
  describe('signals #wip', function(){

    describe('when SIGUSR1 signal is received', function(){

      it('should call agent.engage() with the argument `interval`', function(done){
        var cli = spawn('node', [cli_test_helper_path]);

        cli.on('close', function (code, signal){
          code.should.be.equal(41);
          done();
        });

        // We need some time before issue the kill signal.
        // If we shoot the 'kill' inmediately, the spawned program will not have
        // a chance to _capture_ the signal.
        var t = setTimeout(function(){ cli.kill('SIGUSR1'); }, 100);
      });
    });

    describe('when SIGUSR2 signal is received', function(){

      it('should call agent.engage() with the argument `network`', function(done){
        var cli = spawn('node', [cli_test_helper_path, '-p', prey_config_path]);

        cli.on('close', function (code, signal){
          code.should.be.equal(42);
          done();
        });

        var t = setTimeout(function(){ cli.kill('SIGUSR2'); }, 100);
      });
    });

    describe('when SIGINT signal is received', function(){
      it('should not terminate process');
    });
  });
  } // end `is_windows` condition
  describe('events', function(){

    describe('on exit', function(){
      
      it('calls agent.shutdown');

      describe('if agent is running', function(){

        it ('removes pid');
      });

      describe('if agent is NOT running', function(){

        it ('does not try to remove pid');
      })
    });

    describe('on uncaughtException', function(){

      it('exits with error code (1)');

      describe('and send_crash_reports if config is true?', function(){

        it('sends exception to endpoint');
      });

      describe('and send_crash_reports if config is false?', function(){

        it('does not send anything');
      });
    });
  });

  describe('when pid.store returns an existing pidfile', function(){

    describe('and pidfile creation time (process launch time) is later than two minutes ago', function(){

      it('exits with status code (0)');
    });

    describe('and pidfile creation time is earlier than two minutes ago', function(){

      describe('and this instance was launched by network trigger', function(){

        it('sends SIGUSR2 signal to other process');
      });

      describe('and this instance was launched by interval (cron, cronsvc', function(){

        it('sends SIGUSR1 signal to other process');
      });

      it('exits with status code (10)')
    });
  });

  describe('when no existing pidfile is found', function(){
    it('stores the pid of the process in file')
    it('calls agent.run()')
  });
});
