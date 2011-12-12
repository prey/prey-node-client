describe('helpers', function(){

	describe('tempfile_path', function(){

		it('should get the temp_path value for the running platform', function(){

		});

		it('should not return the same string as received', function(){

		});

	});

	describe('check_and_store_pid', function(){

		it('should verify if pidfile exists', function(){

		});

		describe('if pidfile exists', function(){

			it('should verify if the process is running', function(){

			});

			describe('and process is running', function(){

				it('should return the processes PID in the callback', function(){

				});

			});

			describe("and process is NOT running", function(){

				it("should notify about this and continue", function(){

				});

			});

		});

		describe('if pidfile does NOT exist', function(){

			it('should create a new pidfile and store the value', function(){

			});

			it('should throw an exception if it had an error', function(){

			});

		});

	});

});
