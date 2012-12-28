#!/bin/sh

bash "$INSTALL_PATH/scripts/create_user.sh" ${PREY_USER}
mkdir -p /etc/prey

# set up permissions
chown -R $PREY_USER: /etc/prey $BASE_PATH
# as prey_user: symlink, write crontab, generate prey.conf
su ${PREY_USER} -c "$BIN_PATH config activate"
"$BIN_PATH" config hooks post_install
su ${PREY_USER} -c "$BIN_PATH" config gui
