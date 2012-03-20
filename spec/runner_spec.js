var exec = require('child_process').exec,
		main_script = require('./../package').scripts.start;

describe('prey.js', function(){

//	var child;
//	var stdout;

//	beforeEach(function(){
//		child = exec(main_script, function(err, stdout, stderr){
//			stdout = stdout;
//		});
//	});
	
	it('should set Preys ROOT_PATH in process.env', function(){

	});
	
	it('should parse command line arguments', function(){
		
	})

	describe('when no config file is found', function(){

		it('should launch the setup routine', function(){

		});

		it('should not continue with the rest of the process', function(){

		});

	});
	
	describe('signals', function(){
		
		it('should set listeners and wait for them to be sent', function(){
			
		})
		
		it('should call encage on agent once SIGUSR1 or SIGUSR2 is received', function(){
			
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
