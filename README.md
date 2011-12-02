== Prey NodeJS client

It rocks.

== Installation

npm install prey

== Modules

There are two main kind of modules: info modules and action modules.

- Info modules: emit traces of information upon request. Singletons.
  - Core info modules: system, network, geo. 
    - Used by various sections of Prey (Register, Report, Request, Discovery).
  - Optional info modules: webcam, screenshot, running programs, modified files, traceroute.

- Action modules: perform tasks exposing start() and (optinally) stop() methods. Do not return stuff.
  - Persistent actions: lock, terminal, desktop, filebrowser.
    - These normally depend on child processes or listening servers, and run until the user cancels the action.
    - Should return (1) whether the process was succesfully launched and (2) when it is finished.
  - Long running actions: file retrieval (search and upload), wipe (file deletion).
    - Should return whether the task is being run and when it is finished.
  - Fire and forget actions: alarm, alert, standby, shutdown.
    - Should return whether the task was succesfully ran or not.

Ok so we have info modules and action modules.

== Messaging

Prey should be able to receive specific instructions, so that it's able to fetch 
specific bits of information or run specific actions. These commands could (and
probably should) contain information about how to process the instruction. An initial 
draft of different requests that could be made:

 - send_reports (interval, options)
   - i.e. send_reports(10, {screenshot: false, picture: true})
 - get_info (what, options)
   - i.e. get_info('modified_files', {path: '/home/', from: 5.minutes.ago})
 - run_action (which, options)
   - i.e. run_action('alarm', {sound: 'siren.mp3', loops: 3})

== Hooks

initialized
loop_start
no_connection
fetch_start
fetch_end
actions_start
actions_end
report_start
report_end
[module_name]_start
[module_name]_end
message_received
message_sent
loop_end
shutdown

== Todo

- Define the way that third-party modules will be included.
 -> Possible implementations: Haraka, Hubot
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

Copyright © 2010, Fork Ltd.
Released under the GPLv3 license.
For full details see the LICENSE file included in this distribution.
