var helpers = require('./../../helpers'),
    should    = require('should'),
    sinon     = require('sinon'),
    actions = helpers.load('actions');

describe('actions', function(){

  describe('action start and stop', () => {
    
    it('runs the action and then stop it', (done) => {
      // actions.start('1234-5678', 'alert', {message: 'hi!'})
      actions.start('1234-5678', 'alarm', {sound: 'modem'})
      
      setTimeout(() => {
        actions.stop('1234-5678')
        done();
      }, 3000)
      
    })

    describe('when an action with same id arrives', () => {
      it('throws an error', (done) => {
        actions.start('9876-5432', 'alarm', {sound: 'modem'})

        setTimeout(() => {
          actions.start('9876-5432', 'alarm', {sound: 'modem'}, (err) => {
            should.exist(err);
            err.message.should.containEql('Already running');
            
            actions.stop('9876-5432')
            done();
          })
        }, 2000)
      })
    })

    describe('when an action with different id but same name arrives', () => {
      it('throws an error', (done) => {
        actions.start('1234-5678', 'alarm', {sound: 'modem'})
        actions.start('xxxx-yyyy', 'alert', {message: 'hey!'})
        
        setTimeout(() => {
          actions.start('9876-5432', 'alarm', {sound: 'alarm'}, (err) => {
            should.exist(err);
            err.message.should.containEql('Already running');
            
            actions.stop('1234-5678');
            
            setTimeout(() => {
              actions.stop('xxxx-yyyy');
              done();
            }, 2000)
          })
        }, 2000)
      })

      // it('stops current action and run the new one', (done) => {
      //   this.timeout(700);
      //   // actions.start('1234-5678', 'alert', {message: 'hi!'})
      //   actions.start('1234-5678', 'alarm', {sound: 'modem'})
        
      //   setTimeout(() => {
    
      //     // actions.start('9876-5432', 'alert', {message: 'hey!'})
      //     actions.start('9876-5432', 'alarm', {sound: 'alarm'})
    
      //     setTimeout(() => {
      //       actions.stop('9876-5432');
      //       done();
      //     }, 3000)
          
      //   }, 3000)
      // })
    })

  })

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
