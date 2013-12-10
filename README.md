# Prey Node.js client

Asynchronous, ruthless event-driven client for the [Prey anti-theft software](http://preyproject.com), based on Node.js.

## What is Prey?

Good question.

In plain klingon, Prey is a command-line application that runs in the background and regularly checks whether it should perform an action or send any data to a specified endpoint. These commands can be triggered using different methods,
the most common being through the Prey Control Panel.

## Requirements

This client requires Node (version 0.6 or above) and (optionally) `npm`. Since Node.js has been natively ported to Windows,
this means it can run on OSX, Linux and -- that's right -- Windows. In Linux we do require a few packages in order to
work: `dmidecode`, `streamer (xawtv)`, `scrot` and `mpg123`.

## Installation

### Installing from official packages

We're not there yet but we'll provide one-click packages in the near future. Keep on reading if you feel brave enough!

### Installing via NPM

[npm](http://npmjs.org) is the official package manager for [Node.js](http://nodejs.org). Like rubygems for Ruby.

In case you haven't, you need to install Node on your system by [downloading the installer](http://nodejs.org/dist/latest/)
for your platform. `npm` is now installed as part of Node so once the install is through, you can open up a terminal and
run:

    $ [sudo] npm install -g prey

This will install the Prey package from npm's repository and fetch all the necessary dependencies. The `-g` argument
instructs `npm` to install the package on a [global, shared path](http://blog.nodejs.org/2011/03/23/npm-1-0-global-vs-local-installation/) 
rather than a local one (e.g. your home folder). This is because Prey is meant to be run as a system user rather than a 
local one. 

If you want `npm` to automatically run Prey's post install script, you must issue the flag `unsafe-perm` ( [see for reference: https://npmjs.org/doc/misc/npm-config.html#unsafe-perm](https://npmjs.org/doc/misc/npm-config.html#unsafe-perm)) into your `npm` command, like this:

    $ [sudo] npm install -g --unsafe-perm prey
    
This script will do three things:

  - install dependencies,
  - install system scripts, 
  - achieve nirvana.

Once that's done, you can finish the installation by calling up the GUI:

    $ prey config gui

And that's it. 

## Playing around

Prey runs automatically by being called either through cron or the network trigger daemon. However if you want to run it
and play around you can call it command line arguments.

If you wish to use another driver, simply call Prey using the `-d` argument, with the name of your driver of choice.
For instance:

    $ prey -d console

For additional command line options, type:

    $ prey -h

## Configuration

Prey keeps a set of config files plus the generated SSL keys in its configuration path, which defaults to /etc/prey 
(Mac, Linux) or C:\Windows\Prey (Windows). You can call Prey with a -p (path) argument in case you wish to run Prey using
a different path for the config files. (Note: this only affects at run time, so if you wished to change it permanently
you should modify the daemon init script).

## Authors

Tomás Pollak

## Credits

To Robert Harder for the ImageSnap OSX utility.

## Legal

Copyright © 2012, Fork Ltd.
Released under the GPLv3 license.
For full details see the LICENSE file included in this distribution.
