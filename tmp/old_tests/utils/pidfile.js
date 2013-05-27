	describe('store_pid', function(){

		it('should verify if pidfile exists', function(){

		});

		describe('and when pidfile exists', function(){

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

		describe('and when pidfile does NOT exist', function(){

			it('should store the pid in a new file', function(){

			});

			it('should call back with an exception if it had any problems', function(){

			});

		});

	});
