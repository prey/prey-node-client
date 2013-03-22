# Tests

A list of the tests implemented. See TODO.md for the roadmap.

-------------------------------------------------------------------------------
## Scripts

### scripts/create_user.js
  #create_user()
    ✓ Should exit when no username is given
    ✓ Should create a user, given the username (2786ms)
    ✓ Should exit if it is executed with a user different than root (64ms)
    ✓ Should exit if user already exists (66ms)
  #grant_privileges()
    ✓ Should find the sudoers.d file and that it has the right privileges
    ✓ Should, as <test_user>, impersonate the existing user (95ms)
    ✓ Should, as <test_user>, be unable to impersonate if the sudoers file doesn't exist
