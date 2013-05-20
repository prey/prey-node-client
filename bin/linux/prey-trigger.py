#!/usr/bin/env python
#######################################################
# Prey Trigger - (c) 2011 Fork Ltd.
# Written by Tomas Pollak <tomas@forkhq.com>
# Licensed under the GPLv3
#######################################################

# import os
import sys
import shlex
from subprocess import Popen, call, PIPE, STDOUT
from getpass import getuser
from optparse import OptionParser

import gobject
import dbus
from datetime import datetime, timedelta
from dbus.mainloop.glib import DBusGMainLoop

debug = True
min_interval = 2 # minutes
# log_file = "/var/log/prey.log"
command_env = {'TERM': 'xterm', 'TRIGGER': 'true', 'USER': getuser()}
run_at_startup = True
prey_bin = '/usr/lib/prey/current/bin/prey'

parser = OptionParser()
parser.add_option("-b", "--bin", help="Path to Prey bin")
parser.add_option("-s", action="store_true", dest="skip_startup")
(options, args) = parser.parse_args()

if options.skip_startup:
  run_at_startup = False

if options.bin:
  prey_bin = options.bin

#######################
# helpers
#######################

def connected():
	return (nm_interface.state() == 3 or nm_interface.state() == 70)

def log(message):
	print(message)
	if debug:
		shout(message, True)

# only for testing purposes
def shout(message, wait = False):
	args = shlex.split("echo '" + message + "' | espeak 2> /dev/null")
	p = Popen(args)
	if wait:
		p.wait()

def run_prey():
	global run_at
	two_minutes = timedelta(minutes=min_interval)
	now = datetime.now()
	log("All hail the master of the universe")
	if (run_at is None) or (now - run_at > two_minutes):
		log("The vulture has flown")
		try:
			p = Popen(prey_bin, stdout=PIPE, stderr=PIPE, env=command_env)
			run_at = datetime.now()
			os.wait()
			log("Elvis has left the building")
		except OSError, e:
			print "\nWait a second! Seems we couldn't find Prey at " + prey_bin
			print e
			sys.exit(1)

#######################
# event handlers
#######################

def network_state_changed(*args):
	# log("Network change detected")
	if connected():
		run_prey()

#def system_resumed(*args):
#	alert("System resumed")
#	run_prey()

#######################
# main
#######################

if __name__ == '__main__':

	# log("Initializing")
	run_at = None

	# Setup message bus.
	bus = dbus.SystemBus(mainloop=DBusGMainLoop())

	# Connect to StateChanged signal from NetworkManager
	try:
		nm = bus.get_object('org.freedesktop.NetworkManager', '/org/freedesktop/NetworkManager')
		nm_interface = dbus.Interface(nm, 'org.freedesktop.NetworkManager')
		nm_interface.connect_to_signal('StateChanged', network_state_changed)
	except dbus.exceptions.DBusException:
		print "NetworkManager DBus interface not found! Please make sure NM is installed."
		sys.exit(1)

	if run_at_startup and connected():
		run_prey()

	# upower = bus.get_object('org.freedesktop.UPower', '/org/freedesktop/UPower')
	# if upower.CanSuspend:
	# upower.connect_to_signal('Resuming', system_resumed, dbus_interface='org.freedesktop.UPower')

	loop = gobject.MainLoop()
	loop.run()
