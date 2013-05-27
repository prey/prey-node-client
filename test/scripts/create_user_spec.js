
describe('without sudo privileges', function(){

  it('exits with error code');
});

describe('with no arguments', function(){

  it('does not create any `default` user (system user count should remain the same)');
  it('exits with error code');
});

describe('with sudo privileges', function(){

  describe('and user exists', function(){

    it('exists with error code');
  });

  describe('and user does not exists', function(){

    it('creates the user');
    it('adds the user to adm, netdev groups');

    describe('with created user', function(){

      it('should be able to impersonate another user');
      it('should NOT be able to impersonate root');
    })
  });
});
