var should      = require('should'),
sinon       = require('sinon'),
JSEncrypt   = require('node-jsencrypt'),
secure      = require('../secure'),
devices     = require('../api/devices');
account     = require('../../../../conf/account'),
storage     = require('../../../utils/storage'),
tmpdir      = require('os').tmpdir;

var file,
encrypted_key,
publicKey,
public_key = "-----BEGIN PUBLIC KEY-----\nMIGeMA0GCSqGSIb3DQEBAQUAA4GMADCBiAKBgGA3N9masIGZ471UNRuf/ftdaC1O\nxeFPzv8gZv1tKb2MBq1GkBd7Xwi0cjdgm/40oXJvvHz7GQvvsp+9Bcj8YXCphIFt\nQziStjn3iJ3+ds3zrqf4JlGxV3FJmhfNg451n3CwZygge4eyTQNkQffMBPAmujvk\nGQvLF2CiLRxXeYjNAgMBAAE=\n-----END PUBLIC KEY-----",
private_key = "-----BEGIN RSA PRIVATE KEY-----\nMIICWwIBAAKBgGA3N9masIGZ471UNRuf/ftdaC1OxeFPzv8gZv1tKb2MBq1GkBd7\nXwi0cjdgm/40oXJvvHz7GQvvsp+9Bcj8YXCphIFtQziStjn3iJ3+ds3zrqf4JlGx\nV3FJmhfNg451n3CwZygge4eyTQNkQffMBPAmujvkGQvLF2CiLRxXeYjNAgMBAAEC\ngYBNLh4r/Q1XePWZmyHa3hVjfMMjjQvouBdoyjozUkzoUpnMh0zwuTM7jVwNlf6s\nBNX5MS525wlpbMbRolQwrFsQg8Q4oijiNYag897/ypgMCWdllOu9CWd1+Oepc+4p\nyybCTF5adUbhbyzm+p9Emqtl9Ys9P06/xx1reaxxkt0tQQJBAKLeg7h4KkBI1kF9\nIRSHNy9i3B3Kvprgqm95aLSsW3egUCwHawII3M7wl033dYbak6mIS5llcQGKFGQq\nFYAL7/0CQQCXO65FeLRKbWWbmmhZ+MAeBXR2I8JlMD5a8fLZjp57eBD7gDXKH8sK\nty0hWUW8hjupzzaZ8xWashW2QeMi1c0RAkEAnc6UOkzUQ21PjCy9vLI3GkbjmEo1\n3MMK4O/2L/lAtuwyQjb9y/7iU/Bx6i13Rq7KnF1fQsYzdJZho5vTMTpf0QJAQbC/\nwxdqIMYiE5Pfbe1Z7fBqpQJlZzSscS6VUSDdAD6oCcaoFrL2rCHi7ZBsdTZNZjZG\nvlpTcQ2X1sIJ2lDKMQJAYC4+BnUcZkOULIt8RIii1BBGCqgpoAIRYQzp69KnaR9z\nNPHJjTDzXtJY9tw5zMyfZTNIOjTct9SFXtrMucTW7A==\n-----END RSA PRIVATE KEY-----",
bad_private_key = "-----BEGIN RSA PRIVATE KEY-----\nMIICWwIBAAKBgGA3N9masIRZ471UNRuf/ftdaC1OxeFPzv8gZv1tKb2MBq1GkBd7\nXwi0cjdgm/40oXJvvHz7GQvvs1+9Bcj8YXCphIFtQziStjn3iJ3+ds3zrqf4JlGx\nV3FJmhfNg451n3CwZygge4eyTQNk0ffMBPAmujvkGQvLF2CiLRxXeYjNAgMBAAEC\ngYBNLh4r/Q1XePWZmyHa3hVjfMMjjQvouBdoyjozUkzoUpnMh0zwuTM7jVwNlf6s\nBNX4MS525wlpbMbRolQwrFsQg8Q4oijiNYag897/ypgMCWdllOu9CWd1+Oepc+4p\nyybCTF5adUbhbyzm+p9Emqtl9Ys9P06/xx1reaxxkt0tQQJBAKLeg7h4KkBI1kF9\nIRSHNy9p3B3Kvprgqm95aLSsW3egUCwHawII3M7wl033dYbak6mIS5llcQGKFGQq\nFYAL7/0CQQCXO65FeLRKbWWbmmhZ+MAeBXR2I8JlMD5a8fLZjp57eBD7gDXKH8sK\nty0hWUW8hjupzzaZ8xWashW2QeMi1c0RAkEAnc6UOkzUQ21PjCy9vLI3GkbjmEo1\n3MMK4O/2L/lRtuwyQjb9y/7iU/Bx6i13Rq7KnF1fQsYzdJZho5vTMTpf0QJAQbC/\nwxdqIMYiE5Pfbe1Z7fBqpQJlZzSscS6VUSDdAD6oCcaoFrL2rCHi7ZBsdTZNZjZG\nvlpTcQ2X1sIJ2lDKMQJAYC4+BnUcZkOULIt8RIii1BBGCqgpoAIRYQzp69KnaR9z\nNPHJjTDzXtJY9tw5zMyfZTNIOjTct9SFXtrMucTW7A==\n-----END RSA PRIVATE KEY-----",
api_key = "aaaaaaaaaaaa";

var crypt = new JSEncrypt();
crypt.setPublicKey(public_key);

describe('secure()', function() {

describe('fetch private and public keys', function() {

describe('with keys stored', function() {
  before(function(done) {
    storage.init('keys', tmpdir() + '/store2.db', () => {
      storage.do('set', {type: 'keys', id: 'public_key', data: {value: Buffer.from(public_key).toString('base64') }} , function(err) {
        storage.do('set', {type: 'keys', id: 'private_key', data: {value: Buffer.from(private_key).toString('base64') }} , function(err) {
        done();
        })
      })
    });
  })

  after((done) => {
    storage.erase(tmpdir() + '/store2.db', done);
  })

  it('returns the stored keys', function(done) {
    secure.generate_keys(function(err) {
      should.not.exist(err);
      publicKey = secure.public_keys().default;
      secure.public_keys().formatted.should.not.containEql('BEGIN PUBLIC KEY-----');
      done();
    })
  })
})

describe('with no keys stored', function() {
  before(function(done) {
    storage.init('keys', tmpdir() + '/store2.db', done)
  })

  after((done) => {
    storage.erase(tmpdir() + '/store2.db', done);
  })
   
  it('generate, store and returns new keys', function(done) {
    secure.generate_keys(function(err) {
      should.not.exist(err);
      publicKey = secure.public_keys().default;
      publicKey.should.containEql('BEGIN PUBLIC KEY-----');
      publicKey.should.not.be.equal(public_key);
      storage.do('query', {type: 'keys', column : 'id', data: 'public_key' }, function (err,rows) {
        let key = rows[0];
        should.exist(key);
        key.value.should.equal(Buffer.from(publicKey).toString('base64'));
        done();
      })
    });
  })
})
})

describe('decrypt_and_notify()', function() {
var notify_stub;
before(function() {
  notify_stub = sinon.stub(devices , 'post_sso_status').callsFake((data, cb) => {
    return cb(null);
  })
});

after(function() {
  notify_stub.restore();
});

describe('with failed decrypting', function() {
  before(function(done) {
    secure.generate_keys(() => {
      crypt.setPrivateKey(bad_private_key);
      encrypted_key = crypt.encrypt(api_key);
      done();
    });
  });

  after(function() {
    encrypted_key = null;
  })

  it('returns error', function(done) {
    secure.decrypt_and_notify(encrypted_key, function(err) {
      should.exist(err);
      err.message.should.containEql('Decryted api key unavailable');
      done();
    })
  });
});

describe('with succeded decrypting', function() {
  var auth_stub;

  before(function(done) {
    auth_stub = sinon.stub(account, 'authorize').callsFake((opts, cb) => {
      return cb(null);
    })

    storage.init('keys', tmpdir() + '/store2.db', () => {
      secure.generate_keys(function() {
        crypt.setPublicKey(secure.public_keys().default);
        encrypted_key = crypt.encrypt(api_key);
        done();
      });
    });
  });

  after(function(done) {
    auth_stub.restore();
    storage.erase(tmpdir() + '/store2.db', done);
  })

  it('doesnt returns error', function(done) {
    secure.decrypt_and_notify(encrypted_key, function(err) {
      should.not.exist(err);
      done();
    })
  });
});

})
});