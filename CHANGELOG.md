# Change Log
## [v1.6.2](https://github.com/prey/prey-node-client/tree/v1.6.2) (2016-08-30)
[Full Changelog](https://github.com/prey/prey-node-client/compare/v1.6.1...v1.6.2)

**Fixed bugs:**

- Prey installation with cyrillic characters error [\#58](https://github.com/prey/prey-node-client/issues/58)
- "Empty or outdated config file. Please run ‘config activate’ and retry" [\#161](https://github.com/prey/prey-node-client/issues/161)

**Merged pull requests:**

- Remove mails and browsers profiles data using wipe action on Windows [\#221] (https://github.com/prey/prey-node-client/pull/221) ([javo](https://github.com/javo))
- Commands storage handle using sqlite [\#226] (https://github.com/prey/prey-node-client/pull/226) ([javo](https://github.com/javo))

## [v1.6.1](https://github.com/prey/prey-node-client/tree/v1.6.1) (2016-06-21)
[Full Changelog](https://github.com/prey/prey-node-client/compare/v1.5.1...v1.6.1)

**Fixed bugs:**

- OS version detection error on user-agent settings.
- Windows Lock action using a second screen and on soft shutdown.
- Linux installation error "dpkg: error processing package prey (--configure)" [\#201](https://github.com/prey/prey-node-client/issues/201)

**Merged pull requests:**

- File Retrieval for desktop [\#184] (https://github.com/prey/prey-node-client/pull/184) ([javo](https://github.com/javo))
- File Retrival permissions fix [\#205] (https://github.com/prey/prey-node-client/pull/205) ([javo](https://github.com/javo))
- Correct OS version on user-agent [\#210](https://github.com/prey/prey-node-client/pull/210) ([cyaconi](https://github.com/cyaconi))
- Add new-prey-lock binary. [\#216](https://github.com/prey/prey-node-client/pull/216)

## [v.1.5.1](https://github.com/prey/prey-node-client/tree/v1.5.1) (2016-04-05)
[Full Changelog](https://github.com/prey/prey-node-client/compare/v1.5.0...v1.5.1)

**Fixed bugs:**

- Improved laptop/desktop detection.
- Wi-Fi signal strength on reports is now available for non-English Windows versions.
- Fix for eternal "Reloading config..." bug on new OS X installations.

## [v1.5.0](https://github.com/prey/prey-node-client/tree/v1.5.0) (2015-12-22)
[Full Changelog](https://github.com/prey/prey-node-client/compare/v1.4.2...v1.5.0)

**Fixed bugs:**

- "Empty or outdated config file. Please run ‘config activate’ and retry" while upgrading on OS X El Capitan [\#161](https://github.com/prey/prey-node-client/issues/161)
- Can't install on OS X El Capitan 10.11 [\#147](https://github.com/prey/prey-node-client/issues/147)

**Closed issues:**

- Add support for the latest openSUSE [\#170](https://github.com/prey/prey-node-client/issues/170)
- "Unable to map port: Could not locate gateway on time." [\#168](https://github.com/prey/prey-node-client/issues/168)

**Merged pull requests:**

- Fix issue when verbose mode is disabled [\#177](https://github.com/prey/prey-node-client/pull/177) ([lemavri](https://github.com/lemavri))
- Fix new lock blocking capabilities [\#176](https://github.com/prey/prey-node-client/pull/176) ([lemavri](https://github.com/lemavri))
- Refresh lock binaries cert signature. [\#172](https://github.com/prey/prey-node-client/pull/172) ([lemavri](https://github.com/lemavri))
- Change long-polling strategy to 5secs interval strategy on 5+ instant responses [\#166](https://github.com/prey/prey-node-client/pull/166) ([lemavri](https://github.com/lemavri))
- Fix long polling with proxy [\#165](https://github.com/prey/prey-node-client/pull/165) ([lemavri](https://github.com/lemavri))
- Add new-prey-lock binary. [\#164](https://github.com/prey/prey-node-client/pull/164) ([lemavri](https://github.com/lemavri))
- Fix reconnect delay for notify [\#162](https://github.com/prey/prey-node-client/pull/162) ([lemavri](https://github.com/lemavri))
- Add logic to spawn different lock.exe based on windows version [\#151](https://github.com/prey/prey-node-client/pull/151) ([lemavri](https://github.com/lemavri))

## [v1.4.2](https://github.com/prey/prey-node-client/tree/v1.4.2) (2015-10-01)
[Full Changelog](https://github.com/prey/prey-node-client/compare/v1.4.1...v1.4.2)

**Fixed bugs:**

- Devices don't report location; can't find access points even though Wi-Fi is on [\#95](https://github.com/prey/prey-node-client/issues/95)
- Win 8.1 X64 - 'Get Location' fails on installed desktop, identified as laptop [\#86](https://github.com/prey/prey-node-client/issues/86)
- Windows XP SP3 32 bit  - Not able to finish installation configuration as Existing user [\#85](https://github.com/prey/prey-node-client/issues/85)
- No Prey package for Slitaz distribution of Linux [\#66](https://github.com/prey/prey-node-client/issues/66)

**Closed issues:**

- iOS Failed jobs [\#157](https://github.com/prey/prey-node-client/issues/157)
- Invalid os:  does not exist [\#155](https://github.com/prey/prey-node-client/issues/155)

## [v1.4.1](https://github.com/prey/prey-node-client/tree/v1.4.1) (2015-07-31)
[Full Changelog](https://github.com/prey/prey-node-client/compare/v1.4.0...v1.4.1)

**Fixed bugs:**

- Can't get device location [\#99](https://github.com/prey/prey-node-client/issues/99)

**Closed issues:**

- Screen Lock doesn't work on Arch Linux [\#146](https://github.com/prey/prey-node-client/issues/146)
- Win8+ Nearby AP list not refreshing in tablets [\#145](https://github.com/prey/prey-node-client/issues/145)

**Merged pull requests:**

- Fix WiFi networks refresh in windows [\#148](https://github.com/prey/prey-node-client/pull/148) ([lemavri](https://github.com/lemavri))

## [v1.4.0](https://github.com/prey/prey-node-client/tree/v1.4.0) (2015-07-20)
[Full Changelog](https://github.com/prey/prey-node-client/compare/v1.3.10...v1.4.0)

**Fixed bugs:**

- v1.4.0 is missing semver package in shrinkwrap [\#134](https://github.com/prey/prey-node-client/issues/134)
- Even when users mark the option "Do not take pictures", and these are not included on the reports, the device takes them anyways and blinks its webcam light \(HS:webcam-blinks\) [\#133](https://github.com/prey/prey-node-client/issues/133)
- subprocess installed post-installation script returned error exit status 1 [\#129](https://github.com/prey/prey-node-client/issues/129)
- Advanced options don't persist after rebooting \(HS:advanced-options-persistence\) [\#127](https://github.com/prey/prey-node-client/issues/127)
- Cannot add openSUSE device [\#119](https://github.com/prey/prey-node-client/issues/119)

**Merged pull requests:**

- Disable geoloc for OS X until we deal with whereami authorization [\#143](https://github.com/prey/prey-node-client/pull/143) ([lemavri](https://github.com/lemavri))
- Command persistence. fix \#133, fix \#127 [\#142](https://github.com/prey/prey-node-client/pull/142) ([lemavri](https://github.com/lemavri))
- Add native geolocation as main geoloc strategy. [\#139](https://github.com/prey/prey-node-client/pull/139) ([lemavri](https://github.com/lemavri))
- Update npm-shrinkwrap to include semver [\#132](https://github.com/prey/prey-node-client/pull/132) ([lemavri](https://github.com/lemavri))
- 1.4.0-rc [\#131](https://github.com/prey/prey-node-client/pull/131) ([lemavri](https://github.com/lemavri))

## [v1.3.10](https://github.com/prey/prey-node-client/tree/v1.3.10) (2015-05-12)
[Full Changelog](https://github.com/prey/prey-node-client/compare/v1.3.9...v1.3.10)

**Fixed bugs:**

- \[Win 10\]-Unlocking-Using '1','0' or '\_' for password in prey panel - leads to an error in client [\#110](https://github.com/prey/prey-node-client/issues/110)
- \[ Win 8.1 Pro, Chrome\] : " Alarm Sound "  time is less than the mentioned. [\#107](https://github.com/prey/prey-node-client/issues/107)

**Closed issues:**

- Please Update prey package on NPM! [\#120](https://github.com/prey/prey-node-client/issues/120)

**Merged pull requests:**

- 1.3.10-rc [\#130](https://github.com/prey/prey-node-client/pull/130) ([lemavri](https://github.com/lemavri))
- Syntax and fixes 2 [\#123](https://github.com/prey/prey-node-client/pull/123) ([lemavri](https://github.com/lemavri))

## [v1.3.9](https://github.com/prey/prey-node-client/tree/v1.3.9) (2015-04-07)
[Full Changelog](https://github.com/prey/prey-node-client/compare/v1.3.8...v1.3.9)

**Implemented enhancements:**

- please add Parabola GNU/Linux to your OS list [\#105](https://github.com/prey/prey-node-client/issues/105)

**Fixed bugs:**

- escape emojis when encodeUriCOmponent on geo [\#117](https://github.com/prey/prey-node-client/issues/117)
- \[Win 10\]-Message-If a user writes a message in a column, whole message will not be shown in client [\#112](https://github.com/prey/prey-node-client/issues/112)
- Please add distro  to known OS's [\#94](https://github.com/prey/prey-node-client/issues/94)

**Closed issues:**

- CentOS is not being correctly added to Prey panel. [\#114](https://github.com/prey/prey-node-client/issues/114)

**Merged pull requests:**

- 1.3.9 rc [\#118](https://github.com/prey/prey-node-client/pull/118) ([lemavri](https://github.com/lemavri))

## [v1.3.8](https://github.com/prey/prey-node-client/tree/v1.3.8) (2015-03-20)
[Full Changelog](https://github.com/prey/prey-node-client/compare/v1.3.7...v1.3.8)

**Implemented enhancements:**

- Add method used to get location when sending location data to panel [\#102](https://github.com/prey/prey-node-client/issues/102)

**Fixed bugs:**

- When getter.commands fails, stops scheduling requests. [\#101](https://github.com/prey/prey-node-client/issues/101)

**Merged pull requests:**

- 1.3.8-rc [\#103](https://github.com/prey/prey-node-client/pull/103) ([lemavri](https://github.com/lemavri))

## [v1.3.7](https://github.com/prey/prey-node-client/tree/v1.3.7) (2015-03-11)
[Full Changelog](https://github.com/prey/prey-node-client/compare/v1.3.6...v1.3.7)

**Implemented enhancements:**

- login shell of prey user in ubuntu package better be /bin/false or /usr/sbin/nlogin [\#74](https://github.com/prey/prey-node-client/issues/74)

**Fixed bugs:**

- Stops sending reports if server answers with status 503. \(HS:reports-503\) [\#81](https://github.com/prey/prey-node-client/issues/81)
- Missing "Advanced options" don't persist after system reboot \(HS:advanced-missing-reboot\) [\#57](https://github.com/prey/prey-node-client/issues/57)

**Closed issues:**

- fs: missing callback Error: ENOENT, unlink '/etc/prey/prey.conf' [\#79](https://github.com/prey/prey-node-client/issues/79)
- Error: Cannot find module 'satan' [\#76](https://github.com/prey/prey-node-client/issues/76)
- OS X's com.prey.agent.plist slows system shutdowns \(HS:plist\) [\#75](https://github.com/prey/prey-node-client/issues/75)

**Merged pull requests:**

- Use proxy for every request, not only for posting data. [\#96](https://github.com/prey/prey-node-client/pull/96) ([lemavri](https://github.com/lemavri))
- Windows AppData paths correction in wipe [\#93](https://github.com/prey/prey-node-client/pull/93) ([hantwister](https://github.com/hantwister))
- 1.3.7-rc2 [\#83](https://github.com/prey/prey-node-client/pull/83) ([lemavri](https://github.com/lemavri))

## [v1.3.6](https://github.com/prey/prey-node-client/tree/v1.3.6) (2015-01-13)
[Full Changelog](https://github.com/prey/prey-node-client/compare/v1.3.5...v1.3.6)

**Fixed bugs:**

- Actions don't run on Prey 1.3.5 for Linux [\#61](https://github.com/prey/prey-node-client/issues/61)

**Closed issues:**

- Retina iMac 27" recognized as MacBook by Prey [\#67](https://github.com/prey/prey-node-client/issues/67)
- Can't use prey on Manjaro Linux  [\#45](https://github.com/prey/prey-node-client/issues/45)

**Merged pull requests:**

- 1.3.6pre [\#62](https://github.com/prey/prey-node-client/pull/62) ([lemavri](https://github.com/lemavri))
- Typos logged in the prey.log file [\#55](https://github.com/prey/prey-node-client/pull/55) ([fanuneza](https://github.com/fanuneza))

## [v1.3.5](https://github.com/prey/prey-node-client/tree/v1.3.5) (2015-01-02)
[Full Changelog](https://github.com/prey/prey-node-client/compare/v1.3.4...v1.3.5)

**Fixed bugs:**

- Actions don't run on Prey 1.3.3 for Windows \(HS:node-actions-bug\) [\#56](https://github.com/prey/prey-node-client/issues/56)
- OS X: "Device protected" after install. No setup GUI is launched. Device is not registered \(HS:node-no-gui-bug\) [\#53](https://github.com/prey/prey-node-client/issues/53)
- Exit Code 1073741502 for preyshot.exe \(HS:node-screenshot-bug\) [\#52](https://github.com/prey/prey-node-client/issues/52)

## [v1.3.4](https://github.com/prey/prey-node-client/tree/v1.3.4) (2014-12-29)
[Full Changelog](https://github.com/prey/prey-node-client/compare/v1.3.3...v1.3.4)

**Fixed bugs:**

- OS X: GUI last "Next" step after entering credentials does nothing \(HS:node-gui-finish-bug\) [\#54](https://github.com/prey/prey-node-client/issues/54)

**Closed issues:**

- 1.1.5 continuously crashes and restarts every 5 seconds on Mac [\#40](https://github.com/prey/prey-node-client/issues/40)

## [v1.3.3](https://github.com/prey/prey-node-client/tree/v1.3.3) (2014-12-02)
[Full Changelog](https://github.com/prey/prey-node-client/compare/v1.3.2...v1.3.3)

**Closed issues:**

- Message not shown on OS X 10.10 Yosemite [\#48](https://github.com/prey/prey-node-client/issues/48)

## [v1.3.2](https://github.com/prey/prey-node-client/tree/v1.3.2) (2014-11-28)
[Full Changelog](https://github.com/prey/prey-node-client/compare/v1.3.1...v1.3.2)

## [v1.3.1](https://github.com/prey/prey-node-client/tree/v1.3.1) (2014-11-25)
[Full Changelog](https://github.com/prey/prey-node-client/compare/v1.3.0...v1.3.1)

## [v1.3.0](https://github.com/prey/prey-node-client/tree/v1.3.0) (2014-11-20)
[Full Changelog](https://github.com/prey/prey-node-client/compare/v1.2.10...v1.3.0)

**Closed issues:**

- Installing Mac PKG via the terminal fails [\#49](https://github.com/prey/prey-node-client/issues/49)
- Can't start GUI on Mac OS X 10.10 Yosemite [\#47](https://github.com/prey/prey-node-client/issues/47)
- Hold on! problem in Ubuntu [\#43](https://github.com/prey/prey-node-client/issues/43)
- dmidecode not found in debian [\#42](https://github.com/prey/prey-node-client/issues/42)

**Merged pull requests:**

- New alerts [\#41](https://github.com/prey/prey-node-client/pull/41) ([tomas](https://github.com/tomas))

## [v1.2.10](https://github.com/prey/prey-node-client/tree/v1.2.10) (2014-10-16)
[Full Changelog](https://github.com/prey/prey-node-client/compare/v1.2.9...v1.2.10)

## [v1.2.9](https://github.com/prey/prey-node-client/tree/v1.2.9) (2014-10-14)
[Full Changelog](https://github.com/prey/prey-node-client/compare/v1.2.8...v1.2.9)

**Closed issues:**

- Not working on Fedora 20 [\#44](https://github.com/prey/prey-node-client/issues/44)

## [v1.2.8](https://github.com/prey/prey-node-client/tree/v1.2.8) (2014-10-10)
[Full Changelog](https://github.com/prey/prey-node-client/compare/v1.2.7...v1.2.8)

## [v1.2.7](https://github.com/prey/prey-node-client/tree/v1.2.7) (2014-10-02)
[Full Changelog](https://github.com/prey/prey-node-client/compare/v1.2.6...v1.2.7)

## [v1.2.6](https://github.com/prey/prey-node-client/tree/v1.2.6) (2014-09-29)
[Full Changelog](https://github.com/prey/prey-node-client/compare/v1.2.5...v1.2.6)

## [v1.2.5](https://github.com/prey/prey-node-client/tree/v1.2.5) (2014-09-25)
[Full Changelog](https://github.com/prey/prey-node-client/compare/v1.2.4...v1.2.5)

## [v1.2.4](https://github.com/prey/prey-node-client/tree/v1.2.4) (2014-09-24)
[Full Changelog](https://github.com/prey/prey-node-client/compare/v1.2.3...v1.2.4)

**Closed issues:**

- npm failing to find post script file windows [\#35](https://github.com/prey/prey-node-client/issues/35)
- Beta: Status Messages Cover Link [\#34](https://github.com/prey/prey-node-client/issues/34)
- Beta: Reports Sorted Oldest to Newest [\#33](https://github.com/prey/prey-node-client/issues/33)
- Beta: Only Able to See Reports if Device is Missing... [\#32](https://github.com/prey/prey-node-client/issues/32)
- Install fails on linux [\#31](https://github.com/prey/prey-node-client/issues/31)
- Mac iSight Light Activates When Not Missing [\#30](https://github.com/prey/prey-node-client/issues/30)
- { \[Error: spawn ENOENT\] code: 'ENOENT', errno: 'ENOENT', syscall: 'spawn' } [\#28](https://github.com/prey/prey-node-client/issues/28)
- Problem for finding the version of Prey in the windows registry [\#27](https://github.com/prey/prey-node-client/issues/27)
- Default webcam camera [\#24](https://github.com/prey/prey-node-client/issues/24)
- Can't verify device [\#21](https://github.com/prey/prey-node-client/issues/21)

## [v1.2.3](https://github.com/prey/prey-node-client/tree/v1.2.3) (2014-09-22)
[Full Changelog](https://github.com/prey/prey-node-client/compare/v1.2.2...v1.2.3)

## [v1.2.2](https://github.com/prey/prey-node-client/tree/v1.2.2) (2014-09-05)
[Full Changelog](https://github.com/prey/prey-node-client/compare/v1.2.1...v1.2.2)

**Merged pull requests:**

- 1.2 Release candidate. [\#39](https://github.com/prey/prey-node-client/pull/39) ([tomas](https://github.com/tomas))

## [v1.2.1](https://github.com/prey/prey-node-client/tree/v1.2.1) (2014-08-27)
[Full Changelog](https://github.com/prey/prey-node-client/compare/v1.2.0...v1.2.1)

## [v1.2.0](https://github.com/prey/prey-node-client/tree/v1.2.0) (2014-08-22)
[Full Changelog](https://github.com/prey/prey-node-client/compare/v1.1.6...v1.2.0)

## [v1.1.6](https://github.com/prey/prey-node-client/tree/v1.1.6) (2014-08-19)
[Full Changelog](https://github.com/prey/prey-node-client/compare/chrome-branch...v1.1.6)

## [chrome-branch](https://github.com/prey/prey-node-client/tree/chrome-branch) (2014-05-28)
[Full Changelog](https://github.com/prey/prey-node-client/compare/v1.1.5...chrome-branch)

**Closed issues:**

- 1.1.3 continuously crashes and restarts every 5 seconds on Mac [\#37](https://github.com/prey/prey-node-client/issues/37)

## [v1.1.5](https://github.com/prey/prey-node-client/tree/v1.1.5) (2014-05-21)
[Full Changelog](https://github.com/prey/prey-node-client/compare/v1.1.4...v1.1.5)

## [v1.1.4](https://github.com/prey/prey-node-client/tree/v1.1.4) (2014-05-16)
[Full Changelog](https://github.com/prey/prey-node-client/compare/v1.1.3...v1.1.4)

## [v1.1.3](https://github.com/prey/prey-node-client/tree/v1.1.3) (2014-05-01)
[Full Changelog](https://github.com/prey/prey-node-client/compare/v1.1.2...v1.1.3)

## [v1.1.2](https://github.com/prey/prey-node-client/tree/v1.1.2) (2014-05-01)
[Full Changelog](https://github.com/prey/prey-node-client/compare/v1.1.1...v1.1.2)

## [v1.1.1](https://github.com/prey/prey-node-client/tree/v1.1.1) (2014-05-01)
[Full Changelog](https://github.com/prey/prey-node-client/compare/v1.1.0...v1.1.1)

## [v1.1.0](https://github.com/prey/prey-node-client/tree/v1.1.0) (2014-04-10)
[Full Changelog](https://github.com/prey/prey-node-client/compare/v1.0.8...v1.1.0)

## [v1.0.8](https://github.com/prey/prey-node-client/tree/v1.0.8) (2014-01-29)
[Full Changelog](https://github.com/prey/prey-node-client/compare/v1.0.7...v1.0.8)

## [v1.0.7](https://github.com/prey/prey-node-client/tree/v1.0.7) (2014-01-09)
[Full Changelog](https://github.com/prey/prey-node-client/compare/v1.0.6...v1.0.7)

## [v1.0.6](https://github.com/prey/prey-node-client/tree/v1.0.6) (2013-12-30)
[Full Changelog](https://github.com/prey/prey-node-client/compare/v1.0.5...v1.0.6)

**Merged pull requests:**

- Update reference link to unsafe-perm doc in readme [\#29](https://github.com/prey/prey-node-client/pull/29) ([lemavri](https://github.com/lemavri))

## [v1.0.5](https://github.com/prey/prey-node-client/tree/v1.0.5) (2013-10-29)
[Full Changelog](https://github.com/prey/prey-node-client/compare/v1.0.4...v1.0.5)

**Closed issues:**

- TODO: Add auto-complete support for the Console driver. [\#22](https://github.com/prey/prey-node-client/issues/22)

**Merged pull requests:**

- Local db [\#26](https://github.com/prey/prey-node-client/pull/26) ([raliste](https://github.com/raliste))

## [v1.0.4](https://github.com/prey/prey-node-client/tree/v1.0.4) (2013-10-06)
[Full Changelog](https://github.com/prey/prey-node-client/compare/v1.0.3...v1.0.4)

**Merged pull requests:**

- Client API refactor [\#25](https://github.com/prey/prey-node-client/pull/25) ([tomas](https://github.com/tomas))

## [v1.0.3](https://github.com/prey/prey-node-client/tree/v1.0.3) (2013-08-13)
[Full Changelog](https://github.com/prey/prey-node-client/compare/v1.0.2...v1.0.3)

## [v1.0.2](https://github.com/prey/prey-node-client/tree/v1.0.2) (2013-08-13)
[Full Changelog](https://github.com/prey/prey-node-client/compare/v1.0.1...v1.0.2)

## [v1.0.1](https://github.com/prey/prey-node-client/tree/v1.0.1) (2013-08-09)
[Full Changelog](https://github.com/prey/prey-node-client/compare/v1.0.0...v1.0.1)

## [v1.0.0](https://github.com/prey/prey-node-client/tree/v1.0.0) (2013-07-12)
[Full Changelog](https://github.com/prey/prey-node-client/compare/v0.10.0...v1.0.0)

## [v0.10.0](https://github.com/prey/prey-node-client/tree/v0.10.0) (2013-06-03)
[Full Changelog](https://github.com/prey/prey-node-client/compare/v0.9.2...v0.10.0)

**Fixed bugs:**

- \[OSX\] Battery Info crashes on AC Power [\#2](https://github.com/prey/prey-node-client/issues/2)

**Closed issues:**

- \[Network Driver/Mac\] Access Point Parsing fails [\#20](https://github.com/prey/prey-node-client/issues/20)
- npm install fails on Mountain Lion [\#18](https://github.com/prey/prey-node-client/issues/18)
- Motion trigger: Add Windows support [\#17](https://github.com/prey/prey-node-client/issues/17)
- Motion trigger: Add Linux support [\#16](https://github.com/prey/prey-node-client/issues/16)
- Sound trigger: Add Windows support [\#15](https://github.com/prey/prey-node-client/issues/15)
- Sound trigger: Add Linux support [\#14](https://github.com/prey/prey-node-client/issues/14)
- Webcam provider: Add Windows support [\#13](https://github.com/prey/prey-node-client/issues/13)
- Screenshot provider: Add Windows support [\#12](https://github.com/prey/prey-node-client/issues/12)
- Hardware provider: Add Windows support. [\#11](https://github.com/prey/prey-node-client/issues/11)
- Network provider: Add Windows support. [\#10](https://github.com/prey/prey-node-client/issues/10)
- System provider: Finish get\_battery\_info for Windows. [\#9](https://github.com/prey/prey-node-client/issues/9)
- Remote Terminal: Add Windows support. [\#8](https://github.com/prey/prey-node-client/issues/8)
- Remote Desktop: Add Windows support. [\#7](https://github.com/prey/prey-node-client/issues/7)
- Lock: Add support for Windows. [\#6](https://github.com/prey/prey-node-client/issues/6)
- Alarm: Add support for Windows. [\#5](https://github.com/prey/prey-node-client/issues/5)
- Finish Windows's set/get delay functions. [\#4](https://github.com/prey/prey-node-client/issues/4)

## [v0.9.2](https://github.com/prey/prey-node-client/tree/v0.9.2) (2013-01-22)
[Full Changelog](https://github.com/prey/prey-node-client/compare/v0.2...v0.9.2)

**Merged pull requests:**

- Hi! I fixed some code for you! [\#3](https://github.com/prey/prey-node-client/pull/3) ([node-migrator-bot](https://github.com/node-migrator-bot))

## [v0.2](https://github.com/prey/prey-node-client/tree/v0.2) (2011-10-27)
[Full Changelog](https://github.com/prey/prey-node-client/compare/v0.1...v0.2)

## [v0.1](https://github.com/prey/prey-node-client/tree/v0.1) (2011-08-27)


\* *This Change Log was automatically generated by [github_changelog_generator](https://github.com/skywinder/Github-Changelog-Generator)*
