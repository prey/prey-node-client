describe('helpers', function(){

	describe('tempfile_path', function(){

		it('should prepend the temp_path value for the running platform', function(){

		});

		it('should not return the same string as received', function(){

		});

	});

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
	
	describe('store_config_values', function(){
		
		
		
		
	});
	
	describe('copy_file', function(){
		
		describe('if source file does not exist', function(){
			
			it('should call back with error', function(){
				
			})
			
		})
		
		describe('if source file exists', function(){
			
			describe('and destination file exists', function(){
				
				it('should call back with an error', function(){
					
				})
				
			})
			
			describe('and destination file does NOT exist', function(){
				
				describe('and destination folder does NOT exist', function(){
					
					it('should try to create it', function(){
						
					})
					
					it('should stop and callback with error if it couldnt', function(){
						
					})
					
				});

				
				it('should copy file', function(){
					
					
				})
				
				it('should have the same contents', function(){
					
				})

			})
			
		})
		
		it('should callback with error if source file does not exist', function(){
			
		});
		
		it('should callback with error if destination folder does not exist', fuc)
		
	})
	
	describe('replace_in_file', function(){
		
	});

});
