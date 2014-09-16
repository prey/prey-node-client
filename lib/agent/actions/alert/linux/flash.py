#!/usr/bin/env python
#############################################
# Prey Linux Alert
# By Tomas Pollak - (c) 2014 Fork Ltd.
# http://preyproject.com
# GPLv3
#############################################

import os, sys
import gtk
import pango
import argparse
import base64
import gobject

data = "iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAYAAABzenr0AAABZklEQVRYR+2VvW0CQRCFwWCTQQDGEg0Q0AWBK6EAZy7AfwVYwvwFxEADtitAuAHnNIDk2OI96UY6obvdmbngkkN60gI7+76dnZ2t10r+1Ev2r1UAVQZCGWijQP+g/4KF2kH8KW+NEMAjgobQpABEH7HfyRqHLIgQAP/7gG6cEGL+gviNJwOMIcQMujZC0PwLeg2Zi0HsiAkxh5pKCLW5FkDmaSDEnGnfxnZmAZC5CwwaOZm4TaVdZW4FkPlLDK4uIFzmHoAsiC5+/EwKbqdJe3qOtxUzbgXxio685t4MyAYGGPxCe+gecnVMbwbuYMgO9wSNoVZOYUZPxANAczYZmvPMucbUC2EFkPYq5rJDd9u2AEiTeU52fpleF4QWQO45O1zoqpnfDg0AzS333AQRA+glBcdXzdJk1A9YCIDm3Pmb0TxdmNEHLATwgJWOTvM0xDu+rKGfrKYQO4JoIyk6oQKoMlB6Bs6DNUoh5TlqhAAAAABJRU5ErkJggg=="

def write(str):
  print str
  sys.stdout.flush()

class Alert:
  entry = None
  respondable = False
  sending = False

  def exit(self):
    os._exit(66)

  def update_button_and_exit(self):
    self.button.set_label('Message Sent!')
    self.button.set_sensitive(True)
    gobject.timeout_add(1000, self.exit)

  def enter_pressed(self, widget):
    # print "Enter pressed"
    str = self.entry.get_text()
    if self.sending or str == "" or str == self.respondable:
      return True

    self.sending = True
    write("User input: " + str)
    self.button.set_label('Submitting...')
    self.button.set_sensitive(False)
    gobject.timeout_add(2000, self.update_button_and_exit)

  def button_clicked(self, widget):
    if self.entry:
      self.enter_pressed(widget)
    elif self.respondable:
      self.add_input()
      self.button.set_label('Submit')
    else:
      self.exit()

  def close_button_clicked(self, widget):
    # print "Close button clicked"
    self.exit()

  def put(self, container, child, x, y):
    fixed = gtk.Fixed()
    fixed.put(child, x, y)
    container.pack_start(fixed, False, False, 0)

  def add_input(self):
    input_width = 600
    input_height = 30

    entry = gtk.Entry(max=0)
    # entry.set_max_length(40)
    entry.set_inner_border(None)
    entry.set_width_chars(24)
    entry.set_visibility(True)
    entry.set_has_frame(True)
    entry.set_editable(True)

    entry.set_size_request(input_width, input_height)
    entry.modify_base(gtk.STATE_NORMAL, gtk.gdk.color_parse("#FFFFFF"))
    entry.modify_font(pango.FontDescription("sans 12"))

    entry.connect("activate", self.enter_pressed)
    entry.show()
    self.entry = entry

    fixed = gtk.Fixed()
    fixed.put(self.entry, self.left_offset, -80)
    fixed.show()
    self.box.pack_start(fixed, False, False, 0)

  def new_label(self, text, font_size):
    label = gtk.Label()
    label.set_markup('<span foreground="#ffffff">' + text + '</span>');
    label.modify_font(pango.FontDescription("sans " + str(font_size)))
    # label.set_alignment(0.01, 0)
    label.set_alignment(0, 0)
    label.set_line_wrap(True)
    return label

  def __init__(self):

    window_height = 300
    elements_width = 600
    button_text = "Close"

    if args.entry is not None:
      self.respondable = args.entry
      button_text = "Send Reply"

    red = gtk.gdk.color_parse("#B22222")
    blue = gtk.gdk.color_parse("#2168C6")

    title = args.title

    if args.level == 'warning' or args.level == 'warn':
      bg_color = red
      if title == 'Important':
        title = 'Warning'
    else:
      bg_color = blue

    ###################################
    # window
    ###################################

    # self.window = gtk.Window(gtk.WINDOW_POPUP)
    self.window = gtk.Window(gtk.WINDOW_TOPLEVEL)

    self.window.set_title("Prey Alert")
    self.window.modify_bg(gtk.STATE_NORMAL, bg_color)

    self.window.stick()
    self.window.set_deletable(False)
    self.window.set_decorated(False)
    self.window.set_border_width(0)
    self.window.set_keep_above(True)
    self.window.set_resizable(False)

    main_screen_width = self.window.get_screen().get_monitor_geometry(0).width
    main_screen_height = self.window.get_screen().get_monitor_geometry(0).height
    self.left_offset   = main_screen_width - (main_screen_width - elements_width)
    self.right_offset = main_screen_width - ((main_screen_width - elements_width) / 2)

    # set vbox position and move main window
    vbox = gtk.VBox(False, 0)
    top_offset = (main_screen_height - window_height) / 2
    vbox.set_size_request(main_screen_width, window_height)
    self.window.move(0, top_offset)
    self.window.add(vbox)
    self.box = vbox

    ###################################
    # elements
    ###################################

    # vertical separation on top
    hbox = gtk.HBox(False, 0)
    vbox.pack_start(hbox, False, False, 0)

    # title
    title = self.new_label(title, 20)
    self.put(hbox, title, self.left_offset, 20)

    # load image from data
    image = gtk.Image()
    loader = gtk.gdk.PixbufLoader()
    loader.set_size(32, 32)
    loader.write(base64.standard_b64decode(data))
    loader.close()
    image.set_from_pixbuf(loader.get_pixbuf())

    # add image and render close button
    close_button = gtk.Button()
    # close_button.set_size_request(42, 42)
    close_button.set_relief(gtk.RELIEF_NONE)
    close_button.set_image(image)
    close_button.connect("clicked", self.close_button_clicked)

    # calculate the size we need to pull back
    right = len(args.title) * 15
    self.put(hbox, close_button, elements_width - right, 15)

    # text area
    text = gtk.TextBuffer()
    text.set_text(args.message)
    textview = gtk.TextView(text)
    textview.set_size_request(elements_width, 150)
    textview.set_wrap_mode(gtk.WRAP_WORD)
    textview.set_editable(False)
    textview.modify_base(gtk.STATE_NORMAL, bg_color)
    textview.modify_text(gtk.STATE_NORMAL, gtk.gdk.color_parse('white'))
    textview.modify_font(pango.FontDescription("sans 11"))
    textview.set_pixels_inside_wrap(3)
    self.put(vbox, textview, self.left_offset, 20)

    # close/reply button
    button = gtk.Button(button_text)
    # button.set_relief(gtk.RELIEF_NONE)
    button.set_size_request(120, 30)
    button.modify_font(pango.FontDescription("sans 16"))
    button.connect("clicked", self.button_clicked)
    self.button = button
    self.put(vbox, button, self.left_offset, 20)

    button.grab_focus()
    self.window.show_all()

if __name__ == "__main__":

  parser = argparse.ArgumentParser(description='Shows an onscreen message.')
  parser.add_argument('message', metavar='message', help='Message to show')
  parser.add_argument('-t', '--title', dest='title', default='Important', help='Title to show above.')
  parser.add_argument('-e', '--entry', dest='entry', help='Adds an text input.')
  parser.add_argument('-l', '--level', dest='level', help='Warning level. "warning" or "info" (default)')
  args = parser.parse_args()

  alert = Alert()
  gtk.main()
