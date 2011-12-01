== Prey NodeJS client

It rocks.

== Installation

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
