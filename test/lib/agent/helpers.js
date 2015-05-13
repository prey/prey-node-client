var test_helpers = require('../../helpers'),
    helpers = require(test_helpers.lib_path('agent', 'helpers')),
    should  = require('should');

describe('helpers.is_greater_than', function() {
  it('returns false when first is lower than second', function () {
    helpers.is_greater_than("1.3.9", "1.3.10").should.equal(false);
  });

  it('returns true when first is higher than second', function() {
    helpers.is_greater_than("1.3.10", "1.3.9").should.equal(true);
  });
});