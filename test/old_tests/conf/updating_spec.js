describe('updating', function(){

	describe('when auto-update is not enabled', function(){

		it('checks the latest version on npm', function(){

		})

		describe('when current version is older', function(){

			describe('and has not write permissions', function(){

				it('does not update the package', function(){

				})

			})

			describe('and has write permissions', function(){

				it('updates the package', function(){

				})

				describe('and the config file was modified', function(){

					describe('and has no write permissions', function(){

						it('leaves the file untouched', function(){

						})

					})

					describe('and has write permissions', function(){
					  
					  it('adds new keys if any', function(){
					    
					  })
					  
					  it('does not replace any existing values', function(){
					    
					  })
					  
					  it('updates for existing keys', function(){
					    
					  })

					})

				})

				it('exits the program', function(){

				})

			})

		})

	})

	describe('when auto-update is not enabled', function(){

		it('does not check the latest version', function(){

		})

	})

})
