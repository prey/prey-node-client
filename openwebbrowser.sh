#!/bin/bash

webbrowser=`xdg-settings get default-web-browser`
if [ "$webbrowser" == "firefox.desktop" ]; then
    firefox -CreateProfile Prey
    firefox -P Prey -url $1
else
    xdg-open $1
fi