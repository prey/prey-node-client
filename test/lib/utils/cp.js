describe('copy_file', function(){

  describe('if source file does not exist', function(){

    it('should call back with error')

  })

  describe('if source file exists', function(){

    describe('and destination file exists', function(){

      it('should call back with an error')

    })

    describe('and destination file exists', function(){

      it('overwrites it');

    });

    describe('and destination file does NOT exist', function(){

      describe('and destination folder does NOT exist', function(){

        describe('and has write permissions to parent', function(){
          it('should create it');
        });

        describe('with no write permissions to parent', function(){
          it('should NOT create it');
        });

      });

      it('should copy file')
      it('should have the same contents')

    })

  })

})
