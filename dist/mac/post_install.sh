#!/bin/sh

VERSION='0.8.7'
PREY_USER="prey"
BASE_PATH="/usr/lib/prey"
CONFIG_DIR="/etc/prey"
INSTALL_PATH="${BASE_PATH}/versions/${VERSION}"
BIN_PATH="${INSTALL_PATH}/bin/prey"

bash "$INSTALL_PATH/scripts/create_user.sh" ${PREY_USER}
mkdir -p $CONFIG_DIR

# set up permissions
chown -R $PREY_USER: $CONFIG_DIR $BASE_PATH
# as prey_user: symlink, write crontab, generate prey.conf
su ${PREY_USER} -c "$BIN_PATH config activate"
"$BIN_PATH" config hooks post_install
"$BIN_PATH" config gui
