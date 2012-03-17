# Prey Node.js client

Asynchronous, event-driven client for the [Prey anti-theft software](http://preyproject.com), written in Node.js.

## What is Prey?

Good question.

In plain klingon, Prey is a command-line application that runs in the background at specific times to check whether it
should send data, perform any actions or just go back to sleep. These actions can be triggered using different methods,
the most common being by using the Prey Control Panel.

## How it works

In principle, this client works in a very similar way to the [Bash client](https://github.com/prey/prey-bash-client). The
script is called at regular intervals via Cron (Mac, Linux) or CronSVC (a Windows System Service), and in addition
whenever a network change is detected in the system.

Network events are triggered whenever an interface goes down or up, e.g. when the system boots up, when the laptop's lid
is opened, or when the computer connects to a different Wifi network.

In addition, this client includes a number of new features such as the ability to use different drivers for fetching data
or triggering actions. One example is the Campfire driver, which disguises Prey as a chat bot and lets you control it by 
chatting with it, very much like Github's [Hubot](http://hubot.github.com).

## Requirements

This client requires Node (version 0.6 or above) and (optionally) `npm`. Since Node.js has been natively ported to Windows,
this means it can run on OSX, Linux and -- that's right -- Windows. In Linux we do require a few packages in order to
work: `hwinfo`, `streamer` `(xawtv)`, `scrot` and `mpg123`.

## Installation

### Installing from official packages

We're not there yet but we'll provide one-click packages in the near future. Keep on reading if you feel brave enough!

### Installing via NPM

[npm](http://npmjs.org) is the official package manager for [Node.js](http://nodejs.org). Like rubygems for Ruby.

In case you haven't, you need to install Node on your system by [downloading the installer](http://nodejs.org/dist/latest/)
for your platform. `npm` is now installed as part of Node so once the install is through, you can open up a terminal and
run:

    $ [sudo] npm install -g prey

This will install the Prey package from NPM's repository and fetch all the necessary dependencies. The `-g` argument
instructs `npm` to install the package on a [global, shared path](http://blog.nodejs.org/2011/03/23/npm-1-0-global-vs-local-installation/) 
rather than a local one (e.g. your home folder). This is because Prey is meant to be run as a system user, not a 
local one. 

NPM will automatically run Prey's post install script, which will do three things:

  - install dependencies for plugins that require them,
  - install system scripts (i.e. the network trigger daemon),
  - and achieve nirvana.

Once done, you can call Prey through a terminal and it will take of setting the driver up by asking you a couple of
questions:

    $ prey

And that's it. If everything went well, you can now begin controlling your device remotely through your chosen driver.

## Playing around

Prey runs automatically by being called either through cron or the network trigger daemon. However if you want to run it
and play around you can call it command line arguments.

If you wish to use another driver, simply call Prey using the `-d` argument, with the name of your driver of choice.
For instance:

    $ prey -d console

If you wish to change the default driver to use at runtime, use the `-s` argument in addition to `-d` and you'll be 
prompted to set it up. For additional command line options, type:

    $ prey -h

## Configuration

Prey keeps a set of config files plus the generated SSL keys in its configuration path, which defaults to /etc/prey 
(Mac, Linux) or C:\Windows\Prey (Windows). You can call Prey with a -p (path) argument in case you wish to run Prey using
a different path for the config files. (Note: this only affects at run time, so if you wished to change it permanently
you should modify the cron line plus the network trigger script).

When Prey is run and it doesn't find a config.js file in that path, it will attempt to copy a default config.js file and
run the setup process for the driver that's being used. The driver defaults to 'control-panel'.

## Plugins

Except for the agent itself --who acts as a controller -- everything on this client works as a plugin. There are
four kinds of them: drivers, providers, actions and transports. For more information about creating your plugins or 
extending the existing ones, take a look at [HACKING.md](http://github.com/prey/prey-node-client/master/HACKING.md).

## TODO

Spec the crap out of this thing. I began writing some of them but since the API is still in the works the plan is to
retake the challenge once it stabilizes a bit. Feel free to give your opinion on how it could be improved. Good ideas 
get a free cookie!

Also:

 - Finalize Windows support. There are still a couple of things missing.
 - Fix some of the actions which haven't been upgraded to used the current plugin API.
 - Add support for missing OS's to specific actions and providers (i.e. motion/sound detectors only work on OSX now).
 - Add auto-complete support for the Console driver. Would make testing much easier.

## Authors

Tomás Pollak

## Credits

To Robert Harder for the ImageSnap OSX utility.

## Legal

Copyright © 2012, Fork Ltd.
Released under the GPLv3 license.
For full details see the LICENSE file included in this distribution.
