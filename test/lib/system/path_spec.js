describe('system paths', function(){

  describe('when installed under a versions folder', function(){
    describe('and current folder is a symlink', function(){
      it('path.package should be equal to ``');
      it('path.install should be equal to ``');
      it('path.current should be equal to ``');
      it('path.versions should be equal to ``');
      it('path.package_bin should be equal to ``');
      it('path.current_bin should be equal to ``');
    });

    describe('and current folder is not a symlink (WinXP)', function(){
      it('path.package should be equal to ``');
      it('path.install should be equal to ``');
      it('path.current should be equal to ``');
      it('path.versions should be equal to ``');
      it('path.package_bin should be equal to ``');
      it('path.current_bin should be equal to ``');
    });
  });

  describe('when NOT installed under a versions folder (eg. via npm)', function(){
    it('path.package should be equal to ``');
    it('path.install should be equal to ``');
    it('path.current should be equal to ``');
    it('path.versions should be equal to ``');
    it('path.package_bin should be equal to ``');
    it('path.current_bin should be equal to ``');
  });
});
