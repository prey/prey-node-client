#!/usr/bin/env python
################################################
# Prey Configurator for Linux
# By Tomas Pollak
# (c) 2012-2014 - Fork Ltd. (usefork.com)
################################################

# if having trouble with the GTK theme as root, do this:
# sudo ln -s ~/.themes/ /root/.themes

################################################
# base includes
################################################

APP_NAME = 'prey-config'
LANG_PATH = 'lang'

import sys
import pygtk
import gtk
import os
import re
import json
import locale
import gettext
import shlex
from subprocess import Popen, call, PIPE, STDOUT

pygtk.require("2.0")

# locale.setlocale(locale.LC_ALL, '')
# locale.bindtextdomain(app_name, lang_path)
gettext.bindtextdomain(APP_NAME, LANG_PATH)
gettext.textdomain(APP_NAME)
_ = gettext.gettext

################################################
# vars and such
################################################

FORCE_CONFIG = len(sys.argv) > 1 and (sys.argv[1] == '-f' or sys.argv[1] == '--force')

OUT = STDOUT # None

SCRIPT_PATH = os.sys.path[0]
PACKAGE_PATH = SCRIPT_PATH + '/../../../..'
PREY_BIN = PACKAGE_PATH + '/bin/prey'
PREY_CONFIG = PREY_BIN + ' config'

PACKAGE_JSON = open(PACKAGE_PATH + '/package.json', 'r')
PACKAGE_INFO = json.loads(PACKAGE_JSON.read())
VERSION = PACKAGE_INFO['version']

PAGES = ['control_panel_options', 'new_user', 'existing_user', 'existing_device']
EMAIL_REGEX = "^.+\\@(\\[?)[a-zA-Z0-9\\-\\.]+\\.([a-zA-Z]{2,7}|[0-9]{1,3})(\\]?)$"

class PreyConfigurator(object):

  ################################################
  # helper functions
  ################################################

  def get(self, name):
    return self.root.get_object(name)

  def text(self, name):
    return self.get(name).get_text()

  ################################################
  # validations
  ################################################

  def valid_email_regex(self, string):
    if len(string) > 7:
      if re.match(EMAIL_REGEX, string) != None:
        return True
    return False

  def validate_email(self, email_field):
    if not self.valid_email_regex(self.text(email_field)):
      self.show_alert(_("Invalid email"), _("Please make sure the email address you typed is valid."))
      return False

    return True

  def validate_password(self, password_field):
    if len(self.text(password_field)) < 6:
      self.show_alert(_("Bad password"), _("Password should contain at least 6 chars."))
      return False

    return True

  def validate_existing_user_fields(self):
    if self.text('email') == '':
      self.show_alert(_("Empty email!"), _("Please type in your email."))
      return False
    if self.text('password') == '':
      self.show_alert(_("Empty password!"), _("Please type in your password."))
      return False

    return True

  def validate_new_user_fields(self):
    if self.text('user_name') == '':
      self.show_alert(_("Empty name!"), _("Please type in your name."))
      return False
    if self.text('email') == '':
      self.show_alert(_("Empty email!"), _("Please type in your email."))
      return False
    if self.text('password') == '':
      self.show_alert(_("Empty password!"), _("Please type in your password."))
      return False
    elif self.text('password') != self.text('password_confirm'):
      self.show_alert(_("Passwords don't match"), _("Please make sure both passwords match."))
      return False
    if not self.get('check_terms_conds').get_active():
      self.show_alert(_("Error"), _("You need to accept the Terms & Conditions and Privacy Policy to continue"))
      return False
    if not self.get('check_age').get_active():
      self.show_alert(_("Error"), _("You must be older than 16 years old to use Prey"))
      return False
    return True

  ################################################
  # dialogs
  ################################################

  def show_alert(self, title, message, quit = False):
    dialog = gtk.MessageDialog(
      parent         = None,
      flags          = gtk.DIALOG_MODAL | gtk.DIALOG_DESTROY_WITH_PARENT,
      type           = gtk.MESSAGE_INFO,
      buttons        = gtk.BUTTONS_OK,
      message_format = message)
    dialog.set_title(title)
    if quit == True:
      dialog.connect('response', lambda dialog, response: gtk.main_quit())
    else:
      dialog.connect('response', lambda dialog, response: dialog.destroy())
    self.center_dialog(dialog)
    dialog.show()

  def show_about(self):
    dialog = self.get('about_prey_config')
    self.center_dialog(dialog)
    dialog.show()

  def close_about(self, dialog, response):
    dialog.hide()

  def center_dialog(self, dialog):
    if 'window' in self.__dict__:
      dialog.set_transient_for(self.window)
    dialog.set_position(gtk.WIN_POS_CENTER_ON_PARENT)

  ################################################
  # window and widget management
  ################################################

  def get_page_name(self):
    return PAGES[self.pages.get_current_page()]

  def toggle_pg3_next_apply(self, button):
    button_next = self.get('button_next')
    button_apply = self.get('button_apply')

    if self.get('use_existing_device').get_active() == False:
      button_next.hide()
      button_apply.show()
      button_apply.grab_default()
    else:
      button_apply.hide()
      button_next.show()
      button_next.grab_default()

  def next_page(self, button):
    page_name = self.get_page_name()
    increment = 1

    if page_name == 'control_panel_options' and \
      self.get('new_user_option').get_active() == False:
        increment = 2

    self.pages.set_current_page(self.pages.get_current_page() + increment)
    self.toggle_buttons(button, None, 1)

  def prev_page(self, button):
    page_name = self.get_page_name()
    decrement = 1

    if page_name == 'existing_user':
      decrement = 2
    # elif page_name == 'standalone_options':
      # decrement = 5

    if self.pages.get_current_page() != 0:
      self.pages.set_current_page(self.pages.get_current_page() - decrement)

    self.toggle_buttons(button, None, 1)

  def toggle_buttons(self, button, tab, tab_number):

    button_prev  = self.get('button_prev')
    button_next  = self.get('button_next')
    button_apply = self.get('button_apply')

    if self.get_page_name() == 'control_panel_options':
      button_prev.hide()
      button_apply.hide()
      button_next.show()
      button_next.grab_default()
    else:
      button_prev.show()
      button_next.hide()
      button_apply.show()
      button_apply.grab_default()


  def set_default_action(self,button,ctrl):
    button_cancel = self.get('button_cancel')
    cancel_has_default = button_cancel.flags() & gtk.HAS_DEFAULT
    button_prev = self.get('button_prev')
    prev_has_default = button_prev.flags() & gtk.HAS_DEFAULT
    button_next = self.get('button_next')
    button_apply = self.get('button_apply')

    if not cancel_has_default and not prev_has_default:
      if button_next.flags() & gtk.VISIBLE:
        button_next.grab_default()
      else:
        button_apply.grab_default()

  # ensure the widget focused is visible in the scroll window
  def ensure_visible(self, widget, event):
    widget_name = widget.get_name()
    internal_height = self.get('control_panel_options').get_size()[1]
    widget_posn = widget.allocation.y
    widget_height = widget.allocation.height
    return True

  # show about dialog on F1 keypress
  def key_pressed(self, widget, event):
    if (event.keyval == gtk.keysyms.F1) \
    and (event.state & gtk.gdk.CONTROL_MASK) == 0 \
    and (event.state & gtk.gdk.SHIFT_MASK) == 0:
      self.show_about()
      return True

    return False

  ################################################
  # setting settings
  ################################################

  def apply_settings(self, button):
    self.get('button_apply').set_label(_("Saving..."))

    page_name = self.get_page_name()
    if page_name == 'new_user':
      if self.validate_new_user_fields():
        self.create_user()
    elif page_name == "existing_user":
      if self.validate_existing_user_fields():
        self.get_existing_user(False)

    self.get('button_apply').set_label('gtk-apply')

  def client_configured(self):
    self.call_prey_config('account verify', '--current')
    return self.result == 0

  def create_user(self):
    name        = self.text('user_name')
    email       = self.text('email')
    password    = self.text('password')
    check_terms = self.get('check_terms_conds').get_active()
    check_age   = self.get('check_age').get_active()
    terms       = 'no'
    age         = 'no'

    if check_terms == True : terms = 'yes'
    if check_age == True : age = 'yes'

    password = re.escape(password)

    self.call_prey_config('account signup', '-n "' + name + '" -e "' + email + '" -p ' + password + ' -t "' + terms + '" -a "' + age +'"')
    self.error_or_exit()

  def get_existing_user(self, show_devices):
    email    = self.text('existing_email')
    password = self.text('existing_password')
    password = re.escape(password)

    self.call_prey_config('account authorize', '-e "' + email + '" -p ' + password)
    self.error_or_exit()

  def call_prey_config(self, action, opts):
    return self.run_command(PREY_CONFIG + ' ' + action + ' ' + opts)

  def run_prey(self):
    return self.run_command(PREY_BIN)

  def run_command(self, cmd):
    args = shlex.split(cmd)
    proc = Popen(args, stdout=PIPE, shell=False)
    self.out = proc.communicate()[0]
    self.result = proc.returncode
    return proc

  def parse_error(self, line):
    if line.find('been taken') != -1:
      return 'Email has been taken. Seems you already signed up!'
    elif line.find('Unexpected status code: 401') != -1:
      return 'Invalid account credentials. Please try again.'

    return line

  def error_or_exit(self):
    if self.result == 0:
      return self.exit_ok()
#      self.run_prey()
#      if self.result == 0:
#        self.exit_ok()
#      else:
#        self.show_alert('Error', 'Something went wrong while running Prey. Please check the logfile for details.')
    else:
      lines = self.out.strip()
      message = self.parse_error(lines)
      self.show_error(message)

  def show_error(self, message):
    self.show_alert(_('Hold on!'), _(message), False)

  def exit_ok(self):
    self.show_alert(_('Success'), _('Sweet! Your computer is now protected by Prey. To try it out or to start tracking it, please visit preyproject.com.'), True)

  def __init__(self):
    if not FORCE_CONFIG and self.client_configured():
      return self.exit_ok()

    builder = gtk.Builder()
    builder.set_translation_domain(APP_NAME)
    builder.add_from_file(SCRIPT_PATH + "/prey-config.glade")
    builder.connect_signals({
      "on_window_destroy"     : gtk.main_quit,
      "prev_page"             : self.prev_page,
      "next_page"             : self.next_page,
      "toggle_buttons"        : self.toggle_buttons,
      "apply_settings"        : self.apply_settings,
      "toggle_pg3_next_apply" : self.toggle_pg3_next_apply,
      "set_default_action"    : self.set_default_action,
      "ensure_visible"        : self.ensure_visible,
      "key_pressed"           : self.key_pressed,
      "close_about"           : self.close_about
    })

    self.window = builder.get_object("window")
    self.window.set_title(self.window.get_title() + " (v" + VERSION + ")")
    # self.window.get_settings().set_string_property('gtk-font-name', 'sans normal 11','');
    self.pages = builder.get_object("reporting_mode_tabs")
    self.root = builder

    about = self.get('about_prey_config')
    about.set_version(VERSION)

if __name__ == "__main__":
  app = PreyConfigurator()
  gtk.main()
