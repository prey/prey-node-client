describe('when a report is requested', function(){

  describe('and it does not contain interval', function(){

    it('does not set a timer');

  });

  describe('and it contains interval', function(){

    it('sets a timer');

    describe('and is cancelled', function(){

      it('clears timeout');

      it('does not emit further events');

      describe('and a new one is requested', function(){

        it('sets the new one up');

      })

    });

  });

})
