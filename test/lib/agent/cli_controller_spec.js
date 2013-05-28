

describe('lib/agent/cli_controller_spec #wip', function(){
  
  describe('when config file does not exist', function(){

    it('returns an error');
    it('does not run agent');
  });

  describe('signals', function(){

    describe('when SIGUSR1 signal is received', function(){

      it('should call agent.engage()');
      it('should pass `network` argument to engage()');
    });

    describe('when SIGUSR2 signal is received', function(){

      it('should call agent.engage()');
      it('should pass `network` argument to engage()');    
    });

    describe('when SIGINT signal is received', function(){
      it('should not terminate process');
    });
  });

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
