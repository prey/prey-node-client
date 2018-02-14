var fs       = require('fs'),
    join     = require('path').join,
    should   = require('should'),
    sinon    = require('sinon'),
    needle   = require('needle'),
    getset   = require('getset');

var common    = require('../../../common'),
    providers = require('../../../providers'),
    secure    = require('../secure');

var storage = require('./../../../utils/storage'),
    tmpdir  = require('os').tmpdir,
    device_keys = require('./../../../../agent/utils/keys-storage');

var file;
var public_key = "-----BEGIN PUBLIC KEY-----\nMIGeMA0GCSqGSIb3DQEBAQUAA4GMADCBiAKBgGA3N9masIGZ471UNRuf/ftdaC1O\nxeFPzv8gZv1tKb2MBq1GkBd7Xwi0cjdgm/40oXJvvHz7GQvvsp+9Bcj8YXCphIFt\nQziStjn3iJ3+ds3zrqf4JlGxV3FJmhfNg451n3CwZygge4eyTQNkQffMBPAmujvk\nGQvLF2CiLRxXeYjNAgMBAAE=\n-----END PUBLIC KEY-----";
var private_key = "-----BEGIN RSA PRIVATE KEY-----\nMIICWwIBAAKBgGA3N9masIGZ471UNRuf/ftdaC1OxeFPzv8gZv1tKb2MBq1GkBd7\nXwi0cjdgm/40oXJvvHz7GQvvsp+9Bcj8YXCphIFtQziStjn3iJ3+ds3zrqf4JlGx\nV3FJmhfNg451n3CwZygge4eyTQNkQffMBPAmujvkGQvLF2CiLRxXeYjNAgMBAAEC\ngYBNLh4r/Q1XePWZmyHa3hVjfMMjjQvouBdoyjozUkzoUpnMh0zwuTM7jVwNlf6s\nBNX5MS525wlpbMbRolQwrFsQg8Q4oijiNYag897/ypgMCWdllOu9CWd1+Oepc+4p\nyybCTF5adUbhbyzm+p9Emqtl9Ys9P06/xx1reaxxkt0tQQJBAKLeg7h4KkBI1kF9\nIRSHNy9i3B3Kvprgqm95aLSsW3egUCwHawII3M7wl033dYbak6mIS5llcQGKFGQq\nFYAL7/0CQQCXO65FeLRKbWWbmmhZ+MAeBXR2I8JlMD5a8fLZjp57eBD7gDXKH8sK\nty0hWUW8hjupzzaZ8xWashW2QeMi1c0RAkEAnc6UOkzUQ21PjCy9vLI3GkbjmEo1\n3MMK4O/2L/lAtuwyQjb9y/7iU/Bx6i13Rq7KnF1fQsYzdJZho5vTMTpf0QJAQbC/\nwxdqIMYiE5Pfbe1Z7fBqpQJlZzSscS6VUSDdAD6oCcaoFrL2rCHi7ZBsdTZNZjZG\nvlpTcQ2X1sIJ2lDKMQJAYC4+BnUcZkOULIt8RIii1BBGCqgpoAIRYQzp69KnaR9z\nNPHJjTDzXtJY9tw5zMyfZTNIOjTct9SFXtrMucTW7A==\n-----END RSA PRIVATE KEY-----";
var encrypted_apikey = "CxQjt3rkZHjeoHW0VsJ4M6bXX/Cl6ZxFO0YDRpWXM7W5vY9pE0fw4duWma0rPzRTTfKkbQDVt/NDSS1BC4WJsCjwBE6c/7myONFO5pYJAbo99VCKv/PqrZDZfG9I8Q+emUSP1dxcpIbbhU6QoddouiC1IN0JiaXcHZHmsdHQE8g=";

describe('secure()', function() {
  describe('fetch private and public keys', function() {
    before(function(done) {
      file = tmpdir() + '/store.db';
      storage.init('keys', file, function() {
        done();
      })
    })

    describe('with no keys stored', function() {
      before(function(done) {
        storage.set('public-key', {value: public_key}, function() {
          storage.set('private-key', {value: private_key}, function() {
            done();
          })
        })
      })

      it('returns the stored keys', function(done){
        secure.generate_keys(function(err, publicKey, formatted_public_key) {
          should.not.exist(err);
          publicKey.should.equal(public_key);
          formatted_public_key.should.not.containEql('BEGIN PUBLIC KEY-----');
          done();
        })
      })
    })

    describe('with keys stored', function() {
      before(function(done) {
        storage.del('public-key', function() {
          storage.del('private-key', function() {
            done();
          })
        })
      })

      it('generate, store and returns new keys', function(done) {
        secure.generate_keys(function(err, publicKey, formatted_public_key) {
          should.not.exist(err);
          publicKey.should.containEql('BEGIN PUBLIC KEY-----');
          publicKey.should.not.be.equal(public_key);
          storage.get('public-key', function(err, key) {
            console.log("KEY!!!", key)
            done();
          })
          
        });
        
      })
    })

  })

  describe('decrypt_and_notify()', function() {
    
  })

});