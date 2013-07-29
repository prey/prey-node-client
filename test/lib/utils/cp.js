describe('copy_file', function(){

	describe('if source file does not exist', function(){

		it('should call back with error')

	})

	describe('if source file exists', function(){

		describe('and destination file exists', function(){

			it('should call back with an error')

		})

		describe('and destination file does NOT exist', function(){

			describe('and destination folder does NOT exist', function(){

				it('should try to create it')

				it('should stop and callback with error if it couldnt')

			});


			it('should copy file')

			it('should have the same contents')

		})

	})

	it('should callback with error if source file does not exist');

	it('should callback with error if destination folder does not exist');

})
