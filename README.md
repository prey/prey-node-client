== Prey NodeJS client

It rocks.

== Installation

npm install prey

Then you need to configure your device/API keys in the config.js file. You can
also not set up those keys and use your own server by setting the correct check
url (you can use more than one, by the way).

== How to run

$ node prey

== Plugins (a.k.a. Actions)

Plugins perform tasks exposing start() and (optionally) stop() methods. Do not return stuff.

  - Persistent actions: lock, terminal, desktop, filebrowser.

    - These normally depend on child processes or listening servers, and run until the user cancels the action.
    - Should return (1) whether the process was succesfully launched and (2) when it is finished.

  - Long running actions: file retrieval (search and upload), wipe (file deletion).
    - Should return whether the task is being run and when it is finished.

  - Fire and forget actions: alarm, alert, standby, shutdown.
    - Should return whether the task was succesfully ran or not.

== Triggers

Plugins can also export hooks and events. If a loaded plugin advertises an event,
then the process is kept running until the event is fired. Examples for triggers
include: wifi_network_change, low_battery_detected, latest_win_iso_being_downloaded,
you know, whatever.

When an event is triggered then a hook is fired for all listening plugins to take
action. Unlike base hooks (i.e. report_sent), these triggers are also passed to
Notifier so that the user can take action as well.

A plugin can also subscribe to a hook in order to do something about it. For
example,you could wait for a wifi_network_change and in case you get "Starbucks"
you could use text-to-speech to shout a message and wait for the hero of the hour
to go after the guy and get your PC back. Be creative!

After all plugins are loaded, Prey will check whether the subscribed-to hook is
indeed advertised by someone else. If it isn't, then the hook will be removed as
there is no point in keeping the process running if nothing will ever happen.

== Messaging

Prey should be able to receive specific instructions, so that it's able to fetch
specific bits of information or run specific actions. These commands could (and
probably should) contain information about how to process the instruction. An
initial draft of different requests that could be made:

 - send_reports (interval, options)
   - i.e. send_reports(10, {screenshot: false, picture: true})
 - get_info (what, options)
   - i.e. get_info('modified_files', {path: '/home/', from: 5.minutes.ago})
 - run_action (which, options)
   - i.e. run_action('alarm', {sound: 'siren.mp3', loops: 3})

== Providers

 - Providers provide information on request. They return the result as a callback.

	var Network = require('network');
	Network.get('active_wifi_network', function(result){
		console.log("Current wifi network: " + result);
	};

== Hooks

initialized
loop_start
no_connection
fetch_start
fetch_end
actions_start
actions_end
report_start
report_ready
report_sent
[module_name]_start
[module_name]_end
command_received
command_sent
loop_end
shutdown

== Events

These are bits the information we need to inform about.

- action_run (successful or not)
- client_updated (succesful or not)
- delay_updated (succesful or not)
- config_updated (succesful or not)
- event_triggered (from action) -> motion sensor, etc.

== Todo

- Define the way transports are configured, either globally or specifically
  for report vs. data vs. event/trigger notifications.
- Test hooks. The point is that Main itself should register hooks to be notified
  when asynchronous stuff happens. i.e. when a hardware scan is triggered through
  On Demand we shouldn't need to register an event for *that* call, the function
  should be called and the main hook should take care of sending a notification.
- Define the way that third-party modules will be included.
 -> Possible implementations: Haraka, Hubot, Hook.io
- How will we handle exceptions? We should probably set up a server
  to keep track of what's happening. We can set up something like
  node-telemetry server to store exceptions sent by the clients, obviosly
  without using authentication so the data is kept anonymous.
  We can also use the nlogger logging system that keeps track of modules
  and line numbers on the output.
- Some kind of authentication (probably using 1 time passwds) for tunnel modules.
 -> github.com/markbao/speakeasy module may help.
- Decide whether prey.js will keep running all the time or not.
 -> Pros: We can keep the config stored in memory, without needing to
    save stuff to the config file. First request should be empty and
    from then on, Prey will know whether to send extended headers or not,
    depending on the instructions received on each response.
 -> Cons: Mem usage?
 -> We can use the forever module for this.


== Legal

Copyright © 2011, Fork Ltd.
Released under the GPLv3 license.
For full details see the LICENSE file included in this distribution.
