# Prey Node.js client
[![Gitter](https://badges.gitter.im/Join Chat.svg)](https://gitter.im/prey/prey-node-client?utm_source=badge&utm_medium=badge&utm_campaign=pr-badge&utm_content=badge)

Asynchronous, ruthless event-driven client for the [Prey anti-theft software](http://preyproject.com), based on Node.js.

## What is Prey?

Good question.

In plain klingon, Prey is a command-line application that runs in the background
and regularly checks whether it should perform an action or send any data to a
specified endpoint. These commands can be triggered using different methods,
the most common being through the Prey Control Panel.

## Requirements

This client requires Node (version 0.6 or above) and (optionally) `npm`.
Since Node.js has been natively ported to Windows, this means it can run on OSX,
Linux and -- that's right -- Windows. In Linux we do require a few packages in
order to work, like `dmidecode`, `streamer (xawtv)`, `scrot` and `mpg123`.

## Installation

### Installing from official packages

To try out the official packages, please log in to your [Prey account](http://preyproject.com)
and select the "Try the new Beta" option. You'll see a screen with the list of packages.

### Installing via NPM

Installing via [npm](http://npmjs.org) let's you set up the client directly by
unpacking a ZIP file from the NPM repository.

Unlike the official packages, the NPM ones do not contain the Node binary and
auto-updating is disabled, given that a) you should already have Node in your
system for NPM to work, and b) NPM is, after all, a package manager. So you'll
be responsible for doing `npm update -g prey` later. :)

Up for it? Great. If you still havent't, you need to install Node on your system
by [downloading the installer](http://nodejs.org/dist/latest/) for your platform.
`npm` is installed as part of Node so once the install is through, you can open
up a terminal and run:

    $ [sudo] npm install -g prey

This will install the Prey package from npm's repository and fetch all the necessary
dependencies. The `-g` argument instructs `npm` to install the package on a
[global, shared path](http://blog.nodejs.org/2011/03/23/npm-1-0-global-vs-local-installation/)
rather than a local one (e.g. your home folder). This is because Prey is meant
to be run as a system user rather than a local one.

This script will do three things:

  - install dependencies,
  - install system scripts,
  - achieve nirvana.

Once that's done, you can finish the installation by calling up the GUI:

    $ prey config gui

Or if you're more fond of CLI than GUI, or want to see the full list of options,
then go simply with:

    $ prey config

That's it.

## Playing around

Prey runs automatically by system init scripts (Windows Service, LaunchDaemon,
upstart/systemd, etc). However if you want to run it and play around you can
call it command line arguments.

A cool way to see the stuff that this baby can do is to try run Prey using the
console plugin:

    $ prey console

Or if you want to trigger an action directly from the command line, you can do:

    $ prey -r "start alarm"

For the full list of runtime options, type:

    $ prey -h

## Configuration

Prey keeps a set of config files plus the generated SSL keys in its configuration path, which defaults to /etc/prey
(Mac, Linux) or C:\Windows\Prey (Windows). You can call Prey with a -p (path) argument in case you wish to run Prey using
a different path for the config files. (Note: this only affects at run time, so if you wished to change it permanently
you should modify the daemon init script).

## Updating and Edge

Unless you installed via NPM, Prey will check whether new versions are available if the `auto_update` config option is 
set to true. By default, this checks on our stable branch for updates, but if you wish to keep up with the latest bleeding
edge releases, you can optionally set the `download_edge` option on the config file to true. If so, Prey will check against 
our edge branch so you'll be running the latest and greatest, before everyone else.

Note: This means you'll be running non-stable versions, but you'll also be helping us detect bugs and exterminate them 
much quicker.

## Contributing 

Yes, contributions are more than welcome, as long as you don't plan to include a keylogger or something of the likes.

Just make sure to add tests for your feature or bugfix, so we don't break it in a future version unintentionally. Once you're ready, submit a pull request and we'll get your code onboard.

## Authors

By Tomás Pollak, with the help of contributors.

## Credits

 - To Robert Harder for the ImageSnap utility for OS X.
 - To Michael Hipp for mpg123.
 - And to all the Node.js developers for their awesome modules (async, connect, rimraf, etc).

## Legal

Copyright © 2011-2014, Fork Ltd.
Released under the GPLv3 license.
For full details see the `license.txt` file included in this distribution.
