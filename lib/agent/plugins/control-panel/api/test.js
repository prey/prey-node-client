var x = require('./');

var data = { username: 'foobar', password: 'x'}

x.accounts.authorize(data, function(err, out) {
 console.log('Auth response');
 console.log(err || out);
})

var data = {
  name : 'Foo',
  os   : 'Mac',
  type : 'Desktop'
}

x.devices.link(data, function(err, out) {
 console.log('Link response');
 console.log(err || out);
})

x.devices.unlink(function(err, out) {
 console.log('Unlink response');
 console.log(err || out);
})

x.keys.verify({ api: 'fasd', device: '123123'}, function(err, out){
  console.log('Verify response');
  console.log(err || out);
})
