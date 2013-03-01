 == Installation

 - We should test 'config activate' under different conditions. It is essential to make Prey work (e.g. 'current' dir is created as well as log file).
 - We should test OS install/uninstall hooks under different conditions. They are also necessary for installations and updates to be completed.

 == Main/Execution

 - What happens when bin/prey is called without params (cli.js should be called).
 - What happens when bin/prey is called with params.
 - What happens when the client is run but there's no config file.
 - When the client runs and there is config file but no API/device key set.
 - When the client runs and there is no internet connection.
 - We should test execution in different paths. The client should run regardless of where it is installed.
 - What happens when the SIGUSR signal is received, and the client
has lost its internet connection.
 - We should test that console.log() is never called when running as system user (no console access).
 
 == Agent/Connection

 - Common.js. Check that it exports all what the different modules require from it.
 - Connection. What happens when DNS fails (should we use a fallback?), or Google is down, or connecting via proxy, etc.
 - Auto connect. What happens on different conditions (no NetworkManager, no Wifi card, etc).

 == Drivers
 - What happens when a driver that does not exist is requested via cli arguments.
 - What happens when a driver that does not exist is requested by the config file. Should we exit or switch back to the first one that's present?
 - What happens when a driver raises an exception when loading.
 - What happens when request to Control Panel fails.
 - What happens when first request succeeds, then second request fails.

 == Reporting

 - What happens when a report is requested.
 - What happens when the client is reported missing, sends one report, then loses internet connection, and tries to send a second one.
 - What happens when a report is requested and the endpoint returns an error.

  == Actions

 - What happens when an action is running that does not require
 - What happens when an action is triggered twice (edge case but may happen).
 - What happens when an action that is not running is stopped.

 == System/Utils

 - Test existence of paths just to make sure we don't break anything in the future.
 - Basic tests to pidfile/finder/unzip.
 - More extensive tests to as_current_user. Lots of actions depend on it.

 == Account config

 - What happens when run and config file does not exist.
 - What happens when run with no write permission to config file.
 - Authorize/verify/signup: What happens when the endpoint is down.
 - Authorize/verify/signup: What happens when the HTTP request times out.
 - Authorize/verify/signup: What happens when the data is not valid.

 == Updating

 - What happens when a new version is found but the package is not.
 - What happens when a package is downloaded but no write permission to unzip it.
 - When the package is unzipped but an error ocurrs while copying.
 - If the update process is cut in the middle (e.g. shutdown), how do we recover from it?
 - Test that the parent/child disconnection works under different conditions.

 == Other

  - hooks.js, helpers.js, dispatcher.js, tunnel.js.
