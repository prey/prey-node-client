#!/usr/bin/env ruby

############################
# Prey OSX Configurator
# Copyright (c) Fork Limited
# Written by Tomás Pollak
# GPLv3 Licensed
############################

require 'osx/cocoa'
include OSX

APP_NAME  = 'Prey Configurator'
HEIGHT = 400
WIDTH  = 500
CENTER = WIDTH/2

EMAIL_REGEX = /[A-Z0-9\._%-]+@([A-Z0-9-]+\.)+[A-Z]{2,4}\z/i

PREY_CONFIG = File.expand_path(File.dirname(__FILE__) + '/../../../../../../bin/prey config')
PIXMAPS     = File.expand_path(File.dirname(__FILE__) + '/../../../../pixmaps')
LOGO        = PIXMAPS + '/prey-text.png'

TABS = ['welcome', 'new_user', 'existing_user', 'success']

TITLES = {
	:welcome => 'Welcome, good friend. Please choose your destiny.',
	:new_user => "Please type in your info and we'll sign you up for a new Prey account.",
	:existing_user => 'Please type in your Prey account credentials.',
	:success => 'All good! Your computer is now protected by Prey. You can now visit preyproject.com and start tracking it.'
}

OPTIONS = {
	:new => "Choose this option if this is the first time you've installed Prey.",
	:existing => "If you've already set up Prey on another or this device."
}

class ConfigWindow < NSWindow

  def windowShouldClose(sender)
    OSX::NSApp.stop(nil)
    false
  end

end

class ConfigDelegate < NSObject

	attr_reader :app, :window, :tabs, :chooser, :inputs

  def set_app(app)
		@app = app
	end

  def applicationDidFinishLaunching(aNotification)
    @inputs = {}
		drawWindow
		drawImage(LOGO, [350, 73, CENTER-(350/2), 310], window.contentView)
		drawButtons
		drawTabs
		setTab(0)
  end

	def getFrame(width, height, x = 0, y = 0)
		NSRect.new(NSSize.new(x, y), NSSize.new(width, height))
	end

	def drawWindow
		frame = getFrame(WIDTH, HEIGHT, 300, 200)
	  @window = ConfigWindow.alloc.initWithContentRect_styleMask_backing_defer(frame, 
#			NSTexturedBackgroundWindowMask |
			NSTitledWindowMask |
	  	NSClosableWindowMask | 
	  	NSMiniaturizableWindowMask, NSBackingStoreBuffered, 1)

	  window.setTitle(APP_NAME)
		window.setDelegate(self)
	  window.display
	  window.orderFrontRegardless
		# win.makeKeyWindow
		# win.makeKeyAndOrderFront(self)
		window
	end
	
	def drawImage(file, coords, view)
    imageView = NSImageView.alloc.initWithFrame(getFrame(*coords))
    image = NSImage.alloc.initWithContentsOfFile(file)
    imageView.setImage(image)
		view.addSubview(imageView)
	end
	
	def drawButtons
		@prev = drawButton([300.0, 10.0], [80, 30], 'Previous', 'previous_tab:')
		@next = drawButton([400.0, 10.0], [80, 30], 'Next', 'next_tab:')
		@prev.setHidden(true)
		window.makeFirstResponder(@next)
	end
	
	def drawRadio(title, default, tag, coords)
    checkbox = NSButton.alloc.initWithFrame(NSRect.new(NSSize.new(*coords), NSSize.new(94,18)))
    checkbox.setButtonType(NSRadioButton)
    checkbox.setTitle(title)
    checkbox.setState(default)
    checkbox.setTag(tag)
		checkbox
	end
	
	def drawChooser
    cell = NSButtonCell.alloc.init
    cell.setTitle "Choose your destiny"
    cell.setButtonType(NSRadioButton)

    frame = getFrame(100.0, 100.0, 50.0, 60.0)
		@chooser = matrix = NSMatrix.alloc.initWithFrame_mode_prototype_numberOfRows_numberOfColumns(frame, 
			NSRadioModeMatrix,
			cell,
			2,
			1
		)

		matrix.setIntercellSpacing(NSSize.new(50, 50.0))
    # matrix.setCellSize_((posSize[2], 15))

 		font = NSFont.fontWithName_size("LucidaGrande-Bold", 12)

		arr = matrix.cells
		button = arr.objectAtIndex(0)
		button.setTitle('New user')
		button.setFont(font)

		button = arr.objectAtIndex(1)
		button.setTitle('Existing user')
		button.setFont(font)

		matrix
	end
	
	def drawButton(size, position, text, action)
	  button = NSButton.alloc.initWithFrame(NSRect.new(NSSize.new(*size), NSSize.new(*position)))
	  window.contentView.addSubview(button)
	  button.setBezelStyle(NSTexturedRoundedBezelStyle)
	  button.setTitle(text)
	  button.setTarget(self)
	  button.setEnabled(true)
	  button.setAction(action)
	  button
	end

	def drawLabel(text, coords)
    field = NSTextField.alloc.initWithFrame(getFrame(*coords))
    field.setStringValue(text)
    field.setBezeled(false)
    field.setBordered(false)
    field.setDrawsBackground(false)
    field.setEditable(false)
		field
	end

	def drawInput(type, id, title, x, y)
		klass = type == 'password' ? NSSecureTextField : NSTextField
		label = drawLabel(title, [200, 15, x, y+30])
    input = klass.alloc.initWithFrame(getFrame(200, 25, x, y))
		input.setBezelStyle(NSTextFieldSquareBezel)
    input.setEditable(true)
    input.setSelectable(true)
    # input.setAction_("enter_pressed")
    # input.setTarget(self)
    input.setEnabled(true)
		@inputs[id] = input
		return label, input
	end
	
	def drawTextInput(id, title, x, y)
		return drawInput('text', id, title, x, y)
	end

	def drawPasswordInput(id, title, x, y)
		return drawInput('password', id, title, x, y)
	end

	def drawTab(name)
    tab = NSTabViewItem.alloc().initWithIdentifier(name)
    tab.setLabel(name)

		text = drawLabel(TITLES[name.to_sym], [420, 50, 15, 170])
		tab.view.addSubview(text)

		if name == 'welcome'
			drawWelcome(tab, name)
		elsif name == 'new_user'
			drawNewUser(tab, name)
		elsif name == 'existing_user'
			drawExistingUser(tab, name)
		elsif name == 'success'
			drawSuccess(tab, name)
		else
			raise 'Unknown tab name: ' + name
		end

		tab
	end
	
	def drawTabs
		@tabs = NSTabView.alloc.initWithFrame(getFrame(470, 250, 15, 50))
		TABS.each_with_index do |name, i|
			tab = drawTab(name)
			# tab.view.setHidden(true) if i == (TABS.count-1)
			tabs.addTabViewItem(tab)
		end
		tabs.setTabViewType(NSNoTabsBezelBorder)
		window.contentView.addSubview(tabs)
	end
	
	def getCurrentTab
    item = tabs.selectedTabViewItem
    tabs.indexOfTabViewItem(item)
	end

	def setTab(index)
  	tabs.selectTabViewItemAtIndex(index)
	end
	
	def getDestiny
		x = chooser.selectedRow()
		return x == 0 ? 1 : 2
	end
	
	def changeTab(dir)
		index = getCurrentTab

		if index == 0  # first page
			@prev.setHidden(false)
			dir = getDestiny
		elsif index == 1 && dir == 1
			dir = 2
		elsif index == 2 && dir == -1
			dir = -2
		elsif (index == (TABS.count-1) && dir == 1)
			return speak 'Last page'
		end

		target = index + dir
		if target == 0 # back to welcome
			@prev.setHidden(true)
		elsif target == (TABS.count - 1) # sending info
			# @next.setHidden(true)
			return submitData(index)
		end
		setTab(target)
	end
	
	def parseError(message)
		if message['already been taken']
			return 'Email has been taken. Seems you already signed up!'
		elsif message['Unexpected status code: 401']
			return 'Invalid account credentials. Please try again.'
		end
		message
	end
	
	def showAlert(message)
	 alert = NSAlert.alloc.init
	 alert.setMessageText(message)
   alert.setAlertStyle(NSCriticalAlertStyle)
   # alert.setIcon(nil)
	 alert.runModal()
	end
	
	def showSuccess
		@prev.setHidden(true)
		@next.setTitle('Close')
		@next.setAction('terminate:')
		setTab(TABS.count-1) # last one
	end
	
	def submitData(index)
		if TABS[index] == 'new_user'
			userSignup
		else
			userVerify
		end
	end
	
	def get_value(input_id)
		inputs[input_id].objectValue
	end
	
	def validate_email(email)
		return email.to_s[EMAIL_REGEX] ? true : showAlert('Email address is not valid.') && false
	end

	def validate_present(what, text)
		return text != '' ? true : showAlert("Please type a valid #{what}.") && false
	end

	def validate_length(what, count, text)
		return text.length >= count ? true : showAlert("#{what} needs to be at least #{count} chars long.") && false
	end
	
	def userSignup
		name, email, pass = get_value('name'), get_value('email'), get_value('pass')
		validate_present('Name', name) and validate_email(email) and validate_length('Password', 6, pass) or return

		code, out = run_config("signup -n '#{name}' -e '#{email}' -p '#{pass}'")
		if code == 1
			showAlert(parseError(out.split("\n").last))
		else
			showSuccess
		end
	end
	
	def userVerify
		email, pass = get_value('existing_email'), get_value('existing_pass')
		validate_email(email) and validate_length('Password', 6, pass) or return

		code, out = run_config("authorize --email '#{email}' --password '#{pass}'")
		if code == 1
			showAlert(parseError(out.split("\n").last))
		else
			showSuccess
		end
	end
	
	def run_config(args)
		cmd = "#{PREY_CONFIG} account #{args}"
		out = `#{cmd}`
		code = $?.exitstatus
		return code, out 
	end

  def previous_tab(sender)
		changeTab(-1)
  end

  def next_tab(sender)
		changeTab(1)
  end

	def terminate(sender)
    OSX::NSApp.stop(nil)
	end
	
	def selectAll(sender)
	end
	
	def edit(sender)
	end
	
	def cut(sender)
	end
	
	def copy(sender)
	end

  def speak(str)
    script = NSAppleScript.alloc.initWithSource("say \"#{str}\"")
    script.performSelector_withObject('executeAndReturnError:', nil)
  end
	
	def drawWelcome(tab, name)
		drawImage(PIXMAPS + '/conf/newuser.png', [48, 48, 0, 120], tab.view)
		drawImage(PIXMAPS + '/conf/olduser.png', [48, 48, 0, 50], tab.view)
		matrix = drawChooser
		tab.view.addSubview(matrix)
		label = drawLabel(OPTIONS[:new], [380, 50, 68, 90])
		label.setTextColor(NSColor.grayColor)
		tab.view.addSubview(label)
		label = drawLabel(OPTIONS[:existing], [380, 50, 68, 23])
		label.setTextColor(NSColor.grayColor)
		tab.view.addSubview(label)
	end
	
	def drawNewUser(tab, name)
		elements = []
		elements << drawTextInput('name', 'Your name', 15, 140)
		elements << drawTextInput('email', 'Email', 15, 85)
		elements << drawPasswordInput('pass', 'Password', 15, 30)
		elements.flatten.each do |el|
			tab.view.addSubview(el)			
		end
	end

	def drawExistingUser(tab, name)
		elements = []
		elements << drawTextInput('existing_email', 'Email', 15, 140)
		elements << drawPasswordInput('existing_pass', 'Password', 15, 85)
		elements.flatten.each do |el|
			tab.view.addSubview(el)
		end
	end

	def drawSuccess(tab, name)
		drawImage(PIXMAPS + '/conf/check.png', [96, 88, CENTER-(70), 80], tab.view)
	end

end

def setupMenus(app)
  menubar = NSMenu.new
	appMenuItem = NSMenuItem.alloc.init
  editMenuItem = NSMenuItem.alloc.initWithTitle_action_keyEquivalent('Edit', 'edit:', '')

	appmenu = NSMenu.new
	quitMenuItem = NSMenuItem.alloc.initWithTitle_action_keyEquivalent('Quit', 'terminate:', 'q')
	appMenuItem.setSubmenu(appmenu)

  editMenu = NSMenu.new
  editMenu.addItemWithTitle_action_keyEquivalent('Select All', 'selectAll:', 'a')
  editMenu.addItemWithTitle_action_keyEquivalent('Cut', 'cut:', 'x')
  editMenu.addItemWithTitle_action_keyEquivalent('Copy', 'copy:', 'c')
  editMenu.addItemWithTitle_action_keyEquivalent('Paste', 'paste:', 'v')
	editMenuItem.setSubmenu(editMenu)
  # editMenuItem.setEnabled(true)

	appmenu.addItem(editMenuItem)
	appmenu.addItem(quitMenuItem)

	menubar.addItem(appMenuItem)
	# menubar.addItem(editMenuItem)
	app.setMainMenu(menubar)
end

def openConfig
  app = NSApplication.sharedApplication
	app.setActivationPolicy(NSApplicationActivationPolicyRegular) # allows raising window
  app.setDelegate ConfigDelegate.new
  setupMenus(app)
	app.activateIgnoringOtherApps(true)

  trap('SIGINT') { puts "Ctrl-C received." ; exit(1) }
	app.run
end

if $0 == __FILE__ then 
	openConfig
end