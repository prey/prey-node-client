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

  it('returns false when both are equal', function() {
    helpers.is_greater_than("1.3.10", "1.3.10").should.equal(false);
  });

  // In the following cases, there's no way to compare, hence it returns false

  it('returns false when second is empty, null or undefined', function() {
    helpers.is_greater_than("1.3.10", "").should.equal(false);
    helpers.is_greater_than("1.3.10", null).should.equal(false);
    helpers.is_greater_than("1.3.10", undefined).should.equal(false);
  });

  it('returns false when first is empty, null or undefined', function() {
    helpers.is_greater_than("", "1.3.10").should.equal(false);
    helpers.is_greater_than(null, "1.3.10").should.equal(false);
    helpers.is_greater_than(undefined, "1.3.10").should.equal(false);
  });

  it('returns false if both are empty, null or undefined', function() {
    helpers.is_greater_than("", "").should.equal(false);
    helpers.is_greater_than(null, undefined).should.equal(false);
    helpers.is_greater_than(undefined, null).should.equal(false);
  });

});

describe('helpers.is_greater_or_equal', function() {
  it('returns false when first is lower than second', function () {
    helpers.is_greater_or_equal("1.3.9", "1.3.10").should.equal(false);
  });

  it('returns true when first is higher than second', function() {
    helpers.is_greater_or_equal("1.3.10", "1.3.9").should.equal(true);
  });

  it('returns true when both are equal', function() {
    helpers.is_greater_or_equal("1.3.10", "1.3.10").should.equal(true);
  });

  // In the following cases, there's no way to compare, hence it returns false

  it('returns false when second is empty, null or undefined', function() {
    helpers.is_greater_or_equal("1.3.10", "").should.equal(false);
    helpers.is_greater_or_equal("1.3.10", null).should.equal(false);
    helpers.is_greater_or_equal("1.3.10", undefined).should.equal(false);
  });

  it('returns false when first is empty, null or undefined', function() {
    helpers.is_greater_or_equal("", "1.3.10").should.equal(false);
    helpers.is_greater_or_equal(null, "1.3.10").should.equal(false);
    helpers.is_greater_or_equal(undefined, "1.3.10").should.equal(false);
  });

  it('returns false if both are empty, null or undefined', function() {
    helpers.is_greater_or_equal("", "").should.equal(false);
    helpers.is_greater_or_equal(null, undefined).should.equal(false);
    helpers.is_greater_or_equal(undefined, null).should.equal(false);
  });

});