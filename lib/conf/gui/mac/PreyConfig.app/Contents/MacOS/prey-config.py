#!/usr/bin/python
# coding: utf-8

############################
# Prey OSX Configurator
# Copyright (c) Fork Limited
# Written by Tomás Pollak
# GPLv3 Licensed
############################

import os
import re
import sys
import argparse
import json
import shlex
from subprocess import Popen, call, PIPE, STDOUT

from time import sleep
from PyObjCTools import AppHelper
from AppKit import *

################################################
# base settings, strings, etc

FORCE_CONFIG = len(sys.argv) > 1 and (sys.argv[1] == '-f' or sys.argv[1] == '--force')
DEBUGGING = False

APP_NAME  = 'Prey Configurator'
HEIGHT = 400
WIDTH  = 500
CENTER = WIDTH/2

EMAIL_REGEX = "^.+\\@(\\[?)[a-zA-Z0-9\\-\\.]+\\.([a-zA-Z]{2,7}|[0-9]{1,3})(\\]?)$"

TABS = ['welcome', 'new_user', 'existing_user', 'success']

TITLES = {
  'welcome'       : "Greetings, good friend. Please choose your destiny.",
  'new_user'      : "Please type in your info and we'll sign you up for a new Prey account.",
  'existing_user' : "Please type in your Prey account credentials.",
  'success'       : "Sweet! Your computer is now protected by Prey. To try it out or to start tracking it, please visit preyproject.com."
}

OPTIONS = {
  'new'           : "Choose this option if this is the first time you've installed Prey.",
  'existing'      : "If you've already set up Prey on this or another device."
}

################################################
# paths and such

SCRIPT_PATH = sys.path[0]

def find_in_path(file):
  segments = SCRIPT_PATH.split('/')
  path = segments.pop()

  while (path and path != ''):
    full_path = os.path.join('/'.join(segments), file)
    # print "Checking %s" % full_path
    if os.path.exists(full_path):
      return full_path
    else:
      path = segments.pop()

ICON_PATH    = SCRIPT_PATH + '/../Resources/prey.icns'
PREY_BIN     = find_in_path('bin/prey')
PIXMAPS      = find_in_path('pixmaps')
PACKAGE_JSON = find_in_path('package.json')

PACKAGE_INFO = json.loads(open(PACKAGE_JSON, 'r').read())
VERSION      = PACKAGE_INFO['version']

CHECK_ICON   = PIXMAPS + '/conf/check.png'
LOGO         = PIXMAPS + '/prey-text-shadow.png'
LOGO_WIDTH   = 280
LOGO_HEIGHT  = 55

################################################
# helpers

def debug(str):
  if DEBUGGING:
    print str

def speak(str):
  script = NSAppleScript.alloc().initWithSource("say \"#{str}\"")
  script.performSelector_withObject('executeAndReturnError:', nil)

def flatten(arr):
  rt = []
  for i in arr:
    if isinstance(i,list): rt.extend(flatten(i))
    else: rt.append(i)
  return rt

################################################
# the delegator

class ConfigDelegate(NSObject):

  def windowWillClose_(self, sender):
    self.terminate(sender)

  def applicationDidFinishLaunching_(self, sender):

    self.inputs = {}
    self.drawImage(LOGO, LOGO_WIDTH, LOGO_HEIGHT, CENTER-(LOGO_WIDTH/2), 320, self.window.contentView())
    self.drawButtons()
    self.drawTabs()

    # show this alert after rendering logo and labels. otherwise it looks weird.
    if PREY_BIN is None or not os.path.exists(PREY_BIN): # or !File.executable?(PREY_BIN)
      self.show_alert('Unable to locate prey executable in path. Cannot continue.')
      return self.terminate(None)

    if not FORCE_CONFIG and self.is_client_configured():
      self.show_success()
    else:
      self.setTab(0)

  def drawWindow(self):
    frame  = NSMakeRect(300, 200, WIDTH, HEIGHT)
    window = NSWindow.alloc().initWithContentRect_styleMask_backing_defer_(frame,
      # NSTexturedBackgroundWindowMask |
      NSTitledWindowMask |
      NSClosableWindowMask |
      NSMiniaturizableWindowMask, NSBackingStoreBuffered, 1)

    window.setTitle_(APP_NAME)
    window.setDelegate_(self)
    window.display()
    window.orderFrontRegardless()
    self.window = window

  # view is required as an argument, given that we draw images in different views
  def drawImage(self, file, width, height, x, y, view):
    imageView = NSImageView.alloc().initWithFrame_(NSMakeRect(x, y, width, height))
    image     = NSImage.alloc().initWithContentsOfFile_(file)
    if not image:
      debug("Unable to load image: %s" % file)
      return

    imageSize = image.size()
    imageSize.width  = width
    imageSize.height = height
    image.setSize_(imageSize)
    imageView.setImage_(image)
    view.addSubview_(imageView)

  def drawButtons(self):
    self.prev = self.drawButton(NSMakeRect(300.0, 10.0, 80, 30), 'Previous', 'previous_tab')
    self.next = self.drawButton(NSMakeRect(400.0, 10.0, 80, 30), 'Next', 'next_tab')
    self.prev.setHidden_(True)
    self.window.makeFirstResponder_(self.next)

  def drawRadio(self, title, default, tag, width, height):
    checkbox = NSButton.alloc().initWithFrame_(NSMakeRect(94, 18, width, height))
    checkbox.setButtonType_(NSRadioButton)
    checkbox.setTitle_(title)
    checkbox.setState_(default)
    checkbox.setTag_(tag)
    return checkbox

  def drawChooser(self):
    cell = NSButtonCell.alloc().init()
    cell.setTitle_('Choose your destiny')
    cell.setButtonType_(NSRadioButton)

    frame  = NSMakeRect(50.0, 60.0, 100.0, 100.0)
    matrix = NSMatrix.alloc().initWithFrame_mode_prototype_numberOfRows_numberOfColumns_(frame,
      NSRadioModeMatrix,
      cell,
      2,
      1
    )

    matrix.setIntercellSpacing_(NSMakeSize(50, 50.0))
    font = NSFont.fontWithName_size_("LucidaGrande-Bold", 12)

    arr = matrix.cells()
    button = arr.objectAtIndex_(0)
    button.setTitle_('New user')
    button.setFont_(font)

    button = arr.objectAtIndex_(1)
    button.setTitle_('Existing user')
    button.setFont_(font)

    matrix.display()
    self.chooser = matrix
    return matrix

  def drawButton(self, rect, text, action):
    button = NSButton.alloc().initWithFrame_(rect)
    self.window.contentView().addSubview_(button)
    button.setBezelStyle_(NSTexturedRoundedBezelStyle)
    button.setTitle_(text)
    button.setTarget_(self)
    button.setEnabled_(True)
    button.setAction_(action)
    return button

  def drawLabel(self, text, rect):
    field = NSTextField.alloc().initWithFrame_(rect)
    field.setStringValue_(text)
    field.setBezeled_(False)
    field.setBordered_(False)
    field.setDrawsBackground_(False)
    field.setEditable_(False)
    return field

  def drawInput(self, type, id, title, x, y):
    klass = NSSecureTextField if type == 'password' else NSTextField
    label = self.drawLabel(title, NSMakeRect(x, y+30, 200, 15))
    input = klass.alloc().initWithFrame_(NSMakeRect(x, y, 200, 25))
    input.setBezelStyle_(NSTextFieldSquareBezel)
    input.setEditable_(True)
    input.setSelectable_(True)
    input.setEnabled_(True)
    input.setAction_('enter_pressed')
    self.inputs[id] = input
    return [label, input]

  def drawTextInput(self, id, title, x, y):
    return self.drawInput('text', id, title, x, y)

  def drawPasswordInput(self, id, title, x, y):
    return self.drawInput('password', id, title, x, y)

  def drawTab(self, name):
    tab = NSTabViewItem.alloc().initWithIdentifier_(name)
    tab.setLabel_(name)

    text = self.drawLabel(TITLES[name], NSMakeRect(15, 170, 420, 50))
    tab.view().addSubview_(text)

    if name == 'welcome':
      self.drawWelcome(tab, name)
    elif name == 'new_user':
      self.drawNewUser(tab, name)
    elif name == 'existing_user':
      self.drawExistingUser(tab, name)
    elif name == 'success':
      self.drawSuccess(tab, name)
    else:
      print 'Unknown tab name: ' + name

    return tab

  def drawTabs(self):
    tabs = NSTabView.alloc().initWithFrame_(NSMakeRect(15, 50, 470, 250))

    for name in TABS:
      tab = self.drawTab(name)
      tabs.addTabViewItem_(tab)

    tabs.setTabViewType_(NSNoTabsBezelBorder)
    self.window.contentView().addSubview_(tabs)
    self.tabs = tabs

  def getCurrentTab(self):
    item = self.tabs.selectedTabViewItem()
    return self.tabs.indexOfTabViewItem_(item)

  def setTab(self, index):
    self.tabs.selectTabViewItemAtIndex_(index)

  def getDestiny(self):
    row = self.chooser.selectedRow()
    num = 1 if row == 0 else 2
    return num

  def changeTab(self, dir):
    index = self.getCurrentTab()

    if index == 0: # first page
      self.prev.setHidden_(False)
      dir = self.getDestiny()
    elif index == 1 and dir == 1:
      dir = 2
    elif index == 2 and dir == -1:
      dir = -2
    elif (index == (len(TABS)-1) and dir == 1):
      return speak('Last page')

    target = index + dir

    if target == 0: # back to welcome
      self.prev.setHidden_(True)
    elif target == (len(TABS) - 1): # sending info
      return self.submit_data(index)

    self.setTab(target)

  def parse_error(self, line):
    if line is None or line == '':
      return 'Unexpected error. Please try again.'
    elif line.find('been taken') != -1:
      return 'Email has been taken. Seems you already signed up!'
    elif line.find('Unexpected status code: 401') != -1:
      return 'Invalid account credentials. Please try again.'

    return line

  def show_error(self, out):
    lines      = out.strip().split("\n")
    last_line = lines[len(lines)-1]
    message   = self.parse_error(last_line)
    self.show_alert(message)

  def show_alert(self, message):
   alert = NSAlert.alloc().init()
   alert.setMessageText_(message)
   alert.setAlertStyle_(NSCriticalAlertStyle)
   if icon:
    alert.setIcon_(icon)

   alert.runModal()

  def show_success(self):
    self.prev.setHidden_(True)
    self.next.setTitle_('Close')
    self.next.setAction_('terminate')
    self.setTab(len(TABS)-1) # last one

  def enter_pressed(self, sender):
    index = self.getCurrentTab()
    self.submit_data(index)

  def submit_data(self, index):
    if TABS[index] == 'new_user':
      self.user_signup()
    else:
      self.user_verify()

  def is_client_configured(self):
    self.run_config('verify --current')
    return self.code == 0

  def get_value(self, input_id):
    return self.inputs[input_id].stringValue().encode('utf-8')

  def valid_email_regex(self, string):
    if len(string) > 7:
      if re.match(EMAIL_REGEX, string) != None:
        return True
    return False

  def validate_email(self, email):
    if not self.valid_email_regex(email):
      self.show_alert("Please make sure the email address is valid.")
      return False

    return True

  def validate_password(self, passwd):
    if len(passwd) < 6:
      self.show_alert("Password should contain at least 6 chars.")
      return False

    return True

  def validate_existing_user_fields(self, email, passwd):
    if not self.validate_email(email):
      return False
    if not self.validate_password(passwd):
      return False

    return True

  def validate_new_user_fields(self, name, email, passwd, passwd2 = None):
    if name == '':
      self.show_alert("Please type in your name.")
      return False
    if not self.validate_email(email):
      return False
    if not self.validate_password(passwd):
      return False
    elif passwd2 is not None and passwd != passwd2:
      self.show_alert("Please make sure both passwords match.")
      return False
    return True

  def user_signup(self):
    name, email, passwd = self.get_value('name'), self.get_value('email'), self.get_value('pass')
    if not self.validate_new_user_fields(name, email, passwd):
      return

    self.run_config("signup -n '" + name + "' -e '" + email + "' -p '" + passwd + "'")
    if self.code == 1:
      self.show_error(self.out)
    else:
      self.show_success()

  def user_verify(self):
    email, passwd = self.get_value('existing_email'), self.get_value('existing_pass')
    if not self.validate_existing_user_fields(email, passwd):
      return

    self.run_config("authorize --email '" + email + "' --password '" + passwd + "'")
    if self.code == 1:
      self.show_error(self.out)
    else:
      self.show_success()

  def run_config(self, args):
    cmd = PREY_BIN + " config account " + args
    debug("Running: %s" % cmd)
    self.run_command(cmd)
    debug(self.out)

  def run_command(self, cmd):
    args = shlex.split(cmd)
    try:
      proc = Popen(args, stdout=PIPE, shell=False)
      self.out  = proc.communicate()[0]
      self.code = proc.returncode
    except (TypeError, OSError) as e:
      self.out  = "Exception! %s" % e
      self.code = 1

  def open_pass_recovery_url(self):
    url = "https://panel.preyproject.com/forgot"
    res = NSWorkspace.sharedWorkspace().openURL_(NSURL.URLWithString_(url))

  ######################################################
  # tab clicks

  def previous_tab(self, sender):
    self.changeTab(-1)

  def next_tab(self, sender):
    self.changeTab(1)

  ######################################################
  # app menu handlers

  def terminate(self, sender):
    NSApp().terminate_(self)

  ######################################################
  # draw logic

  def drawWelcome(self, tab, name):
    self.drawImage(PIXMAPS + '/conf/newuser.png', 48, 48, 0, 120, tab.view())
    self.drawImage(PIXMAPS + '/conf/olduser.png', 48, 48, 0, 50, tab.view())
    matrix = self.drawChooser()
    tab.view().addSubview_(matrix)

    label = self.drawLabel(OPTIONS['new'], NSMakeRect(68, 90, 380, 50))
    label.setTextColor_(NSColor.grayColor())
    tab.view().addSubview_(label)

    label = self.drawLabel(OPTIONS['existing'], NSMakeRect(68, 23, 380, 50))
    label.setTextColor_(NSColor.grayColor())
    tab.view().addSubview_(label)

  def drawNewUser(self, tab, name):
    elements = []
    elements.append(self.drawTextInput('name', 'Your name', 15, 140))
    elements.append(self.drawTextInput('email', 'Email', 15, 85))
    elements.append(self.drawPasswordInput('pass', 'Password', 15, 30))

    for element in flatten(elements):
      tab.view().addSubview_(element)

  def drawExistingUser(self, tab, name):
    elements = []
    elements.append(self.drawTextInput('existing_email', 'Email', 15, 140))
    elements.append(self.drawPasswordInput('existing_pass', 'Password', 15, 85))
    elements.append(self.drawButton(NSMakeRect(15, 20, 420, 50), 'Forgot your password?', 'open_pass_recovery_url'))

    for element in flatten(elements):
      tab.view().addSubview_(element)

  def drawSuccess(self, tab, name):
    self.drawImage(CHECK_ICON, 96, 88, CENTER-(70), 80, tab.view())

def setupMenus(app):

  menubar      = NSMenu.alloc().init()
  appMenuItem  = NSMenuItem.alloc().init()
  editMenuItem = NSMenuItem.alloc().initWithTitle_action_keyEquivalent_('Edit', None, '')

  appmenu = NSMenu.alloc().init()
  quitMenuItem = NSMenuItem.alloc().initWithTitle_action_keyEquivalent_('Quit', 'terminate', 'q')
  appMenuItem.setSubmenu_(appmenu)

  editMenu = NSMenu.alloc().init()
  editMenu.addItemWithTitle_action_keyEquivalent_('Select All', 'selectText:', 'a')
  editMenu.addItemWithTitle_action_keyEquivalent_('Cut', 'cut:', 'x')
  editMenu.addItemWithTitle_action_keyEquivalent_('Copy', 'copy:', 'c')
  editMenu.addItemWithTitle_action_keyEquivalent_('Paste', 'paste:', 'v')
  editMenuItem.setSubmenu_(editMenu)
  editMenuItem.setEnabled_(True)

  appmenu.addItem_(editMenuItem)
  appmenu.addItem_(quitMenuItem)
  menubar.addItem_(appMenuItem)
  # menubar.addItem__(editMenuItem)
  app.setMainMenu_(menubar)

def main():
  global icon # for alerts

  app = NSApplication.sharedApplication()
  delegate = ConfigDelegate.alloc().init()

  app.setActivationPolicy_(NSApplicationActivationPolicyRegular) # allows raising window
  app.setDelegate_(delegate)
  app.activateIgnoringOtherApps_(True)

  icon = NSImage.alloc().initWithContentsOfFile_(ICON_PATH)
  app.setApplicationIconImage_(icon)

  setupMenus(app)
  delegate.drawWindow()
  # app.run()
  AppHelper.runEventLoop()

if __name__ == '__main__':
  main()
