#!/bin/sh
''':'
':'; python=$(command -v python)
':'; [ -z "$python" ] || [ -n "${python##*usr*}" ] && python="/usr/bin/python3"
':'; exec "$python" "$0" "$@"
'''

# coding: utf8

#############################################
# Linux System Flash Messages
# Written by Tomas Pollak <tomas@forkhq.com>
# (c) 2014 Fork Ltd.
# GPLv3 Licensed
#############################################

import os
import sys
import argparse
import base64
import math

import gi

gi.require_version("Gtk", "3.0")
from gi.repository import Gtk
from gi.repository import Pango
from gi.repository import Gdk
from gi.repository import GdkPixbuf
from gi.repository import GLib

FONT = "Liberation Sans"

data = "iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAYAAABzenr0AAABZklEQVRYR+2VvW0CQRCFwWCTQQDGEg0Q0AWBK6EAZy7AfwVYwvwFxEADtitAuAHnNIDk2OI96UY6obvdmbngkkN60gI7+76dnZ2t10r+1Ev2r1UAVQZCGWijQP+g/4KF2kH8KW+NEMAjgobQpABEH7HfyRqHLIgQAP/7gG6cEGL+gviNJwOMIcQMujZC0PwLeg2Zi0HsiAkxh5pKCLW5FkDmaSDEnGnfxnZmAZC5CwwaOZm4TaVdZW4FkPlLDK4uIFzmHoAsiC5+/EwKbqdJe3qOtxUzbgXxio685t4MyAYGGPxCe+gecnVMbwbuYMgO9wSNoVZOYUZPxANAczYZmvPMucbUC2EFkPYq5rJDd9u2AEiTeU52fpleF4QWQO45O1zoqpnfDg0AzS333AQRA+glBcdXzdJk1A9YCIDm3Pmb0TxdmNEHLATwgJWOTvM0xDu+rKGfrKYQO4JoIyk6oQKoMlB6Bs6DNUoh5TlqhAAAAABJRU5ErkJggg=="  # noqa: E501


def write(str):
    print(str)
    sys.stdout.flush()


class Alert:
    entry = None
    respondable = False
    sending = False

    scale = 1
    input_width = 600  # will be filled
    input_height = 30

    def exit(self):
        os._exit(66)

    def update_button_and_exit(self):
        self.button.set_label("Message Sent!")
        self.button.set_sensitive(True)
        GLib.timeout_add(1000, self.exit)

    def enter_pressed(self, widget):
        # print("Enter pressed")
        str = self.entry.get_text()
        if self.sending or str == "" or str == self.respondable:
            return True

        self.sending = True
        write("User input: " + str)
        self.button.set_label("Submitting...")
        self.button.set_sensitive(False)
        GLib.timeout_add(2000, self.update_button_and_exit)

    def button_clicked(self, widget):
        if self.entry:
            self.enter_pressed(widget)
        elif self.respondable:
            self.add_input()
            self.button.set_label("Submit")
        else:
            self.exit()

    def close_button_clicked(self, widget):
        # print "Close button clicked"
        self.exit()

    def put(self, container, child, x, y):
        fixed = Gtk.Fixed()
        fixed.put(child, x, y)
        container.pack_start(fixed, False, False, 0)

    def add_input(self):

        entry = Gtk.Entry()
        entry.set_max_length(0)
        # entry.set_max_length(40)
        entry.set_inner_border(None)
        entry.set_width_chars(24)
        entry.set_visibility(True)
        entry.set_has_frame(True)
        entry.set_editable(True)

        entry.set_size_request(self.input_width, self.input_height * self.scale)
        entry.override_color(
            Gtk.StateType.NORMAL, Gdk.RGBA(red=0, green=0, blue=0, alpha=1)
        )
        entry.override_font(Pango.FontDescription(FONT + " 11"))

        entry.connect("activate", self.enter_pressed)
        entry.show()
        self.entry = entry

        fixed = Gtk.Fixed()
        fixed.put(self.entry, self.left_offset, -80 * self.scale)
        fixed.show()
        self.box.pack_start(fixed, False, False, 0)

    def new_label(self, text, font_size):
        label = Gtk.Label()
        label.set_markup('<span foreground="#ffffff">' + text + "</span>")
        label.override_font(Pango.FontDescription(FONT + " " + str(font_size)))
        # label.set_xalign(0.01)
        label.set_xalign(0)
        label.set_yalign(0)
        label.set_line_wrap(True)
        return label

    def create_window(self, bg_color):
        self.window = Gtk.Window.new(Gtk.WindowType.TOPLEVEL)

        self.window.set_title("Prey Alert")
        self.window.override_background_color(Gtk.StateType.NORMAL, bg_color)

        self.window.stick()
        self.window.set_deletable(False)
        self.window.set_decorated(False)
        self.window.set_border_width(0)
        self.window.set_keep_above(True)
        self.window.set_resizable(False)

    def __init__(self):

        button_text = "Close"
        title = args.title

        if args.entry is not None:
            self.respondable = args.entry
            button_text = "Send Reply"

        red = Gdk.RGBA()
        red.parse("#B22222")
        blue = Gdk.RGBA()
        blue.parse("#2168C6")

        if args.level == "warning" or args.level == "warn":
            bg_color = red
            if title == "Important":
                title = "Warning"
        else:
            bg_color = blue

        ###################################
        # widths and heights
        ###################################

        self.create_window(bg_color)  # sets self.window

        _monitor = Gdk.Screen.get_default()
        main_screen_width = _monitor.get_width()
        main_screen_height = _monitor.get_height()

        print("print main_screen_width: ",main_screen_width)
        print("print main_screen_height: ",main_screen_height)


        if main_screen_width > 2000:
            self.scale = 2
        print("print elf.scale: ",self.scale)


        one_third_width = main_screen_width / 3
        print("print one_third_width: ",one_third_width)
       
        elements_width = one_third_width * 2
        print("print elements_width: ",elements_width)

        base_height = 150 * self.scale
        print("print base_height: ",base_height)

        if args.entry is not None:
            base_height += 30 * self.scale

        print("print base_height2: ",base_height)

        letters_per_line = elements_width / (8 * self.scale)
        lines = int(math.ceil(len(args.message) / float(letters_per_line)))
        text_height = 15 + (lines * 22 * self.scale)
        window_height = text_height + base_height

        # these are needed later to position the input
        self.input_width = elements_width
        self.left_offset = one_third_width / 2  # the other have should be to the right
        #self.left_offset = 0  # the other have should be to the right
        print("print left_offset: ",self.left_offset)
        right_offset = self.left_offset + elements_width
        print("print right_offset: ",right_offset)
        # print "Letters per line: %d" % letters_per_line
        # print "Lines: %d" % lines
        # print "Left offset: %d" % self.left_offset
        # print "Right offset: %d" % right_offset

        # set vbox position and move main window
        vbox = Gtk.Box.new(Gtk.Orientation.VERTICAL, 0)
        vbox.set_homogeneous(False)
        top_offset = (main_screen_height - window_height) / 2
        vbox.set_size_request(main_screen_width, window_height)
        self.window.move(0, top_offset)
        self.window.add(vbox)
        self.box = vbox

        ###################################
        # elements
        ###################################

        # title
        title = self.new_label(title, 22)
        self.put(self.box, title, self.left_offset, 20 * self.scale)

        # load image from data
        image = Gtk.Image()
        loader = GdkPixbuf.PixbufLoader()
        loader.set_size(32, 32)
        loader.write(base64.standard_b64decode(data))
        loader.close()
        image.set_from_pixbuf(loader.get_pixbuf())

        # add image and render close button
        close_button = Gtk.Button()
        # close_button.set_size_request(42, 42)
        close_button.set_relief(Gtk.ReliefStyle.NONE)
        close_button.set_image(image)
        close_button.connect("clicked", self.close_button_clicked)

        fixed = Gtk.Fixed()
        fixed.put(close_button, 0, 0)
        fixed.set_size_request(40 * self.scale, 40 * self.scale)
        # minus the width and height of itself for x/y coords
        self.put(self.box, fixed, right_offset - 30, -40 * self.scale)

        # text area
        text = Gtk.TextBuffer()
        text.set_text(args.message)
        textview = Gtk.TextView.new_with_buffer(text)
        textview.set_size_request(elements_width, text_height)
        textview.set_wrap_mode(Gtk.WrapMode.WORD)
        textview.set_editable(False)
        textview.override_background_color(Gtk.StateType.NORMAL, bg_color)
        textview.override_color(
            Gtk.StateType.NORMAL, Gdk.RGBA(red=1, green=1, blue=1, alpha=1)
        )
        textview.override_font(Pango.FontDescription(FONT + " 11"))
        textview.set_pixels_inside_wrap(3)
        self.put(vbox, textview, self.left_offset, 20)

        # close/reply button
        button = Gtk.Button.new_with_label(button_text)
        # button.set_relief(Gtk.ReliefStyle.NONE)
        button.set_size_request(120 * self.scale, 30 * self.scale)
        button.override_font(Pango.FontDescription(FONT + " 16"))
        button.connect("clicked", self.button_clicked)
        self.button = button
        bottom = 20
        if args.entry is not None:
            bottom += 35

        self.put(vbox, button, self.left_offset, bottom * self.scale)

        button.grab_focus()
        self.window.show_all()


if __name__ == "__main__":

    parser = argparse.ArgumentParser(description="Shows an onscreen message.")
    parser.add_argument("message", metavar="message", help="Message to show")
    parser.add_argument(
        "-t", "--title", dest="title", default="Important", help="Title to show above."
    )
    parser.add_argument("-e", "--entry", dest="entry", help="Adds an text input.")
    parser.add_argument(
        "-l",
        "--level",
        dest="level",
        help='Warning level. "warning" or "info" (default)',
    )
    args = parser.parse_args()

    alert = Alert()
    Gtk.main()