#!/bin/sh

VERSION='0.8.9'
PREY_USER="prey"
BASE_PATH="/usr/lib/prey"
CONFIG_DIR="/etc/prey"
LOG_FILE="/var/log/prey.log"
INSTALL_PATH="${BASE_PATH}/versions/${VERSION}"
BIN_PATH="${INSTALL_PATH}/bin/prey"

bash "$INSTALL_PATH/scripts/create_user.sh" ${PREY_USER}
mkdir -p $CONFIG_DIR
touch $LOG_FILE

# set up permissions
chown -R $PREY_USER: $CONFIG_DIR $BASE_PATH $LOG_FILE
# as prey_user: symlink, write crontab, generate prey.conf
su ${PREY_USER} -c "$BIN_PATH config activate"
"$BIN_PATH" config hooks post_install
"$BIN_PATH" config gui
