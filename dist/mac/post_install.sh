#!/bin/sh

VERSION='1.0.0'
PREY_USER="prey"
BASE_PATH="/usr/lib/prey"
CONFIG_DIR="/etc/prey"
LOG_FILE="/var/log/prey.log"
INSTALL_PATH="${BASE_PATH}/versions/${VERSION}"
PREY_BIN="bin/prey"

bash "$INSTALL_PATH/scripts/create_user.sh" ${PREY_USER} || true
mkdir -p $CONFIG_DIR
touch $LOG_FILE

# set up permissions
chown -R $PREY_USER: $CONFIG_DIR $BASE_PATH $LOG_FILE

cd "$INSTALL_PATH"
# as prey_user: symlink /current, generate prey.conf
su ${PREY_USER} -c "$PREY_BIN config activate"
# as root user: setup system/init scripts and fire up gui
# (root required for guest account creation)
"$PREY_BIN" config hooks post_install
"$PREY_BIN" config gui
