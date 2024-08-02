# Change Log

## [v1.12.15](https://github.com/prey/prey-node-client/tree/v1.12.15) (2024-08-02)
[Full Changelog](https://github.com/prey/prey-node-client/compare/v1.12.14..v1.12.15)

- Fix: Removes device key configuration second layer. [\#1030](https://github.com/prey/prey-node-client/pull/1030) ([SoraKenji](https://github.com/SoraKenji))

## [v1.12.14](https://github.com/prey/prey-node-client/tree/v1.12.14) (2024-07-31)
[Full Changelog](https://github.com/prey/prey-node-client/compare/v1.12.13..v1.12.14)

- Fix: Removes send location when ws reconnection. [\#1026](https://github.com/prey/prey-node-client/pull/1026) ([SoraKenji](https://github.com/SoraKenji))

## [v1.12.13](https://github.com/prey/prey-node-client/tree/v1.12.13) (2024-07-30)
[Full Changelog](https://github.com/prey/prey-node-client/compare/v1.12.12..v1.12.13)

- Fix: Fixes error with null variables in specs report. [\#1024](https://github.com/prey/prey-node-client/pull/1024) ([SoraKenji](https://github.com/SoraKenji))

## [v1.12.12](https://github.com/prey/prey-node-client/tree/v1.12.12) (2024-07-30)
[Full Changelog](https://github.com/prey/prey-node-client/compare/v1.12.11..v1.12.12)

- Fix: Fixes problem with variable memory reference on specs report. [\#1022](https://github.com/prey/prey-node-client/pull/1022) ([SoraKenji](https://github.com/SoraKenji))

## [v1.12.11](https://github.com/prey/prey-node-client/tree/v1.12.11) (2024-07-29)
[Full Changelog](https://github.com/prey/prey-node-client/compare/v1.12.10..v1.12.11)

- Fix: Fixes issues with device key duplication on PDC start. [\#1015](https://github.com/prey/prey-node-client/pull/1015) ([SoraKenji](https://github.com/SoraKenji))

- Feat: Adds feature that sends location on every recconnect on WS. Its going to help with connection state issues on Prey Platform. [\#1018](https://github.com/prey/prey-node-client/pull/1018) ([Beregcamlost](https://github.com/beregcamlost))

- Fix: Removes data from hardware changed and triggers refactor. This is going to fix misrepresentation of device's current state and its changes. [\#1019](https://github.com/prey/prey-node-client/pull/1019) ([SoraKenji](https://github.com/SoraKenji))

## [v1.12.10](https://github.com/prey/prey-node-client/tree/v1.12.10) (2024-07-01)
[Full Changelog](https://github.com/prey/prey-node-client/compare/v1.12.9..v1.12.10)

- Fix: Fixes the way that prey get the first time location. [\#981](https://github.com/prey/prey-node-client/pull/981) ([SoraKenji](https://github.com/SoraKenji)) 

- Feat: Adds new action to request local location premission. [\#1002](https://github.com/prey/prey-node-client/pull/1002) ([SoraKenji](https://github.com/SoraKenji)) 

- Fix: Improvement on get logged user function. [\#1005](https://github.com/prey/prey-node-client/pull/1005) ([SoraKenji](https://github.com/SoraKenji))

- Fix: Adds security improvements to prey lock binary. [\#1009](https://github.com/prey/prey-node-client/pull/1009) ([SoraKenji](https://github.com/SoraKenji))

- Chore: Adds new cli command to enable debug logs on prey.log file. [\#1012](https://github.com/prey/prey-node-client/pull/1012) ([SoraKenji](https://github.com/SoraKenji))

## [v1.12.9](https://github.com/prey/prey-node-client/tree/v1.12.9) (2024-04-30)
[Full Changelog](https://github.com/prey/prey-node-client/compare/v1.12.8..v1.12.9)

- Fix: Add callback to function done in Osquery action. [\#997](https://github.com/prey/prey-node-client/pull/996) ([SoraKenji](https://github.com/SoraKenji))([Beregcamlost](https://github.com/beregcamlost))

- Feat: Remove osquery on Prey uninstall hook. [\#990](https://github.com/prey/prey-node-client/pull/996) ([SoraKenji](https://github.com/SoraKenji))([Beregcamlost](https://github.com/beregcamlost))

## [v1.12.8](https://github.com/prey/prey-node-client/tree/v1.12.8) (2024-04-22)
[Full Changelog](https://github.com/prey/prey-node-client/compare/v1.12.7..v1.12.8)

- Fix: Removes the double device key request on PDC when installed through MSI. [\#996](https://github.com/prey/prey-node-client/pull/996) ([SoraKenji](https://github.com/SoraKenji))([Beregcamlost](https://github.com/beregcamlost))

- Fix: Removes some code from updater.js. This piece of code had an error when the variable 'err' is falsy. [\#993](https://github.com/prey/prey-node-client/pull/993) ([SoraKenji](https://github.com/SoraKenji))([Beregcamlost](https://github.com/beregcamlost))

- Fix: Added name of event in payload to backend API in push list of location permissions (native and wifi) in MacOS. [\#991](https://github.com/prey/prey-node-client/pull/991) ([SoraKenji](https://github.com/SoraKenji))([Beregcamlost](https://github.com/beregcamlost))

- Fix: Removed verification of slots when links a device to user's account. [\#933](https://github.com/prey/prey-node-client/pull/933) ([SoraKenji](https://github.com/SoraKenji))([Beregcamlost](https://github.com/beregcamlost))

## [v1.12.7](https://github.com/prey/prey-node-client/tree/v1.12.7) (2024-04-11)
[Full Changelog](https://github.com/prey/prey-node-client/compare/v1.12.6..v1.12.7)

- Fix: catch the exception in connection refused. [\#988](https://github.com/prey/prey-node-client/pull/980) ([SoraKenji](https://github.com/SoraKenji))([Beregcamlost](https://github.com/beregcamlost))

## [v1.12.6](https://github.com/prey/prey-node-client/tree/v1.12.6) (2024-04-11)
[Full Changelog](https://github.com/prey/prey-node-client/compare/v1.12.5..v1.12.6)

- fix: new prey-user that fix owner permissions on binary. [\#986](https://github.com/prey/prey-node-client/pull/980) ([SoraKenji](https://github.com/SoraKenji))([Beregcamlost](https://github.com/beregcamlost))

## [v1.12.5](https://github.com/prey/prey-node-client/tree/v1.12.5) (2024-04-10)
[Full Changelog](https://github.com/prey/prey-node-client/compare/v1.12.4..v1.12.5)

- Add new version of trinity bin for Windows and MacOS. [\#980](https://github.com/prey/prey-node-client/pull/980) ([SoraKenji](https://github.com/SoraKenji))([Beregcamlost](https://github.com/beregcamlost))

- Fix on new prey-user bin when creating or restoring prey user. [\#979](https://github.com/prey/prey-node-client/pull/979) ([SoraKenji](https://github.com/SoraKenji))([Beregcamlost](https://github.com/beregcamlost))

- Fix double callback on local socket management. [\#978](https://github.com/prey/prey-node-client/pull/978) ([SoraKenji](https://github.com/SoraKenji))([Beregcamlost](https://github.com/beregcamlost))

- Fix make sockets only available for MacOS. [\#977](https://github.com/prey/prey-node-client/pull/977) ([SoraKenji](https://github.com/SoraKenji))([Beregcamlost](https://github.com/beregcamlost))

- Fix on osquery action to call event stop properly. [\#976](https://github.com/prey/prey-node-client/pull/976) ([SoraKenji](https://github.com/SoraKenji))([Beregcamlost](https://github.com/beregcamlost))

- Send message "watcher" at the beginning to local socket in MacOS. [\#975](https://github.com/prey/prey-node-client/pull/975) ([SoraKenji](https://github.com/SoraKenji))([Beregcamlost](https://github.com/beregcamlost))

- New MacOS trinity binary for universal usage. [\#973](https://github.com/prey/prey-node-client/pull/973) ([SoraKenji](https://github.com/SoraKenji))([Beregcamlost](https://github.com/beregcamlost))

- New binary prey-user's version 1.0.2 for universal usage. [\#972](https://github.com/prey/prey-node-client/pull/972) ([SoraKenji](https://github.com/SoraKenji))([Beregcamlost](https://github.com/beregcamlost))

## [v1.12.4](https://github.com/prey/prey-node-client/tree/v1.12.4) (2024-03-17)
[Full Changelog](https://github.com/prey/prey-node-client/compare/v1.12.3..v1.12.4)

- Fixes native strategy for Location in MacOS
- MacOS permission (only Location) added to database in order to have a back up and update them accordingly.
- Removes IP package dependency.
- Adds local socket feature for MacOS in order to connect with new prey-user binary to interchange data.

[\#945](https://github.com/prey/prey-node-client/pull/945) ([SoraKenji](https://github.com/SoraKenji))([Beregcamlost](https://github.com/beregcamlost))

## [v1.12.3](https://github.com/prey/prey-node-client/tree/v1.12.3) (2024-03-04)
[Full Changelog](https://github.com/prey/prey-node-client/compare/v1.12.2..v1.12.3)

- Adds osquery installation feature for Windows and Mac. [\#941](https://github.com/prey/prey-node-client/pull/941) ([SoraKenji](https://github.com/SoraKenji))([Beregcamlost](https://github.com/beregcamlost))

- Validation for Prey configuration's properties in data base have been updated. [\#938](https://github.com/prey/prey-node-client/pull/938) ([SoraKenji](https://github.com/SoraKenji))([Beregcamlost](https://github.com/beregcamlost))

## [v1.12.2](https://github.com/prey/prey-node-client/tree/v1.12.2) (2024-02-08)
[Full Changelog](https://github.com/prey/prey-node-client/compare/v1.12.1..v1.12.2)

**Merged pull requests:**

- fix on location aware tracking. [\#935](https://github.com/prey/prey-node-client/pull/935) ([SoraKenji](https://github.com/SoraKenji))([Beregcamlost](https://github.com/beregcamlost))

## [v1.12.1](https://github.com/prey/prey-node-client/tree/v1.12.1) (2024-01-23)
[Full Changelog](https://github.com/prey/prey-node-client/compare/v1.12.0..v1.12.1)

**Merged pull requests:**

- Remove memoize from get_firmware_info. [\#931](https://github.com/prey/prey-node-client/pull/931) ([SoraKenji](https://github.com/SoraKenji))([Beregcamlost](https://github.com/beregcamlost))

- Fix on hasBattery function when powershell is not found. [\#929](https://github.com/prey/prey-node-client/pull/929) ([SoraKenji](https://github.com/SoraKenji))([Beregcamlost](https://github.com/beregcamlost))

## [v1.12.0](https://github.com/prey/prey-node-client/tree/v1.12.0) (2024-01-22)
[Full Changelog](https://github.com/prey/prey-node-client/compare/v1.11.10..v1.12.0)

**Merged pull requests:**

- New way to use the configuration. Prey.conf file is no longer needed since all the config data is stored in the sqlite database. [\#923](https://github.com/prey/prey-node-client/pull/923) ([SoraKenji](https://github.com/SoraKenji))([Beregcamlost](https://github.com/beregcamlost))

- Adds Winsvc 2.0.17 and a new version of Fenix binary. [\#921](https://github.com/prey/prey-node-client/pull/921) ([SoraKenji](https://github.com/SoraKenji))([Beregcamlost](https://github.com/beregcamlost))

- Improvement in check device type (laptop, desktop) on Windows. [\#919](https://github.com/prey/prey-node-client/pull/919) ([SoraKenji](https://github.com/SoraKenji))([Beregcamlost](https://github.com/beregcamlost))

- Checks Killswitch compatibility in Prey start. [\#913](https://github.com/prey/prey-node-client/pull/913) ([SoraKenji](https://github.com/SoraKenji))([Beregcamlost](https://github.com/beregcamlost))

- Fixes the way Prey determinates OS architecture in MacOS. [\#905](https://github.com/prey/prey-node-client/pull/905) ([SoraKenji](https://github.com/SoraKenji))([Beregcamlost](https://github.com/beregcamlost))

- Removes plugin folder from repository since Prey is not offering a different service. [\#900](https://github.com/prey/prey-node-client/pull/900) ([SoraKenji](https://github.com/SoraKenji))([Beregcamlost](https://github.com/beregcamlost))

- Adds a way to test if Killswitch feature is able to run on the device. [\#899](https://github.com/prey/prey-node-client/pull/899) ([SoraKenji](https://github.com/SoraKenji))([Beregcamlost](https://github.com/beregcamlost))

- Fix on `heartbeatTimed` function implementation for Websocket in order to solve a bug where Prey could get stuck without connection to servers. [\#898](https://github.com/prey/prey-node-client/pull/898) ([SoraKenji](https://github.com/SoraKenji))([Beregcamlost](https://github.com/beregcamlost))

## [v1.11.10](https://github.com/prey/prey-node-client/tree/v1.11.10) (2023-10-30)
[Full Changelog](https://github.com/prey/prey-node-client/compare/v1.11.9..v1.11.10)

**Merged pull requests:**

- Fix on duplicate `api_key` on fresh install. This removes the second `api_key` on default value in `prey.conf`. [\#883](https://github.com/prey/prey-node-client/pull/883) ([SoraKenji](https://github.com/SoraKenji))([Beregcamlost](https://github.com/beregcamlost))

- Wipe feature now can receive more options from the service. This allows to configure the way wipe is going to work on the device. [\#884](https://github.com/prey/prey-node-client/pull/884) ([SoraKenji](https://github.com/SoraKenji))([Beregcamlost](https://github.com/beregcamlost))

- Refactor and fix of the `screen lock` feature for Ubuntu client, now it works on Ubuntu with Desktop Enviroment Gnome and KDE from Prey v1.11.10. [\#885](https://github.com/prey/prey-node-client/pull/885) ([SoraKenji](https://github.com/SoraKenji))([Beregcamlost](https://github.com/beregcamlost))

- Remove `nircmd` from app cause it was being flagged as a threat despite is not a malware. [\#892](https://github.com/prey/prey-node-client/pull/892) ([SoraKenji](https://github.com/SoraKenji))([Beregcamlost](https://github.com/beregcamlost))

- Change the take picture behavior on windows. Now uses snaphot.exe first instead of prey-webcam.exe and change the name of the picture and screenshot files to reduce size of temporary files stored. [\#893](https://github.com/prey/prey-node-client/pull/893) [\#894](https://github.com/prey/prey-node-client/pull/894) ([SoraKenji](https://github.com/SoraKenji))([Beregcamlost](https://github.com/beregcamlost))

## [v1.11.9](https://github.com/prey/prey-node-client/tree/v1.11.9) (2023-09-28)
[Full Changelog](https://github.com/prey/prey-node-client/compare/v1.11.8..v1.11.9)

**Merged pull requests:**

- Change Prey.app functionality to make sure Prey has access to Picture and Screenshot files when device is missing and it needs to take them. [\#876](https://github.com/prey/prey-node-client/pull/876) ([SoraKenji](https://github.com/SoraKenji))([Beregcamlost](https://github.com/beregcamlost))

## [v1.11.8](https://github.com/prey/prey-node-client/tree/v1.11.8) (2023-09-04)
[Full Changelog](https://github.com/prey/prey-node-client/compare/v1.11.7..v1.11.8)

**Merged pull requests:**

- New configuration data for Factory Reset in Windows. Changes task's priority to ensure it'll run even on multiple unexpected cases. [\#869](https://github.com/prey/prey-node-client/pull/869) ([SoraKenji](https://github.com/SoraKenji))([Beregcamlost](https://github.com/beregcamlost))

- For Windows clients, Prey tries to send two different webcam pictures and there was an issue because those two tasks were interefing with each other. Now one runs after the other eliminating that error. A new screenshot software was added, now Prey's capable to take a screenshot of all screens. [\#867](https://github.com/prey/prey-node-client/pull/867) ([SoraKenji](https://github.com/SoraKenji))([Beregcamlost](https://github.com/beregcamlost))

## [v1.11.7](https://github.com/prey/prey-node-client/tree/v1.11.7) (2023-08-08)
[Full Changelog](https://github.com/prey/prey-node-client/compare/v1.11.6..v1.11.7)

**Merged pull requests:**

- For screenshots there was a limit of 1.5 MB to upload, but now it's increased to 20 MB. [\#863](https://github.com/prey/prey-node-client/pull/863) ([SoraKenji](https://github.com/SoraKenji))([Beregcamlost](https://github.com/beregcamlost))

- New wpxsvc (WinSVC) version 2.0.15. It adds a new feature to delete Fenix from Task Scheduler in Windows. [\#860](https://github.com/prey/prey-node-client/pull/860) ([SoraKenji](https://github.com/SoraKenji))([Beregcamlost](https://github.com/beregcamlost))

- Fix for Mac OS devices marked as missing, their reports now include screenshots and pictures. [\#832](https://github.com/prey/prey-node-client/pull/832) ([SoraKenji](https://github.com/SoraKenji))([Beregcamlost](https://github.com/beregcamlost))

- Screen Lock issue corrected for users with multiple virtual desktops, all desktops are now successfully locked on Mac OS. [\#830](https://github.com/prey/prey-node-client/pull/830) ([SoraKenji](https://github.com/SoraKenji))

- Improvement to minimize errors when checking the “winsvc” version against the server version upgrade. [\#826](https://github.com/prey/prey-node-client/pull/826) ([SoraKenji](https://github.com/SoraKenji))

- Fix mitigates errors when prey-user binary periodically checks on the main service on Mac OS. [\#824](https://github.com/prey/prey-node-client/pull/824) ([SoraKenji](https://github.com/SoraKenji))

## [v1.11.6](https://github.com/prey/prey-node-client/tree/v1.11.6) (2023-07-24)
[Full Changelog](https://github.com/prey/prey-node-client/compare/v1.11.5..v1.11.6)

**Merged pull requests:**

- Information gathering optimizing for Missing Report feature, and bug fix to image retrieval process when the camera is being used on zoom/teams calls. [\#812](https://github.com/prey/prey-node-client/pull/812) ([SoraKenji](https://github.com/SoraKenji))

- Accuracy improvement for location data going back to version 1.11.4's when sorting wifi network data. Enhancement includes network filtering. (https://developers.google.com/maps/documentation/geolocation/requests-geolocation#sample-requests) [\#806](https://github.com/prey/prey-node-client/pull/806) ([SoraKenji](https://github.com/SoraKenji))

- Database storage revision for created actions that are not persistent. If they trigger over certain conditions, even if the system fails to call them, then they won’t be saved in the database. 
[\#803](https://github.com/prey/prey-node-client/pull/803) ([SoraKenji](https://github.com/SoraKenji))

- ESLint npm package was updated, going from 8.39.0 or above, to 8.44.0 or above. [\#802](https://github.com/prey/prey-node-client/pull/802) ([SoraKenji](https://github.com/SoraKenji))

- xml2js npm package was updated going from 0.4.19 to 0.5.0 or above. [\#801](https://github.com/prey/prey-node-client/pull/801) 
([SoraKenji](https://github.com/SoraKenji))

- SemVer npm package was updated going from 5.6.0 or above, to 5.1.2 or above. [\#800](https://github.com/prey/prey-node-client/pull/800) ([SoraKenji](https://github.com/SoraKenji))

- JSDoc npm package was updated going from 3.6.10 or above, to 4.0.2 or above. Package changes to dev dependency [\#799](https://github.com/prey/prey-node-client/pull/799) ([SoraKenji](https://github.com/SoraKenji))

- npm package was updated to async from 2.6.1 to 2.6.4. [\#798](https://github.com/prey/prey-node-client/pull/798) ([SoraKenji](https://github.com/SoraKenji))

- SQLite3 npm package was updated from 5.1.2 to 5.1.5. [\#797](https://github.com/prey/prey-node-client/pull/797) ([SoraKenji](https://github.com/SoraKenji))

- Updates to Loan creation/modification process. The browser requests a change verification call from Prey to ensure data reliability. [\#795](https://github.com/prey/prey-node-client/pull/795) ([SoraKenji](https://github.com/SoraKenji))

- Package.json modification to differentiate “npm install” instruction from “npm run post_install/pre_uninstall/post_update” [\#792](https://github.com/prey/prey-node-client/pull/792) ([SoraKenji](https://github.com/SoraKenji))

## [v1.11.5](https://github.com/prey/prey-node-client/tree/v1.11.5) (2023-06-29)
[Full Changelog](https://github.com/prey/prey-node-client/compare/v1.11.4..v1.11.5)

**Merged pull requests:**

- Adds Fenix.exe and new WinSVC version 2.0.14. It also adds a feature to delete Fenix task from Task Scheduler in Windows when uninstalling Prey [\#786](https://github.com/prey/prey-node-client/pull/786) ([SoraKenji](https://github.com/SoraKenji))

- It adds a feature to call WinSVC in order to detect and recognize when a new version is found and autoupdate event is starting [\#785](https://github.com/prey/prey-node-client/pull/785) ([SoraKenji](https://github.com/SoraKenji))

- Now get_status accepts more than one callback to be called when finished, this fixes an error when get_status get two or more calls before finished [\#778](https://github.com/prey/prey-node-client/pull/778) ([SoraKenji](https://github.com/SoraKenji))

- Fixes unit and functional tests in the repository [\#776](https://github.com/prey/prey-node-client/pull/776) ([SoraKenji](https://github.com/SoraKenji))

- Improves wifi connections order before sending it to backend to, in some cases, get a better location accuracy [\#771](https://github.com/prey/prey-node-client/pull/771) ([JohaoRosasRosillo](https://github.com/JohaoRosasRosillo))

- Add prey_restarts.log to Windows in order to know unix timestamps of last 5 restarts [\#767](https://github.com/prey/prey-node-client/pull/767) ([SoraKenji](https://github.com/SoraKenji))

- Fix problem when connecting and disconnecting from internet happens to quickly making a bunch of emails being send when geofences are configured [\#766](https://github.com/prey/prey-node-client/pull/766) ([SoraKenji](https://github.com/SoraKenji))

- Add acknowledge message to server in order to inform reception and acceptance of actions from server [\#765](https://github.com/prey/prey-node-client/pull/765) ([JohaoRosasRosillo](https://github.com/JohaoRosasRosillo))

- Fixes proxy usage for Prey client. In versions 1.11.2 - 1.11.3 there was a problem with that portion of the code that made Prey restart itself over and over until user changes try_proxy property inside prey.conf file [\#749](https://github.com/prey/prey-node-client/pull/749) ([SoraKenji](https://github.com/SoraKenji))

- Add new prey-user binary version featuring a change for cases when database is created as own as root and this now change that to the corresponding user.

- Fix in get_active_access_point for Windows. In some cases, this function for obtaining wifi networks didn't return anything making the Prey client restart [\#728](https://github.com/prey/prey-node-client/pull/728) ([JohaoRosasRosillo](https://github.com/JohaoRosasRosillo))

- File changes to delete/modify deprecated code. Since Prey is running over different versions of NodeJS binary, some code gets deprecated from version to version, so the code was changed in order to keep it clean and functioning [\#727](https://github.com/prey/prey-node-client/pull/727) ([SoraKenji](https://github.com/SoraKenji))

- Updating library Archiver to 5.3.1. Archiver is needed to zip log files and some other Prey files when log retrieval is working, so in cases when the NodeJS version is 16.18.0, Archiver's verison needed to be 5.3.1 or above [\#725](https://github.com/prey/prey-node-client/pull/725) ([JohaoRosasRosillo](https://github.com/JohaoRosasRosillo))

- New way to kill off services when uninstalling in Windows. When doing so Prey needs to kill node service in order to delete the folder in Windows. Trying to kill it only using taskkill.exe could not work, so Prey added a new way to kill it [\#717](https://github.com/prey/prey-node-client/pull/717) ([SoraKenji](https://github.com/SoraKenji))

- Added fix for location in Ubuntu in order to validate MAC address to obtain more accurate locations [\#716](https://github.com/prey/prey-node-client/pull/716) ([JohaoRosasRosillo](https://github.com/JohaoRosasRosillo))

- Remove Prey's files in temp. Deleting temporary files left by Prey client when installing [\#713](https://github.com/prey/prey-node-client/pull/713) ([JohaoRosasRosillo](https://github.com/JohaoRosasRosillo))

- Send prey-user binary's version to backend. Send prey-user version to Prey backend in order to have more data from each device [\#712](https://github.com/prey/prey-node-client/pull/712) ([JohaoRosasRosillo](https://github.com/JohaoRosasRosillo))

## [v1.11.4](https://github.com/prey/prey-node-client/tree/v1.11.4) (2023-04-04)
[Full Changelog](https://github.com/prey/prey-node-client/compare/v1.11.3..v1.11.4)

**Merged pull requests:**

- Fixes proxy usage for Prey client. In versions 1.11.2 - 1.11.3 there was a problem with that portion of the code that made Prey restart itself over and over until user changes try_proxy property inside prey.conf file [\#749](https://github.com/prey/prey-node-client/pull/749) ([SoraKenji](https://github.com/SoraKenji))

## [v1.11.3](https://github.com/prey/prey-node-client/tree/v1.11.3) (2023-03-27)
[Full Changelog](https://github.com/prey/prey-node-client/compare/v1.11.2..v1.11.3)

**Merged pull requests:**

- Adds prey-user v0.0.3 as a universal binary. Now prey-user binary for MacOS is native for both Apple Silicon and Apple Intel https://github.com/prey/prey-node-client/pull/747 ([SoraKenji](https://github.com/SoraKenji))


## [v1.11.2](https://github.com/prey/prey-node-client/tree/v1.11.2) (2023-03-24)
[Full Changelog](https://github.com/prey/prey-node-client/compare/v1.11.1..v1.11.2)

**Merged pull requests:**

- Fix/max listeners exceeded warning on network state changed [\#741](https://github.com/prey/prey-node-client/pull/741) ([SoraKenji](https://github.com/SoraKenji))

## [v1.11.1](https://github.com/prey/prey-node-client/tree/v1.11.1) (2023-03-07)
[Full Changelog](https://github.com/prey/prey-node-client/compare/v1.11.0..v1.11.1)

**Merged pull requests:**

- Fixes an issue when updating to newer version on Windows [\#722](https://github.com/prey/prey-node-client/pull/722) ([SoraKenji](https://github.com/SoraKenji))

- Fixes issue with automations only retrieving data when Prey Client in initialize [\#718](https://github.com/prey/prey-node-client/pull/718) ([SoraKenji](https://github.com/SoraKenji))

- Now on when uninstalling, it deletes Prey folder on Windows. This will only work with the new installer and forward so if Prey auto update from older version, this won't work.  This change is related to Prey-client-distribution repository ([SoraKenji](https://github.com/SoraKenji))

## [v1.11.0](https://github.com/prey/prey-node-client/tree/v1.11.0) (2022-12-14)
[Full Changelog](https://github.com/prey/prey-node-client/compare/v1.10.11..v1.11.0)

**Merged pull requests:**

- New version WinSVC 2.0.11. Improved autoupdate [\#696](https://github.com/prey/prey-node-client/pull/696) ([SoraKenji](https://github.com/SoraKenji))

- Added arm64 native support [\#688](https://github.com/prey/prey-node-client/pull/688) ([SoraKenji](https://github.com/SoraKenji)) ([patriciojofre](https://github.com/patriciojofre))

- Fixed comparation between old and new hardware information. [\#685](https://github.com/prey/prey-node-client/pull/695) ([JohaoRosasRosillo](https://github.com/JohaoRosasRosillo))

## [v1.10.11](https://github.com/prey/prey-node-client/tree/v1.10.11) (2022-09-07)
[Full Changelog](https://github.com/prey/prey-node-client/compare/v1.10.10..v1.10.11)

**Merged pull requests:**

- Fix callback when sending encrypt information. [\#691](https://github.com/prey/prey-node-client/pull/691) ([JohaoRosasRosillo](https://github.com/JohaoRosasRosillo))

- Remove console logs. [\#687](https://github.com/prey/prey-node-client/pull/687) ([JohaoRosasRosillo](https://github.com/JohaoRosasRosillo))

- Fix variable to update WinSVC so it's only on Windows. [\#686](https://github.com/prey/prey-node-client/pull/686) ([JohaoRosasRosillo](https://github.com/JohaoRosasRosillo))

- Fix multiple entrance prey user permissions. [\#681](https://github.com/prey/prey-node-client/pull/681) ([SoraKenji](https://github.com/SoraKenji))

- Adds auth to HTTP geo call [\#680](https://github.com/prey/prey-node-client/pull/680) ([JohaoRosasRosillo](https://github.com/JohaoRosasRosillo))

- New action to call update WinSVC to update Prey service. [\#678](https://github.com/prey/prey-node-client/pull/678) ([JohaoRosasRosillo](https://github.com/JohaoRosasRosillo))
git
- Updated new WinSVC with new feature. Now it can update Prey services per request. [\#676](https://github.com/prey/prey-node-client/pull/676) ([JohaoRosasRosillo](https://github.com/JohaoRosasRosillo))

- Fixs a circular call on websocket/index.js when trying to clear intervals. [\#673](https://github.com/prey/prey-node-client/pull/673) ([SoraKenji](https://github.com/SoraKenji))

- New version WinSVC v2.0.10. [\#671](https://github.com/prey/prey-node-client/pull/671) ([JohaoRosasRosillo](https://github.com/JohaoRosasRosillo))

- Fixs merged problems on websocket/index.js. [\#669](https://github.com/prey/prey-node-client/pull/669) ([SoraKenji](https://github.com/SoraKenji))

- Now application pings to websocket endpoint in order to not lose connection and handles the connection better. [\#665](https://github.com/prey/prey-node-client/pull/665) ([SoraKenji](https://github.com/SoraKenji))

- Adds an XML file for settings in Factory Reset action. [\#664](https://github.com/prey/prey-node-client/pull/664) ([JohaoRosasRosillo](https://github.com/JohaoRosasRosillo))

- Adds handler for new format of hardware information on Apple M1/M2 chipset. [\#660](https://github.com/prey/prey-node-client/pull/660) ([JohaoRosasRosillo](https://github.com/JohaoRosasRosillo))

## [v1.10.10](https://github.com/prey/prey-node-client/tree/v1.10.10) (2022-08-01)
[Full Changelog](https://github.com/prey/prey-node-client/compare/v1.10.9..v1.10.10)

**Merged pull requests:**

- Fix reconnection issue because of timer. [\#656](https://github.com/prey/prey-node-client/pull/656) ([SoraKenji](https://github.com/SoraKenji))

- Fix issue when loading a folder without any files inside. File Retrieval. [\#652](https://github.com/prey/prey-node-client/pull/652) ([JohaoRosasRosillo](https://github.com/JohaoRosasRosillo))

## [v1.10.9](https://github.com/prey/prey-node-client/tree/v1.10.9) (2022-07-27)
[Full Changelog](https://github.com/prey/prey-node-client/compare/v1.10.8..v1.10.9)

**Merged pull requests:**

- Fix websockets reconnection after internet connection is down. There were duplicated timers for notifying status. [\#653](https://github.com/prey/prey-node-client/pull/653) ([SoraKenji](https://github.com/SoraKenji))

## [v1.10.8](https://github.com/prey/prey-node-client/tree/v1.10.8) (2022-07-18)
[Full Changelog](https://github.com/prey/prey-node-client/compare/v1.10.7..v1.10.8)

**Merged pull requests:**

- Add new WinSVC.exe new version [\#650](https://github.com/prey/prey-node-client/pull/647) ([JohaoRosasRosillo](https://github.com/JohaoRosasRosillo))
- Fix websockets action when notifications need more parameters [\#647](https://github.com/prey/prey-node-client/pull/647) ([SoraKenji](https://github.com/SoraKenji))
- Fix websockets when no wifi/internet found at start [\#645](https://github.com/prey/prey-node-client/pull/645) ([SoraKenji](https://github.com/SoraKenji))

## [v1.10.7](https://github.com/prey/prey-node-client/tree/v1.10.7) (2022-06-17)
[Full Changelog](https://github.com/prey/prey-node-client/compare/v1.10.6..v1.10.7)

**Merged pull requests:**

- Fix when logged_user function get stucked [\#642](https://github.com/prey/prey-node-client/pull/642) ([SoraKenji](https://github.com/SoraKenji))

## [v1.10.6](https://github.com/prey/prey-node-client/tree/v1.10.6) (2022-06-15)
[Full Changelog](https://github.com/prey/prey-node-client/compare/v1.10.5..v1.10.6)

**Merged pull requests:**

- Fixed double connection issues when error/close websocket [\#640](https://github.com/prey/prey-node-client/pull/640) ([SoraKenji](https://github.com/SoraKenji))

## [v1.10.5](https://github.com/prey/prey-node-client/tree/v1.10.5) (2022-06-14)
[Full Changelog](https://github.com/prey/prey-node-client/compare/v1.10.4..v1.10.5)

**Merged pull requests:**

- Now localserver gets created only at the beginning of the call. [\#638](https://github.com/prey/prey-node-client/pull/638) ([SoraKenji](https://github.com/SoraKenji))

## [v1.10.4](https://github.com/prey/prey-node-client/tree/v1.10.4) (2022-06-09)
[Full Changelog](https://github.com/prey/prey-node-client/compare/v1.10.3..v1.10.4)

**Merged pull requests:**

- Fix triggers action [\#633](https://github.com/prey/prey-node-client/pull/633) ([patriciojofre](https://github.com/patriciojofre))
- Load hooks after each connection [\#635](https://github.com/prey/prey-node-client/pull/635) ([SoraKenji](https://github.com/SoraKenji))

## [v1.10.3](https://github.com/prey/prey-node-client/tree/v1.10.3) (2022-06-06)
[Full Changelog](https://github.com/prey/prey-node-client/compare/v1.10.2..v1.10.3)

**Merged pull requests:**

- Now triggers won't be sending information to actions endpoint [\#627](https://github.com/prey/prey-node-client/pull/627) ([SoraKenji](https://github.com/SoraKenji))
- Fix connection's issues when sleep mode [\#629](https://github.com/prey/prey-node-client/pull/629) ([SoraKenji](https://github.com/SoraKenji))

## [v1.10.2](https://github.com/prey/prey-node-client/tree/v1.10.2) (2022-06-01)
[Full Changelog](https://github.com/prey/prey-node-client/compare/v1.10.1..v1.10.2)

**Merged pull requests:**

- Send info to google in order signal strenght [\#622](https://github.com/prey/prey-node-client/pull/622) ([SoraKenji](https://github.com/SoraKenji))

## [v1.10.1](https://github.com/prey/prey-node-client/tree/v1.10.1) (2022-06-01)
[Full Changelog](https://github.com/prey/prey-node-client/compare/v1.10.0..v1.10.1)

**Merged pull requests:**

- Send info to google in order signal strenght [\#620](https://github.com/prey/prey-node-client/pull/620) ([JohaoRosasRosillo](https://github.com/JohaoRosasRosillo))
- Fix to stored.length when stored is falsy [\#619](https://github.com/prey/prey-node-client/pull/619) ([SoraKenji](https://github.com/SoraKenji))

## [v1.10.0](https://github.com/prey/prey-node-client/tree/v1.10.0) (2022-05-16)
[Full Changelog](https://github.com/prey/prey-node-client/compare/v1.9.24..v1.10.0)

**Merged pull requests:**

- Send keys and status info periodically to panel [\#594](https://github.com/prey/prey-node-client/pull/594) ([JohaoRosasRosillo](https://github.com/JohaoRosasRosillo))
- Fix strategies geo [\#595](https://github.com/prey/prey-node-client/pull/595) ([JohaoRosasRosillo](https://github.com/JohaoRosasRosillo))
- Fix reading last_connection [\#596](https://github.com/prey/prey-node-client/pull/596) ([JohaoRosasRosillo](https://github.com/JohaoRosasRosillo))
- Send info control zone only when has zone control in panel [\#597](https://github.com/prey/prey-node-client/pull/597) ([JohaoRosasRosillo](https://github.com/JohaoRosasRosillo))
- Changes over some callback undefined [\#601](https://github.com/prey/prey-node-client/pull/601) ([SoraKenji](https://github.com/SoraKenji))
- Websockets master [\#603](https://github.com/prey/prey-node-client/pull/603) ([SoraKenji](https://github.com/SoraKenji))
- Fix strategies geo [\#604](https://github.com/prey/prey-node-client/pull/604) ([SoraKenji](https://github.com/SoraKenji))

## [v1.9.24](https://github.com/prey/prey-node-client/tree/v1.9.24) (2022-04-18)
[Full Changelog](https://github.com/prey/prey-node-client/compare/v1.9.20..v1.9.24)

**Merged pull requests:**

- Fix storage when apostrophe [\#586](https://github.com/prey/prey-node-client/pull/586) ([SoraKenji](https://github.com/SoraKenji))
- Send info location when api geo return error 429 [\#585](https://github.com/prey/prey-node-client/pull/585) ([JohaoRosasRosillo](https://github.com/JohaoRosasRosillo))
- Fallback to systemInformation when wmic is disabled [\#584](https://github.com/prey/prey-node-client/pull/584) ([JohaoRosasRosillo](https://github.com/JohaoRosasRosillo))
- Fixes underscore module not found [\#583] (https://github.com/prey/prey-node-client/pull/583) ([SoraKenji](https://github.com/SoraKenji))
- Fixes over get_access_point_network on windows.js [\#582] (https://github.com/prey/prey-node-client/pull/582) ([SoraKenji](https://github.com/SoraKenji))
- fixes issues when winscv service is not available [\#580] (https://github.com/prey/prey-node-client/pull/582) ([SoraKenji](https://github.com/SoraKenji))
- Fixes alert problem when message is not a string [\#578] (https://github.com/prey/prey-node-client/pull/578) ([SoraKenji](https://github.com/SoraKenji))

## [v1.9.23](https://github.com/prey/prey-node-client/tree/v1.9.23) (2022-04-08)

## [v1.9.22](https://github.com/prey/prey-node-client/tree/v1.9.22) (2022-04-08)

## [v1.9.21](https://github.com/prey/prey-node-client/tree/v1.9.21) (2022-03-30)
[Full Changelog](https://github.com/prey/prey-node-client/compare/v1.9.20..v1.9.21)

**Merged pull requests:**

- Fix lock errors/index.js import: Fixes an error by importing .../errors/index.js to lock index file [\#564](https://github.com/prey/prey-node-client/pull/564) ([SoraKenji](https://github.com/SoraKenji))
- Wmic and custom wipe: Fixes a problem with WMIC commands, since newer Windows version doesnt admit WMIC commands anymore. Also fixes Custom Wipe not deleting files on MacOS systems [\#563](https://github.com/prey/prey-node-client/pull/563) ([JohaoRosasRosillo](https://github.com/JohaoRosasRosillo))
- Fix/loan exact time: Fixes errors when inserting data with unwanted characters in database [\#573] (https://github.com/prey/prey-node-client/pull/573)

**Merged pull requests:**

## [v1.9.20](https://github.com/prey/prey-node-client/tree/v1.9.20) (2022-02-25)
[Full Changelog](https://github.com/prey/prey-node-client/compare/v1.9.19..v1.9.20)

**Merged pull requests:**

- lock improvement [\#557](https://github.com/prey/prey-node-client/pull/557) ([SoraKenji](https://github.com/SoraKenji))
- Fix for sqlite3 files and signatures [\#556](https://github.com/prey/prey-node-client/pull/556) ([javo](https://github.com/javo))
- add Is Hidden property to prey user [\#554](https://github.com/prey/prey-node-client/pull/554) ([JohaoRosasRosillo](https://github.com/JohaoRosasRosillo))

## [v1.9.19](https://github.com/prey/prey-node-client/tree/v1.9.19) (2022-02-11)
[Full Changelog](https://github.com/prey/prey-node-client/compare/v1.9.18..v1.9.19)

**Merged pull requests:**

## [v1.9.18](https://github.com/prey/prey-node-client/tree/v1.9.18) (2022-02-07)
[Full Changelog](https://github.com/prey/prey-node-client/compare/v1.9.17..v1.9.18)

**Merged pull requests:**

- fix send information from service windows ( tpm_module, os_edition, winsvc_version, rp_module) to panel [\#551](https://github.com/prey/prey-node-client/pull/551) ([JohaoRosasRosillo](https://github.com/JohaoRosasRosillo))

## [v1.9.17](https://github.com/prey/prey-node-client/tree/v1.9.17) (2022-01-31)
[Full Changelog](https://github.com/prey/prey-node-client/compare/v1.9.16..v1.9.17)

**Merged pull requests:**

- Actions Factory Reset and Full Wipe[\#540](https://github.com/prey/prey-node-client/pull/540) ([JohaoRosasRosillo](https://github.com/JohaoRosasRosillo))
- Unmute alarm on Ubuntu[\#542](https://github.com/prey/prey-node-client/pull/542) ([SoraKenji](https://github.com/SoraKenji))
- Fix panel mac native accuracy location[\#544](https://github.com/prey/prey-node-client/pull/544) ([SoraKenji](https://github.com/SoraKenji))
- Add windows service logs to logretrieval[\#545](https://github.com/prey/prey-node-client/pull/545) ([javo](https://github.com/javo))
- Fix SSO for ubuntu installation[\#546](https://github.com/prey/prey-node-client/pull/546) ([SoraKenji](https://github.com/SoraKenji))
- Fix geofencing callback error[\#547](https://github.com/prey/prey-node-client/pull/547) ([JohaoRosasRosillo](https://github.com/JohaoRosasRosillo))

## [v1.9.16](https://github.com/prey/prey-node-client/tree/v1.9.16) (2022-01-04)
[Full Changelog](https://github.com/prey/prey-node-client/compare/v1.9.15..v1.9.16)

**Merged pull requests:**

- Ask location with sudo on macOS Monterey[\#537](https://github.com/prey/prey-node-client/pull/537) ([javo](https://github.com/javo))

## [v1.9.15](https://github.com/prey/prey-node-client/tree/v1.9.15) (2021-12-30)
[Full Changelog](https://github.com/prey/prey-node-client/compare/v1.9.14..v1.9.15)

**Merged pull requests:**

- Get os edition for windows 11[\#535](https://github.com/prey/prey-node-client/pull/535) ([JohaoRosasRosillo](https://github.com/JohaoRosasRosillo))
- Fix callback issue on automations[\#538](https://github.com/prey/prey-node-client/pull/538) ([javo](https://github.com/javo))([JohaoRosasRosillo](https://github.com/JohaoRosasRosillo))


## [v1.9.14](https://github.com/prey/prey-node-client/tree/v1.9.14) (2021-11-15)
[Full Changelog](https://github.com/prey/prey-node-client/compare/v1.9.13..v1.9.14)

**Merged pull requests:**

- Fix old storage recovery validation[\#524](https://github.com/prey/prey-node-client/pull/524) ([javo](https://github.com/javo))([JohaoRosasRosillo](https://github.com/JohaoRosasRosillo))
- Storage commands by id[\#519](https://github.com/prey/prey-node-client/pull/519) ([javo](https://github.com/javo))([JohaoRosasRosillo](https://github.com/JohaoRosasRosillo))
- Updated executable signatures for windows[\#520](https://github.com/prey/prey-node-client/pull/520) ([JohaoRosasRosillo](https://github.com/JohaoRosasRosillo))
- Access wifi data through daemon for macOS Monterey[\#521](https://github.com/prey/prey-node-client/pull/521) ([javo](https://github.com/javo))


## [v1.9.13](https://github.com/prey/prey-node-client/tree/v1.9.13) (2021-08-16)
[Full Changelog](https://github.com/prey/prey-node-client/compare/v1.9.12..v1.9.13)

**Merged pull requests:**

- Unit tests in long polling for server creation and restart [\#507](https://github.com/prey/prey-node-client/pull/507) ([JohaoRosasRosillo](https://github.com/JohaoRosasRosillo))
- Fix documents wipe and keeping root folders[\#510](https://github.com/prey/prey-node-client/pull/510) ([JohaoRosasRosillo](https://github.com/JohaoRosasRosillo))
- Fix when starting node client[\#511](https://github.com/prey/prey-node-client/pull/511) ([JohaoRosasRosillo](https://github.com/JohaoRosasRosillo))
- Fix edition for Workstations and capture tpm error[\#512](https://github.com/prey/prey-node-client/pull/512) ([javo](https://github.com/javo))


## [v1.9.12](https://github.com/prey/prey-node-client/tree/v1.9.12) (2021-06-25)
[Full Changelog](https://github.com/prey/prey-node-client/compare/v1.9.11..v1.9.12)

**Merged pull requests:**

- Include messageID on stopped action response[\#502](https://github.com/prey/prey-node-client/pull/502) ([JohaoRosasRosillo](https://github.com/JohaoRosasRosillo))
- Add unseen trigger and long polling enhancements[\#504](https://github.com/prey/prey-node-client/pull/504) ([javo](https://github.com/javo))
- Update admin service for client support[\#505](https://github.com/prey/prey-node-client/pull/505) ([javo](https://github.com/javo))


## [v1.9.11](https://github.com/prey/prey-node-client/tree/v1.9.11) (2021-06-10)
[Full Changelog](https://github.com/prey/prey-node-client/compare/v1.9.10..v1.9.11)

**Merged pull requests:**

- battery check when writing to log[\#496](https://github.com/prey/prey-node-client/pull/496) ([javo](https://github.com/JohaoRosasRosillo))
- Update node version and sqlite3 library on macOS[\#497](https://github.com/prey/prey-node-client/pull/497) ([javo](https://github.com/javo))
- Manage encryption status info error[\#500](https://github.com/prey/prey-node-client/pull/500) ([javo](https://github.com/javo))


## [v1.9.10](https://github.com/prey/prey-node-client/tree/v1.9.10) (2021-04-12)
[Full Changelog](https://github.com/prey/prey-node-client/compare/v1.9.9..v1.9.10)

**Merged pull requests:**

- Fix for wipe on win7 and service updater on bin dir[\#493](https://github.com/prey/prey-node-client/pull/493) ([javo](https://github.com/javo))
- Lock with long message[\#494](https://github.com/prey/prey-node-client/pull/494) ([javo](https://github.com/javo))

## [v1.9.9](https://github.com/prey/prey-node-client/tree/v1.9.9) (2021-01-25)
[Full Changelog](https://github.com/prey/prey-node-client/compare/v1.9.8..v1.9.9)

**Merged pull requests:**

- Fix unlock for macOS BigSur and Windows 7[\#489](https://github.com/prey/prey-node-client/pull/489) ([javo](https://github.com/javo))

## [v1.9.8](https://github.com/prey/prey-node-client/tree/v1.9.8) (2020-12-22)
[Full Changelog](https://github.com/prey/prey-node-client/compare/v1.9.7..v1.9.8)

**Merged pull requests:**

- Remove client check server[\#486](https://github.com/prey/prey-node-client/pull/486) ([javo](https://github.com/javo))

## [v1.9.7](https://github.com/prey/prey-node-client/tree/v1.9.7) (2020-12-18)
[Full Changelog](https://github.com/prey/prey-node-client/compare/v1.9.6..v1.9.7)

**Merged pull requests:**

- Bitlocker integration[\#481](https://github.com/prey/prey-node-client/pull/481) ([javo](https://github.com/javo))
- Location schedule and dependency update [\#482](https://github.com/prey/prey-node-client/pull/482) ([javo](https://github.com/javo))
- Special characters on lock fix [\#483](https://github.com/prey/prey-node-client/pull/483) ([javo](https://github.com/javo))
- Encryption keys schedule and big sur error capture [\#485](https://github.com/prey/prey-node-client/pull/485) ([javo](https://github.com/javo))

## [v1.9.6](https://github.com/prey/prey-node-client/tree/v1.9.6) (2020-10-07)
[Full Changelog](https://github.com/prey/prey-node-client/compare/v1.9.5...v1.9.6)

**Merged pull requests:**

- macOS Big Sur integration [\#476](https://github.com/prey/prey-node-client/pull/476) ([javo](https://github.com/javo))
- Fix picture and logged user retry for windows [\#477](https://github.com/prey/prey-node-client/pull/477) ([javo](https://github.com/javo))
- Update with corresponding arch [\#478](https://github.com/prey/prey-node-client/pull/478) ([javo](https://github.com/javo))

## [v1.9.5](https://github.com/prey/prey-node-client/tree/v1.9.5) (2020-08-11)
[Full Changelog](https://github.com/prey/prey-node-client/compare/v1.9.4...v1.9.5)

**Merged pull requests:**

- Rename device event fix [\#472](https://github.com/prey/prey-node-client/pull/472) ([javo](https://github.com/javo))
- Logretrieval action [\#467](https://github.com/prey/prey-node-client/pull/467) ([javo](https://github.com/javo))
- Camera and Screenshot fixes and improvements [\#468](https://github.com/prey/prey-node-client/pull/468) ([javo](https://github.com/javo))
- General improvements [\#469](https://github.com/prey/prey-node-client/pull/469) ([javo](https://github.com/javo))

## [v1.9.4](https://github.com/prey/prey-node-client/tree/v1.9.4) (2020-04-23)
[Full Changelog](https://github.com/prey/prey-node-client/compare/v1.9.3...v1.9.4)

**Merged pull requests:**

- Ubuntu python3 integration and SSO restored [\#459](https://github.com/prey/prey-node-client/pull/459) ([javo](https://github.com/javo))
- Connection status check retry [\#460](https://github.com/prey/prey-node-client/pull/460) ([javo](https://github.com/javo))
- Upgrade command improvements [\#461](https://github.com/prey/prey-node-client/pull/461) ([javo](https://github.com/javo))
- Node version upgrade and mac binaries re-signed [\#464](https://github.com/prey/prey-node-client/pull/464) ([javo](https://github.com/javo))

## [v1.9.3](https://github.com/prey/prey-node-client/tree/v1.9.3) (2020-01-23)
[Full Changelog](https://github.com/prey/prey-node-client/compare/v1.9.2...v1.9.3)

**Merged pull requests:**

- Persist automation action, lock with message and network improvements [\#455](https://github.com/prey/prey-node-client/pull/455) ([javo](https://github.com/javo))

## [v1.9.2](https://github.com/prey/prey-node-client/tree/v1.9.2) (2019-10-03)
[Full Changelog](https://github.com/prey/prey-node-client/compare/v1.9.1...v1.9.2)

**Merged pull requests:**

- Improvements on providers posible errors [\#444](https://github.com/prey/prey-node-client/pull/444) ([javo](https://github.com/javo))
- Active access point scan modifications [\#441](https://github.com/prey/prey-node-client/pull/441) ([javo](https://github.com/javo))
- Missing and Recover commands for automations [\#440](https://github.com/prey/prey-node-client/pull/440) ([javo](https://github.com/javo))
- Autoupdate improvements [\#439](https://github.com/prey/prey-node-client/pull/439) ([javo](https://github.com/javo))
- File scannig for windows fix [\#437](https://github.com/prey/prey-node-client/pull/437) ([javo](https://github.com/javo))

## [v1.9.1](https://github.com/prey/prey-node-client/tree/v1.9.1) (2019-07-23)
[Full Changelog](https://github.com/prey/prey-node-client/compare/v1.9.0...v1.9.1)

**Merged pull requests:**

- Status on no logged user fix [\#435](https://github.com/prey/prey-node-client/pull/435) ([javo](https://github.com/javo))

## [v1.9.0](https://github.com/prey/prey-node-client/tree/v1.9.0) (2019-07-19)
[Full Changelog](https://github.com/prey/prey-node-client/compare/v1.8.3...v1.9.0)

**Merged pull requests:**

- Action triggers for node client [\#427](https://github.com/prey/prey-node-client/pull/427) ([javo](https://github.com/javo))
- Allow native location on mac [\#428](https://github.com/prey/prey-node-client/pull/428) ([javo](https://github.com/javo))
- Device status improvements [\#429](https://github.com/prey/prey-node-client/pull/429) ([javo](https://github.com/javo))

## [v1.8.3](https://github.com/prey/prey-node-client/tree/v1.8.3) (2019-03-25)
[Full Changelog](https://github.com/prey/prey-node-client/compare/v1.8.2...v1.8.3)

**Merged pull requests:**

- Check location setting through status.json endpoint [\#417](https://github.com/prey/prey-node-client/pull/417) ([javo](https://github.com/javo))
- Wipe fixes update [\#419](https://github.com/prey/prey-node-client/pull/419) ([javo](https://github.com/javo))

## [v1.8.2](https://github.com/prey/prey-node-client/tree/v1.8.2) (2018-11-22)
[Full Changelog](https://github.com/prey/prey-node-client/compare/v1.8.1...v1.8.2)

**Merged pull requests:**

- Device renamed event [\#397](https://github.com/prey/prey-node-client/pull/397) ([javo](https://github.com/javo))
- MacOS Mojave support [\#402](https://github.com/prey/prey-node-client/pull/402) ([javo](https://github.com/javo))
- Location service proxy and keys on request [\#403](https://github.com/prey/prey-node-client/pull/403) ([javo](https://github.com/javo))
- Binaries signatures renewal for windows [\#404](https://github.com/prey/prey-node-client/pull/404) ([javo](https://github.com/javo))
- Connection trigger improvements [\#405](https://github.com/prey/prey-node-client/pull/405) ([javo](https://github.com/javo))
- Authorize client restart and wipe fixes [\#408](https://github.com/prey/prey-node-client/pull/408) ([javo](https://github.com/javo))

## [v1.8.1](https://github.com/prey/prey-node-client/tree/v1.8.0) (2018-07-24)
[Full Changelog](https://github.com/prey/prey-node-client/compare/v1.8.0...v1.8.1)

**Merged pull requests:**

- Install fix for older Windows [\#390](https://github.com/prey/prey-node-client/pull/390) ([javo](https://github.com/javo))
- Revert push as json [\#391](https://github.com/prey/prey-node-client/pull/391) ([javo](https://github.com/javo))
- Restore filtered geofencing start event [\#394](https://github.com/prey/prey-node-client/pull/394) ([javo](https://github.com/javo))

## [v1.8.0](https://github.com/prey/prey-node-client/tree/v1.8.0) (2018-07-05)
[Full Changelog](https://github.com/prey/prey-node-client/compare/v1.7.5...v1.8.0)

**Merged pull requests:**

- SSO Node client [\#341](https://github.com/prey/prey-node-client/pull/341) ([javo](https://github.com/javo))
- Wipe as admin [\#371](https://github.com/prey/prey-node-client/pull/371) ([javo](https://github.com/javo))
- Geofencing start event remove [\#372](https://github.com/prey/prey-node-client/pull/372) ([javo](https://github.com/javo))
- Add device key to exceptions [\#373](https://github.com/prey/prey-node-client/pull/373) ([javo](https://github.com/javo))
- Delete older prey versions [\#374](https://github.com/prey/prey-node-client/pull/374) ([javo](https://github.com/javo))
- Unmute alarm fix [\#375](https://github.com/prey/prey-node-client/pull/375) ([javo](https://github.com/javo))
- Post location only when it changes [\#376](https://github.com/prey/prey-node-client/pull/376) ([javo](https://github.com/javo))
- Revert windows config changes [\#377](https://github.com/prey/prey-node-client/pull/377) ([javo](https://github.com/javo))
- Device key fix for exceptions [\#379](https://github.com/prey/prey-node-client/pull/379) ([javo](https://github.com/javo))
- Conection state fix [\#380](https://github.com/prey/prey-node-client/pull/380) ([javo](https://github.com/javo))
- Force wifi on and exceptions post fix [\#381](https://github.com/prey/prey-node-client/pull/381) ([javo](https://github.com/javo))
- Dont send device_client_updated event on empty info [\#382](https://github.com/prey/prey-node-client/pull/382) ([javo](https://github.com/javo))
- Improve check on connection and similar locations [\#384](https://github.com/prey/prey-node-client/pull/384) ([javo](https://github.com/javo))
- Post request to api as json [\#385](https://github.com/prey/prey-node-client/pull/385) ([javo](https://github.com/javo))
- Linux ssoa and multiple mac address fix [\#386](https://github.com/prey/prey-node-client/pull/386) ([javo](https://github.com/javo))
- SSO on invalid keys fix [\#387](https://github.com/prey/prey-node-client/pull/387) ([javo](https://github.com/javo))
- Travis ci [\#388](https://github.com/prey/prey-node-client/pull/388) ([javo](https://github.com/javo))

## [v1.7.5](https://github.com/prey/prey-node-client/tree/v1.7.5) (2018-05-17)
[Full Changelog](https://github.com/prey/prey-node-client/compare/v1.7.4...v1.7.5)

**Merged pull requests:**

- Sign error notifications [\#362](https://github.com/prey/prey-node-client/pull/364) ([javo](https://github.com/javo))

## [v1.7.4](https://github.com/prey/prey-node-client/tree/v1.7.4) (2018-04-10)
[Full Changelog](https://github.com/prey/prey-node-client/compare/v1.7.3...v1.7.4)

**Merged pull requests:**

- Privacy policy on old gui's [\#362](https://github.com/prey/prey-node-client/pull/362) ([javo](https://github.com/javo))
- Wifi location strategy retry [\#356](https://github.com/prey/prey-node-client/pull/356) ([javo](https://github.com/javo))
- GDPR for client configuration [\#357](https://github.com/prey/prey-node-client/pull/357) ([javo](https://github.com/javo))
- Storage improvements [\#358](https://github.com/prey/prey-node-client/pull/358) ([javo](https://github.com/javo))

## [v1.7.3](https://github.com/prey/prey-node-client/tree/v1.7.3) (2018-01-04)
[Full Changelog](https://github.com/prey/prey-node-client/compare/v1.7.2...v1.7.3)

**Merged pull requests:**

- Location aware [\#342](https://github.com/prey/prey-node-client/pull/342) ([javo](https://github.com/javo))
- Wipe for outlook on macOS [\#343](https://github.com/prey/prey-node-client/pull/343) ([javo](https://github.com/javo))
- Custom directory Wipe [\#344](https://github.com/prey/prey-node-client/pull/344) ([javo](https://github.com/javo))
- Node client 2018 [\#346](https://github.com/prey/prey-node-client/pull/346) ([javo](https://github.com/javo))
- Signed wipe binaries [\#348](https://github.com/prey/prey-node-client/pull/348) ([javo](https://github.com/javo))
- Force networks scan on windows [\#351](https://github.com/prey/prey-node-client/pull/351) ([javo](https://github.com/javo))
- Custom wipe fix for many directories [\#352](https://github.com/prey/prey-node-client/pull/352) ([javo](https://github.com/javo))
- Timeout on scan networks callback [\#353](https://github.com/prey/prey-node-client/pull/353) ([javo](https://github.com/javo))

## [v1.7.2](https://github.com/prey/prey-node-client/tree/v1.7.2) (2017-10-30)
[Full Changelog](https://github.com/prey/prey-node-client/compare/v1.7.1...v1.7.2)

**Merged pull requests:**

- Device type fix for linux [\#338](https://github.com/prey/prey-node-client/pull/338) ([javo](https://github.com/javo))
- Prey user watcher for mac [\#332](https://github.com/prey/prey-node-client/pull/332) ([javo](https://github.com/javo))
- Ubuntu fixed hardware info [\#334](https://github.com/prey/prey-node-client/pull/334) ([javo](https://github.com/javo))
- Over 10 MB files wipe error fix [\#335](https://github.com/prey/prey-node-client/pull/335) ([javo](https://github.com/javo))

## [v1.7.1](https://github.com/prey/prey-node-client/tree/v1.7.1) (2017-09-06)
[Full Changelog](https://github.com/prey/prey-node-client/compare/v1.7.0...v1.7.1)

**Merged pull requests:**

- Location watcher [\#321](https://github.com/prey/prey-node-client/pull/321) ([javo](https://github.com/javo))
- Geo endpoint integration [\#323](https://github.com/prey/prey-node-client/pull/323) ([javo](https://github.com/javo))
- Windows report picture retry [\#324](https://github.com/prey/prey-node-client/pull/324) ([javo](https://github.com/javo))
- Ram size on windows fix [\#325](https://github.com/prey/prey-node-client/pull/325) ([javo](https://github.com/javo))
- Ram size on windows fix [\#325](https://github.com/prey/prey-node-client/pull/325) ([javo](https://github.com/javo))
- Location, webcam and wipe fixes [\#327](https://github.com/prey/prey-node-client/pull/327) ([javo](https://github.com/javo))

## [v1.6.9](https://github.com/prey/prey-node-client/tree/v1.6.9) (2017-07-10)
[Full Changelog](https://github.com/prey/prey-node-client/compare/v1.6.8...v1.6.9)

**Fixed bugs:**

- openSUSE invalid OS error message [\#249](https://github.com/prey/prey-node-client/issues/249)

**Merged pull requests:**

- Geofencing mac address check [\#303](https://github.com/prey/prey-node-client/pull/303) ([javo](https://github.com/javo))
- OneDrive local files wipe [\#304](https://github.com/prey/prey-node-client/pull/304) ([javo](https://github.com/javo)) 
- Alarm volume raise fix [\#305](https://github.com/prey/prey-node-client/pull/305) ([javo](https://github.com/javo))
- Force networks re-scan fix [\#306](https://github.com/prey/prey-node-client/pull/306) ([javo](https://github.com/javo))
- Location fix for cyrillic alphabet [\#307](https://github.com/prey/prey-node-client/pull/307) ([javo](https://github.com/javo))
- Add opensuse distro case [\#309](https://github.com/prey/prey-node-client/pull/309) ([javo](https://github.com/javo))
- Enable task bar after lock on windows [\#310](https://github.com/prey/prey-node-client/pull/310) ([javo](https://github.com/javo))

## [v1.6.7](https://github.com/prey/prey-node-client/tree/v1.6.7) (2017-05-05)
[Full Changelog](https://github.com/prey/prey-node-client/compare/v1.6.6...v1.6.7)

**Merged pull requests:**
- Client upgrade retry limit [\#281](https://github.com/prey/prey-node-client/pull/281) ([javo](https://github.com/javo))
- Wipe action execute on Windows without user logged in [\#282](https://github.com/prey/prey-node-client/pull/282) ([javo](https://github.com/javo))
- Sqlite storage commands improvements [\#287](https://github.com/prey/prey-node-client/pull/287) ([javo](https://github.com/javo))
- Include log rotate options [\#288](https://github.com/prey/prey-node-client/pull/288) ([javo](https://github.com/javo))
- Multiple actions job-id incorporation [\#289](https://github.com/prey/prey-node-client/pull/289) ([javo](https://github.com/javo))
- Un-bypasseable alarm [\#292](https://github.com/prey/prey-node-client/pull/292) ([javo](https://github.com/javo))

## [v1.6.6](https://github.com/prey/prey-node-client/tree/v1.6.6) (2016-11-29)
[Full Changelog](https://github.com/prey/prey-node-client/compare/v1.6.5...v1.6.6)

**Merged pull requests:**

- Delete files local files from Google Drive and Dropbox [\#258](https://github.com/prey/prey-node-client/pull/258) ([javo](https://github.com/javo))
- Fix 502 status code client freeze [\#262](https://github.com/prey/prey-node-client/pull/262) ([javo](https://github.com/javo))
- Copyright update to 2017 [\#263](https://github.com/prey/prey-node-client/pull/263) ([javo](https://github.com/javo))
- Storage tables initialisation fix [\#266](https://github.com/prey/prey-node-client/pull/266) ([javo](https://github.com/javo))
- Request timeout added for 406 status code on overdue accounts [\#269](https://github.com/prey/prey-node-client/pull/269) ([javo](https://github.com/javo))
- Secure wipe integration [\#270](https://github.com/prey/prey-node-client/pull/270) ([javo](https://github.com/javo))
- New host for prey node client download [\#272](https://github.com/prey/prey-node-client/pull/272) ([javo](https://github.com/javo))
- Resume files fix in Fileretrieval when the connection is lost [\#273](https://github.com/prey/prey-node-client/pull/273) ([javo](https://github.com/javo))
- New Lock bin fixing sticky keys and taskbar bypasses [\#274](https://github.com/prey/prey-node-client/pull/274) ([javo](https://github.com/javo))
- Signup mail characters change [\#275](https://github.com/prey/prey-node-client/pull/275) ([javo](https://github.com/javo))
- Linux wipe child process fix [\#276](https://github.com/prey/prey-node-client/pull/276) ([javo](https://github.com/javo))

## [v1.6.5](https://github.com/prey/prey-node-client/tree/v1.6.5) (2016-11-29)
[Full Changelog](https://github.com/prey/prey-node-client/compare/v1.6.4...v1.6.5)

**Fixed bugs:**

- Error creating account on the install suit and numeric api key problem.

**Merged pull requests:**
- Fix apikey undefined case [\#255](https://github.com/prey/prey-node-client/pull/255) ([javo](https://github.com/javo))
- Numeric api key case [\#257](https://github.com/prey/prey-node-client/pull/257) ([javo](https://github.com/javo)) 


## [v1.6.4](https://github.com/prey/prey-node-client/tree/v1.6.4) (2016-11-29)
[Full Changelog](https://github.com/prey/prey-node-client/compare/v1.6.3...v1.6.4)

**Fixed bugs:**

- Prey verify keys error on mac and linux [\#219](https://github.com/prey/prey-node-client/issues/219)

**Merged pull requests:**

- Geofencing on node client using sqlite storage [\#244](https://github.com/prey/prey-node-client/pull/244) ([javo](https://github.com/javo))
- Synchronous user-agent obtaining for keys verification [\#250](https://github.com/prey/prey-node-client/pull/250) ([javo](https://github.com/javo)) 
- Node releases url changed from s3.amazon to storage.googleapis [\#251](https://github.com/prey/prey-node-client/pull/251) ([javo](https://github.com/javo))

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
