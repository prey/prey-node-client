describe('actions', function(){

  describe('when multiple actions are started', function(){

    it('launches them', function(){

    });

    describe('and one of them returns', function(){


    });

    describe('and all of them return', function(){

      it('triggers an actions_finished event', function(){



      });

    });

  })

  describe('when an action is started', function(){

    describe('and the module is present', function(){

      describe('and exports a start() function', function(){

        it('calls it', function(){

        });

        describe('and it finishes', function(){

          it('triggers an [action_name]_finished event', function(){

          });

        });

      });

      describe('and does not export a start() function', function(){

        it('does not throw an error', function(){

        });

      });

    });

    describe('and the module is not present', function(){

      it('does not throw an error', function(){

      });

    });

  });

  describe('when an action is stopped', function(){

    describe('and the module exports a stop() function', function(){

      it('calls it', function(){


      });

    });

    describe('and the module does not export a stop() function', function(){

      it('does not throw an error', function(){

      });

    });

  });

});
