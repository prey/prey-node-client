describe('paths', function(){

  describe('static paths', function(){

    describe('temp', function(){

      it('points to an existing dir', function(){

      });

      it('has write permissions to it', function(){

      })

    });

    describe('log_file', function(){

      describe('before activation', function(){

        it('does not exist', function(){

        });

      });

      describe('after activation', function(){

        it('exists', function(){

        });

      });

    });

  })

  describe('relative paths', function(){

    describe('current', function(){

    });

    describe('install', function(){


    });

    describe('versions', function(){


      describe('if running from a versionable path', function(){

        it('should point to an existing dir', function(){

        });

      })

      describe('it NOT running from a versionable path', function(){

        it('should not exist', function(){

        });

      });

    });

    describe('package', function(){

      it('should point to an existing dir', function(){

      });

      it('matches the path in which the bin/prey binary was called', function(){

      })

    });

    describe('package_bin', function(){

      it('should point to an existing file', function(){

      });

      describe('when versionable path exists', function(){

        it('matches the bin/prey binary that was called', function(){

        })

      });

      describe('when NO versionable path is found', function(){

        it('matches the bin/prey binary that was called', function(){

        })

      });

    });

    describe('current_bin', function(){

      it('should point to an existing file', function(){

      });

      describe('when versionable path exists', function(){

        it('matches the bin/prey binary that lies in /current', function(){

        })

      });

      describe('when NO versionable path is found', function(){

        it('matches the bin/prey binary that lies in the root path', function(){

        })

      });

    });

  })

});
