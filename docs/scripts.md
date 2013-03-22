# Scripts

## create_user.sh

### OSX and LINUX

* What does this script?

Creates the user `prey` in the unix based systems (OSX and Linux) and enables the `sudo` permits which enable this account to impersonate any user but `root` and the `^-` (name starting with a hyphen).

* How you should run it?

This script must be executed as `root`, an impersonation test will be issued inside this operation.

````bash
$ sudo ./scripts/create_user.sh prey
````

The normal execution of the prey client requires that the user to be created should be `prey`. Nothwithstanding, you can use this script to create any user you like. In fact, the tests work by creating a user called `test___prey`.

* Tests
  * create_user()
    ✓ Should exit when no username is given
    ✓ Should create a user, given the username
    ✓ Should exit if it is executed with a user different than root
    ✓ Should exit if user already exists
  * grant_privileges()
    ✓ Should find the sudoers.d file and that it has the right privileges
    ✓ Should, as <test_user>, impersonate the existing user
    ✓ Should, as <test_user>, be unable to impersonate if the sudoers file doesn't exist

### WINDOWS

* What does this script?

Prey does not create a user in Windows.
