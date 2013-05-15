===============================================
 base
===============================================

= bin_prey_spec

  + if local node exists
    - should use local node
  + if local node not exists
    + and system node exists
      - it uses system node
    + and system node does not exist
      - it fails miserably

  + when called with no params
    - it runs the agent
  + when called with config param
    - it runs lib/conf/cli.js
    - it passes any other arguments too (eg. `config activate`)
  + when called with test param
    - it runs mocha tests
    - it passes any other arguments too (eg. `--reporter nyan`)
  + when called with unknown params
    - it runs the agent (maybe we should show a usage screen, though)
                        (HJ: We need to specify if we want to restrict the params to be just `config` and `test`)

= bin_network_trigger_spec (mac, linux)

  + when called with no arguments
    - it sets prey_bin_path to /usr/lib/prey/current
  + when called with argument
    + and that path does not exist
      - it exits with error code
    + and that path exists
      - sets prey_bin_path as that one.
  + when a network change is detected
    - it checks if there is internet connecction
    + and there is no internet connection
      - it does not call the prey script
      - it keeps running
    + and there is internet connection
      + and prey_bin hasnt been called
        - it calls the script
        - it keeps running
      + and prey_bin has been called
        + and last call time was less than two minutes ago
          - it does not call the script
          - it keeps running
        + and last call time was more than two minutes ago
          - it calls the script
          - it keeps running

= prey_conf_spec (default config values)

  - it should be valid ini format (with # instead of ; though)
  - driver should be set to control-panel
  - host should be set to control.preyproject.com
  - protocol should be set to https
  - api_key should be empty
  - device_key should be empty

= scripts/create_user_spec

  + when no sudo privileges
    - it exist with error code
  + with no arguments
    - does not create any 'default' user (system user count should remain same)
    - it exist with error code
  + with sudo privileges
    + and user exists
      - it exits with error code
    + and user does not exist
      - it creates the user
      - it adds the user to adm, netdev groups
      + with created user
        - it should be able to impersonate another user
        - it should NOT be able to impersonate root

= scripts/post_install_spec

  + when platform is windows
    - it should call bin/prey config hooks post_install
  + when platform is not windows
    + when called as admin user (sudo npm -g install)
      - it should call bin/prey config hooks post_install
    + when called as a non-privileged user
      - it should not call bin/prey
      - it should exit with error code (1)

= scripts/pre_uninstall_spec

  - it calls bin/prey hooks config pre_uninstall
  + when child command exits with error code
    - it exits with error code

= lib/common_spec

  + when program.path is set
    - it looks for config file in that path
  + when program.path is not set
    - it looks for config file to system default config path

  - it calls getset.load with config file path
  - it exports config, system, program, user_agent

===============================================
 conf
===============================================

= lib/conf/cli_controller_spec

  + commands
    + activate (calls set_up_version('this'), set_interval and optinally loads gui)
      + when env.BUNDLE_ONLY flag is set
        - it stops running (set_up_version is not called)
        - exists with an error
      + when env.BUNDLE_ONLY flag is NOT set
        - it calls set_up_version
        + and set_up_version fails
          - it stops at that point (set_interval is not called)
          - exits with an error
        + and set_up_version succeeds
          - calls system.set_interval
          + and -g flag is set
            - calls show_gui_and_exit
          + and -g flag is not set
            - exits with error

    + deactivate (calls unset_interval and unset_current)
      - calls system.unset_interval
      + if system.unset_interval fails
        - stops at that point (unset_current) is not called
        - returns with error
      + if system.unset_interval succeeds
        - calls unset_current

    + install (installs zip file into path)
      [...]
    + upgrade -- important
      [...]
    + versions
      + this, set, current
      [...]
    + settings
      + read, update, toggle
      [...]
    + account
      + verify, signup, setup
      [...]
    + hooks
      + post_install, pre_uninstall
      [...]
    + check
      [...]
    + gui
      + if sudo
        - fires up gui
      + if no sudo
        - shows onscreen message
        - prints error message in console
        - returns exit code

   -----------

  + functions
    + set_up_version
      + if config dir does not exist
        + and no write permissions
          - it exists with error
        + and with write permissions
          - it creates dir
      + with existing config path
        - syncs config
        - calls versions.set_current

    + unset_current
       - calls versions.unset_current
       + if versions.unset_current fails with ENOENT
         - does not return error

    + activate_new_version
      [...]

    + check_installation
      [...]

    + run_agent
      [...]

    + show_gui_and_exit
      [...]

= lib/conf/versions_spec

  + latest()
    [...]

  + this()
    [...]

  + current()
    [...]

  + list()
    [...]

  + set_current()
    [...]

  + unset_current()
    + if current symlink exists
      - removes symlink
    + if current symlink does not exist
      - does not throw error

  + remove()
    [...]

= lib/conf/remote_spec

  + authorize()
    [...]

  + verify()
    [...]

  + signup()
    [...]

= lib/conf/package_spec

  + check_latest_version()
    [...]

  + get_latest()
    [...]

  + get_version()
    [...]

  + download_release()
    [...]

  + download()
    [...]  

  + install()
    [...]

===============================================
 agent
===============================================

= lib/agent/cli_controller_spec

  + when config file does not exist
    - returns an error
    - does not run agent
  + signals
    + when SIGUSR1 signal is received
      - should call agent.engage()
      - should pass 'network' argument to engage()
    + when SIGUSR2 signal is received
      - should call agent.engage()
      - should pass 'network' argument to engage()
    + when SIGINT signal is received
      - should not terminate process
    + when SIGINT signal is received
      - should not terminate process
    + when SIGINT signal is received
      - should not terminate process
  + events
    + on exit
      - calls agent.shutdown
      + if agent is running
        - removes pid
      + if agent is not running
        - does not try to remove pid
    + on uncaughtException
      - exits with status code 1
      + and send_crash_reports in config is true
        - sends exception to endpoint
      + and send_crash_reports in config is false
        - does not send shit. 
  + when pid.store returns an existing pidfile
    + and pidfile creation time (process launch time) is later than two minutes ago
      - it exits with status code 0
    + and pidfile creation time is earlier than two minutes ago
      + and this instance was launched by network trigger
        - it sends SIGURS2 signal to other process
      + and this instance was launched by interval (cron, cronsvc)
        - it sends SIGUSR1 signal to other process
      - it exists with status code 10
  + when no existing pidfile is found
    - it stores the pid of the process in file
    - it calls agent.run()

= lib/agent/index -- importante

  + run()
    + when run on interval
      + and os is windows
        - should not wait
      + and os is NOT windows
        - should wait a random number of seconds
    + when run not on interval
      - should not wait
    - it should call initialize() after timeout

  + initialize()
    - should write header
    + when command was passed as argument
      - it should run command 
      - it should stop further execution (dont callback)
    + when skip-connection flag was passed
      - it should not check_connection()
      - it should callback
    
    + when no skip-connection flag was passed
      - it should check status of connection
      + if no connection is available
        - it should not check for updates
        - it should callback(false)

      + if connection is available
        + and can_update() return false
          - it should not check for updates
          - it should callback(true)
        + and can_update() returns true
          - it should check for updates 

    + when checking for updates
      + if no version was found
        - it should callback(true)
      + if new version was installed
        - it does not callback
        - it triggers a 'new_version' event
        - it calls agent.shutdown()


  + engage()
    [...]

  + check_connection()
    [...]


  + shutdown()
    [...]



= lib/agent/common
   [...]

= lib/agent/actions
   [...]

= lib/agent/dispatcher
   [...]

= lib/agent/hooks
   [...]

= lib/agent/loader
   [...]

= lib/agent/logger
   [...]

= lib/agent/providers
   [...]

= lib/agent/reports
   [...]

= lib/agent/transport (maybe not needed)
   [...]

= lib/agent/tunner
   [...]

= lib/agent/updater -- important
  [look for test/conf/updating_spec]
  [...]

= lib/agent/drivers
  [...]

= lib/agent/providers
  [...]

= lib/agent/reports
  [...]

= lib/agent/transports
  [...]

= lib/agent/triggers
  [...]

===============================================
 system
===============================================

= lib/system/index_spec

  + get_logged_user()

  + tempfile_path()

  + spawn_as_logged_user()

  + run_as_logged_user()

  + get_running_user()

  + get_os_info() -> get_os_version + get_os_name

  + set_interval()

  + unset_interval()

  + process_running() -> proxy to os function

  + auto_connect() -> proxy to os_function

= lib/system/paths_spec

  + when installed under a versions folder
    + and current folder is a symlink
      - paths.package should == [path]
      - paths.install should == [path]
      - paths.current should == [path]
      - paths.versions should == [path]
      - paths.package_bin should == [path]
      - paths.current_bin should == [path]

    + and current folder is not a symlink (WinXP)
      - paths.package should == [path]
      - paths.install should == [path]
      - paths.current should == [path]
      - paths.versions should == [path]
      - paths.package_bin should == [path]
      - paths.current_bin should == [path]  

  + when not installed under a versions folder (eg. via npm)
    - paths.package should == [path]
    - paths.install should == [path]
    - paths.current should == [path]
    - paths.versions should be undefined
    - paths.package_bin should == [path]
    - paths.current_bin should == [path]

= lib/system/mac/airport_spec 

= lib/system/mac/delay_spec 

= lib/system/linux/delay_spec 

= lib/system/linux/sudo_spec 

= lib/system/windows/registry_spec 

= lib/system/windows/wmic_spec 

===============================================
 utils - quizas operetta sea lo mas important
===============================================

===============================================
 currently
===============================================

on config activate
  should load lib/conf/cli.js

  [./bin/prey] config activate
    ✓ Should load `lib/conf/cli.js` on `config activate` command
    ✓ Should not do anything if `process.env.BUNDLE_ONLY is on` (190ms)
    1) Should setup version and interval on `controller#activate` call`
    2) Should `install` a new version, and update the system

  Execution of [./bin/prey]
    ✓ Should execute the agent if no parameters are given to [./bin/prey]
    ✓ Should exit when there is not a config file (279ms)
    ✓ Should exit if there is not an API key in the config file (275ms)
    3) Should exit if there is not internet connection
    - E
    - F
    - G

  scripts/create_user.js
    #create_user()
      ✓ Should exit when no username is given
      4) Should create a user, given the username
      5) Should exit if it is executed with a user different than root
      6) Should exit if user already exists
    #grant_privileges()
      7) Should find the sudoers.d file and that it has the right privileges
      8) Should, as <test_user>, impersonate the existing user
      9) Should, as <test_user>, be unable to impersonate if the sudoers file doesn't exist
