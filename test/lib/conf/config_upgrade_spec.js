describe('config upgrade', function() {

  it('checks if a new version is available', function(){

  })

  describe('when no new version is available', function(){

    it('does not download shit')
    it('exits with status code 1')

  });

  describe('when a new version is available', function(){

    it('downloads the package')

    describe('with no write permissions', function(){

      it('removes downloaded package')
      // it('notifies of error')
      it('exits with status code 1')

    });

    describe('with write permissions', function(){

      it('unzips the package to versions path')
      it('runs config activate on new package')

    });

  });

/*

  describe('on successful update', function() {

    describe('when default config has no modified keys', function(){

      it('leaves the file untouched');

    });

    describe('when default config file was modified', function(){

      it('adds new keys');
      it('does not replace any existing values');

    });

  });

*/

})
