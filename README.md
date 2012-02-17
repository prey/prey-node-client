### Prey Node.js client

Event-driven client for the Prey anti-theft software. In pure javascript.

## How it works


## Requirements



## Installation

Use `npm`. Global scope [is recommended|#] as the intended usage is to be run via command line.

    npm install -g prey

Then you can call it through a terminal and Prey will take of setting everything up. This includes setting up a cron job under the running user, generating SSL keys and loading the network trigger script which will invoke it whenever a network change is detected.

    $ prey

If you wish to use another driver, simply call Prey using -s (for setup) and -d (with the name of your chosen driver). For instance:

    $ prey -s -d campfire

This will ask for the campfire driver's config values and set it as the default driver to use.

## Configuration

Prey keeps a set of config files plus the generated SSL keys in its configuration path, which defaults to /etc/prey (Mac, Linux) or C:\Windows\Prey (Windows). You can call Prey with a -p (path) argument in case you wish to run Prey using a different path for the config files. (Note: this only affects at run time, so if you wished to change it permanently you should modify the cron line plus the network trigger script).

When Prey is run and it doesn't find a config.js file in that path, it will attempt to copy a default config.js file and run the setup process for the driver that's being used. The driver defaults to 'control-panel'.

## How to run

Prey runs automatically by being called either through cron or the network trigger daemon. However if you want to run it and play around you can call it command line arguments. Let's say you wanted to try the console driver:

``` sh
$ prey -d console
```

And play around for a while! For additional command line options, type:

``` sh
$ prey -h
```

## Plugins

Except for the agent itself --who acts as a controller -- everything on the Prey Node.js client is a plugin. There are four kinds of them: drivers, providers, actions and transports.

## Credits

Written by Tomás Pollak.

## Legal

Copyright © 2011, Fork Ltd.
Released under the GPLv3 license.
For full details see the LICENSE file included in this distribution.
