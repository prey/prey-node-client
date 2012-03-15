# Prey Node.js client

Asynchronous, event-driven client for the [Prey anti-theft software](http://preyproject.com), written in Node.js.

## What is Prey?

Good question.

In plain klingon, Prey is a command-line application that runs in the background at specific times to check whether it should send data, perform any actions or just go back to sleep. These actions can be triggered using different methods, the most common being by using the Prey Control Panel.

## How it works

In principle, this client works in a very similar way to the [Bash client](https://github.com/prey/prey-baash-client). The script is called at regular intervals via Cron (Mac, Linux) or CronSVC (a Windows System Service), and in addition whenever a network change is detected in the system.

Network events are triggered whenever an interface goes down or up, e.g. when the system boots up, when the laptop's lid is opened, or when the computer connects to a different Wifi network.

In addition, this client includes a number of new features such as the ability to use different drivers for fetching data or triggering actions. One example is the Campfire driver, which masks Prey as a chat bot and lets you control it simply by chatting with it, very much like Github's Hubot.

## Requirements

This client requires Node (version 0.6 or above) and (optionally) NPM. Since Node.js has been natively ported to Windows, this means it can run on OSX, Linux and Windows as well. We're all on the same boat.

## Installation

### Installing from official packages

We're not there yet but we'll provide one-click packages in the near future. Keep on reading if you feel brave enough!

### Installing via NPM

[NPM](http://npmjs.org) is the official package manager for [Node.js](http://nodejs.org). Like rubygems for Ruby.

In case you haven't, you need to install Node on your system by [downloading the installer](http://nodejs.org/dist/latest/) for your platform. NPM is now installed as part of Node so once the install is through, you can open up a terminal and do:

    [sudo] npm install -g prey

This will install the Prey package from NPM's repository and fetch all the necessary dependencies. The `-g` argument instructs `npm` to install the package on a global (shared) path rather than a local one (e.g. your home folder). This is because Prey is meant to be run as a system user, not a local one. As the NPM folks [say](http://blog.nodejs.org/2011/03/23/npm-1-0-global-vs-local-installation/):

    If you’re installing something that you want to use in your shell, on the command line or something, install it globally, so that its binaries end up in your PATH environment variable.

NPM will automatically run Prey's post install script, which will do four things:

  - install system scripts (the network trigger daemon),
  - run the script for the first time, so that the cron entry is set,
  - and achieve nirvana.

Done!

## Playing around

Once installed, you can call Prey through a terminal and it will take of setting everything up by asking you a couple of questions.

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

Copyright © 2012, Fork Ltd.
Released under the GPLv3 license.
For full details see the LICENSE file included in this distribution.
