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

	it('should set a ROOT_PATH var in process.env', function(){

	});

	describe('when no config file is found', function(){

		it('should launch the setup routine', function(){

		});

		it('should not continue with the rest of the process', function(){

		});

	});

	it('should load initial stuff', function(){

	});

	it('should parse command line arguments', function(){

	});

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
