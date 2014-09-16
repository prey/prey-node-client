#!/usr/bin/env python
# coding: utf8

#############################################
# Mac System Flash Messages
# Written by Tomas Pollak <tomas@forkhq.com>
# (c) 2014 Fork Ltd.
# GPLv3 Licensed
#############################################

import os
import sys
import argparse

from time import sleep
from PyObjCTools import AppHelper
from AppKit import *

script_path = sys.path[0]

app_name = 'Alert'
default_font = 'Helvetica LT Light'

# pale blue
blue = NSColor.colorWithCalibratedRed_green_blue_alpha_(33/255.0, 104/255.0, 198/255.0, 1.0)
red = NSColor.colorWithCalibratedRed_green_blue_alpha_(178/255.0, 34/255.0, 34/255.0, 1.0)

background_color = blue

# dark red

close_icon = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAYAAABzenr0AAABZklEQVRYR+2VvW0CQRCFwWCTQQDGEg0Q0AWBK6EAZy7AfwVYwvwFxEADtitAuAHnNIDk2OI96UY6obvdmbngkkN60gI7+76dnZ2t10r+1Ev2r1UAVQZCGWijQP+g/4KF2kH8KW+NEMAjgobQpABEH7HfyRqHLIgQAP/7gG6cEGL+gviNJwOMIcQMujZC0PwLeg2Zi0HsiAkxh5pKCLW5FkDmaSDEnGnfxnZmAZC5CwwaOZm4TaVdZW4FkPlLDK4uIFzmHoAsiC5+/EwKbqdJe3qOtxUzbgXxio685t4MyAYGGPxCe+gecnVMbwbuYMgO9wSNoVZOYUZPxANAczYZmvPMucbUC2EFkPYq5rJDd9u2AEiTeU52fpleF4QWQO45O1zoqpnfDg0AzS333AQRA+glBcdXzdJk1A9YCIDm3Pmb0TxdmNEHLATwgJWOTvM0xDu+rKGfrKYQO4JoIyk6oQKoMlB6Bs6DNUoh5TlqhAAAAABJRU5ErkJggg=='

def write(str):
  print str
  sys.stdout.flush()

class AlertWindow(NSWindow):

  # allows editable inputs
  def canBecomeKeyWindow(self):
    return True

  def canBecomeMainWindow(self):
    return True

  def acceptsFirstResponder(self):
    return True

class AlertTextField(NSTextField):

  default_value = ""

  def becomeFirstResponder(self):
    result = super(AlertTextField, self).becomeFirstResponder()
    if result:
      if self.stringValue() == self.default_value:
        self.setStringValue_('')

    return result

class AlertView(NSView):

  field         = None
  respondable   = False

  def exit(self):
    # print "Exiting."
    os._exit(0)

  # allows editable inputs
  def canBecomeKeyWindow(self):
    return True

  def canBecomeMainWindow(self):
    return True

  def acceptsFirstResponder(self):
    return True

  def drawRect_(self, rect):
    self.add_close_button()

  def getTopOffset(self, height):
    return (self.bounds().size.height - height) / 2

  def getLeftOffset(self, width):
    return (self.bounds().size.width - width) / 2

  def setRespondable(self, text):
    self.respondable = True
    self.entry_text = text

  def update_button_and_exit(self):
    self.button.setEnabled_(True)
    self.button.setTitle_('Message sent!')
    AppHelper.callLater(1, self.exit)

  def enter_pressed(self):
    str = self.field.stringValue()
    if str == "" or str == self.field.default_value:
      return

    write("User input: " + str)
    self.button.setTitle_('Submitting...')
    self.button.setEnabled_(False)
    AppHelper.callLater(2, self.update_button_and_exit)
    return

  def button_pressed(self):
    # print "Button pressed"
    if self.field:
      self.enter_pressed()
    elif self.respondable:
      self.add_input()
      self.button.setTitle_('Submit')
    else:
      self.exit()

  def image_clicked(self):
    # print "Close button clicked"
    self.exit()

  def add_close_button(self):
    width = 48
    height = 48

    image = NSImage.alloc().initWithContentsOfURL_(NSURL.URLWithString_(close_icon))
    rep   = image.representations()[0]
    img_width  = rep.pixelsWide()
    img_height = rep.pixelsHigh()

    top = (self.bounds().size.height - img_height) - 25 # offset from top

    right_offset = (self.bounds().size.width - 600) / 2
    right = self.bounds().size.width - right_offset - img_width

    image.drawInRect_fromRect_operation_fraction_(((right, top), (img_width, img_height)), NSZeroRect, NSCompositeSourceOver, 1.0)
    # imageView = NSImageView.alloc().init()
    # imageView.setImage_(image)

    # for some reason, when drawing images inside buttons, the alpha is not preserved and they look awful
    # so the trick is to draw an invisible button on top of the image at the same position, so we can
    # grab the click event as normal

    imageView = NSButton.alloc().initWithFrame_(NSMakeRect(right, top, img_width, img_height))
    imageView.setImagePosition_(NSImageOnly)
    # imageView.setImage_(image)
    # imageView.setImageScaling_(NSImageScaleNone)
    imageView.setButtonType_(NSMomentaryChangeButton)
    imageView.setBordered_(False)

    # imageView.setSelectable_(True)
    imageView.setState_(NSOnState)
    imageView.setTarget_(self)
    imageView.setAction_("image_clicked")

    self.addSubview_(imageView)

  def add_input(self):
    width = 600 - 6
    height = 32
    field = AlertTextField.alloc().initWithFrame_(NSMakeRect(self.getLeftOffset(width), 70, width, height))
    field.default_value = self.entry_text
    field.setStringValue_(self.entry_text)
    field.setBezeled_(True)
    field.setBordered_(True)
    # field.setFocusRingType_(NSFocusRingTypeNone)
    # field.setDrawsBackground_(False)
    field.setEditable_(True)
    field.setSelectable_(True)
    # field.setEnabled_(True)

    font = NSFont.fontWithName_size_(default_font, 14)
    field.setFont_(font)

    field.setTarget_(self)
    field.setAction_("enter_pressed")
    self.field = field
    self.addSubview_(field)
    return field

  def add_button(self):
    width = 120
    left = (self.bounds().size.width - 600) / 2
    # left = self.getLeftOffset(width)
    label = self.respondable and 'Send Reply' or 'Close'

    button = NSButton.alloc().initWithFrame_(NSMakeRect(left, 20, width, 30))
    button.setBezelStyle_(4)
    button.setTitle_(label)
    button.setTarget_(self)
    button.setAction_("button_pressed")
    # button.setEnabled_(True)
    button.setState_(NSOnState)

    self.button = button
    self.addSubview_(button)

  def add_label(self, text, font_name, font_size, x, y, width, height):
    label = NSTextField.alloc().initWithFrame_(NSMakeRect(x, y, width, height))
    label.setStringValue_(text)
    label.setBezeled_(False)
    label.setBordered_(False)
    label.setEditable_(False)
    label.setSelectable_(False)
    label.setDrawsBackground_(False)

    font = NSFont.fontWithName_size_(font_name, font_size)
    label.setFont_(font)
    label.setTextColor_(NSColor.whiteColor())

    self.addSubview_(label)
    return label

  def show_message(self, title, message):
    width  = 600

    height = 30
    top = self.bounds().size.height - 60
    self.add_label(title, 'Helvetica CE 35 Thin', 30, self.getLeftOffset(width) + 3, top, width, height)

    # width + 10 is to add padding
    height = self.bounds().size.height - 180
    textview = NSTextView.alloc().initWithFrame_(NSMakeRect(self.getLeftOffset(width), 100, width + 8, height))
    textview.setSelectable_(True)

    style = NSMutableParagraphStyle.alloc().init()
    style.setLineSpacing_(4.0)
    # style.setAlignment_(NSCenterTextAlignment)
    textview.setDefaultParagraphStyle_(style)
    textview.setString_(message)
    textview.setEditable_(False)
    textview.setBackgroundColor_(background_color)

    font = NSFont.fontWithName_size_(default_font, 15)
    textview.setFont_(font)
    textview.setTextColor_(NSColor.whiteColor())

    self.addSubview_(textview)
    # self.add_label(message, 20, self.getLeftOffset(width), top, width, height)

def draw_menus(app):
  mainmenu = NSMenu.alloc().init()
  app.setMainMenu_(mainmenu)
  appMenuItem = NSMenuItem.alloc().initWithTitle_action_keyEquivalent_(app_name, 'sample', '')
  mainmenu.addItem_(appMenuItem)

  appMenu = NSMenu.alloc().init()
  appMenuItem.setSubmenu_(appMenu)
  appMenuItem.setEnabled_(True)
  # aboutItem = NSMenuItem.alloc().initWithTitle_action_keyEquivalent_('About My Sample App...', 'about', '')
  # appMenu.addItem_(aboutItem)
  quitItem = NSMenuItem.alloc().initWithTitle_action_keyEquivalent_('Quit', 'quit', 'q')
  quitItem.setTarget_(app)
  appMenu.addItem_(quitItem)

def main():
  app = NSApplication.sharedApplication()
  app.activateIgnoringOtherApps_(True)

  # set app icon and draw menu
  image = NSImage.alloc().initWithContentsOfURL_(NSURL.URLWithString_(close_icon))
  app.setApplicationIconImage_(image)
  draw_menus(app)

  # get and set window height and width
  screen = NSScreen.mainScreen()
  screen_width  = screen.frame().size.width
  screen_height = screen.frame().size.height

  # one line is 70 chars
  # 300 can have 4 lines
  # height = 300
  elements_width = 600
  base_height = 190

  if args.entry is not None:
    base_height += 40

  lines = len(args.message) / 70
  window_height = (lines * 20) + base_height

  # calculate offsets
  offset_top   = (screen_height - window_height) / 2
  offset_left  = screen_width - (screen_width - elements_width)
  offset_right = screen_width - ((screen_width - elements_width) / 2)

  # ok, make the rect that we'll use for the window and view
  rect = NSMakeRect(0, offset_top, screen_width, window_height)

  window = AlertWindow.alloc().initWithContentRect_styleMask_backing_defer_(
    rect,
    NSBorderlessWindowMask,
    NSBackingStoreBuffered,
    True)

  # render view and draw message and button
  view    = AlertView.alloc().initWithFrame_(rect)
  title   = NSString.alloc().initWithUTF8String_(args.title)
  message = NSString.alloc().initWithUTF8String_(args.message)
  view.show_message(title, message)

  if args.entry is not None:
    view.setRespondable(args.entry)

  view.add_button()

  # set window properties and display
  window.setBackgroundColor_(background_color)
  window.setTitle_(app_name)
  window.setContentView_(view)
  window.orderFrontRegardless()
  # window.makeFirstResponder_(view)
  window.makeKeyAndOrderFront_(window)
  window.display()

  # return app.run()

  try:
    AppHelper.runEventLoop(installInterrupt=True)
  except KeyboardInterrupt:
    print "KeyboardInterrupt received, exiting"

  sys.exit(0)

if __name__ == '__main__':

  parser = argparse.ArgumentParser(description='Shows an onscreen message.')
  parser.add_argument('message', metavar='message', help='Message to show')
  parser.add_argument('-t', '--title', dest='title', default='Important', help='Title to show above.')
  parser.add_argument('-e', '--entry', dest='entry', help='Adds an text input.')
  parser.add_argument('-l', '--level', dest='level', help='Warning level. "warning" or "info" (default)')

  args = parser.parse_args()

  if args.level == "warn" or args.level == "warning":
    background_color = red
    if args.title == 'Important'
      args.title = 'Warning'

  main()
