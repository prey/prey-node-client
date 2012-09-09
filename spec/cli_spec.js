var should = require('should'),
    sandbox = require('sandboxed-module'),
    exec = require('child_process').exec,
    main_script = require('./../package').scripts.start;

var load_sandboxed = function(){
	var cli = sandbox.load('./../bin/prey', {
		requires: {
			'/home/tomas/code/prey/client.node/lib/prey': {
				agent: {
					run: function(){ console.log('Fake run!') },
					shutdown: function(){ console.log('Fake shutdown!') }
				}
			}
		}
	})
	return cli;
}

describe('prey.js', function(){

//	var child;
//	var stdout;

	describe('command line options', function(){

		describe('--path', function(){

			it('should set config file path relative to it', function(){

			})

		})

		describe('--driver', function(){

			it('should verify that the driver actually exists', function(){

			})

			it('should use that driver', function(){

			})

			it('should not save to config when exiting', function(){

			})

		})

		describe('--logfile', function(){

			it("should set program's log output path", function(){

			})

		})

		describe('--setup', function(){

			it('should run the setup process', function(){

			})

		})

	})

	it('should check if config file exists', function(){

	})

	describe('when no config file is found', function(){

		it('should launch the setup routine', function(){

		});

		it('should not continue with the rest of the process', function(){

		});

	});

	describe('signals', function(){

		describe('when SIGUSR1 is received', function(){

			it('should call agent.engage()', function(){

			})

			it('should pass "network" as an argument to engage()', function(){

			})

		})

		describe('when SIGUSR2 is received', function(){

			it('should call agent.engage()', function(){

			})

			it('should pass "trigger" as an argument to engage()', function(){

			})

		})

		describe('when SIGINT signal is received', function(){

			it('should do nothing', function(){

			})

		})

		describe('when SIGTERM signal is received', function(){

			it('should do nothing', function(){

			})

		})

		describe('when SIGQUIT signal is received', function(){

			it('should do nothing', function(){

			})

		})

	})


	it('should check if pidfile exists', function(){

	});

	describe('when pidfile exists', function(){

		it('should poke the other instance', function(){

		});

		it('should exit', function(){

		});

	});

	describe('when pidfile does NOT exist', function(){

		it('should store the PID in the pidfile', function(){

		});

		it('should run the main process', function(){

		});

	});

});
