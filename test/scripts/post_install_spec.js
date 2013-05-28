


describe('scripts/post_install_spec #wip', function(){

  describe('when platform is windows', function(){

    it('should call bin/prey config hooks post_install');
  });

  describe('when platform is not windows', function(){

    describe('when called as admin user (sudo npm -g install', function(){

      it('should call bin/prey config hook post_install');
    });

    describe('when called as a non-privileged user', function(){

      it('should not call bin/prey');
      it('should exit with error code (1)')
    });
  });
});
