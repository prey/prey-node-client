#!/bin/bash

if [ $EUID -ne 0 ]; then
  echo "$0 must be run as root."
  exit 1
fi

USER_NAME="$1"
[ -z "$USER_NAME" ] && echo "User name required." && exit 1

FULL_NAME="Prey Anti-Theft"

SU_CMD=$(command -v su) || SU_CMD="/bin/su"

# With SUDOERS_FILE user will be able to run commands as other users except root
SUDOERS_ARGS="${SU_CMD} [A-z]*, !${SU_CMD} root*, !${SU_CMD} -*"
SUDOERS_FILE_50="/etc/sudoers.d/50_${USER_NAME}_switcher"
SUDOERS_FILE_51="/etc/sudoers.d/51_${USER_NAME}_switcher"
SUDOERS_FILE_52="/etc/sudoers.d/52_${USER_NAME}_switcher" # New version for macOS
AIRPORT_CMD="/System/Library/PrivateFrameworks/Apple80211.framework/Versions/Current/Resources/airport"
TRINITY_CMD="/usr/local/lib/prey/current/bin/trinity"
SHELL_MAC="/sbin/nologin"
USERS_PATH_MAC="/Users"

if [ "$(uname)" == "Linux" ]; then
  USERS_PATH="/home"
  SUDOERS_FILE="$SUDOERS_FILE_50"
  [ -n "$(which dmidecode)" ] && SUDOERS_ARGS="$(which dmidecode), ${SUDOERS_ARGS}"
  [ -n "$(which iwlist)" ] && SUDOERS_ARGS="$(which iwlist), ${SUDOERS_ARGS}"
  # for security reasons, Prey user shouldn't have a login shell defined
  # also, since nologin path changes between linux distros, lets use /bin/false instead
  SHELL="/bin/false"
elif [ -f "${SUDOERS_FILE_51}" ]; then
  SUDOERS_FILE="$SUDOERS_FILE_52" # New version for macOS
  USERS_PATH="$USERS_PATH_MAC"
  SHELL="$SHELL_MAC"
  SUDOERS_ARGS="$SUDOERS_ARGS, $AIRPORT_CMD, $TRINITY_CMD"
else
  SUDOERS_FILE="$SUDOERS_FILE_51"
  USERS_PATH="$USERS_PATH_MAC"
  SHELL="$SHELL_MAC"
  SUDOERS_ARGS="$SUDOERS_ARGS, $AIRPORT_CMD, $TRINITY_CMD"
fi

SUDOERS_LINE="${USER_NAME} ALL=(ALL) NOPASSWD: ${SUDOERS_ARGS}"

if [ "$(uname)" == "Linux" ]; then
  EXISTING_USER=$(cat /etc/passwd | grep -E "home.*bash" | tail -1 | cut -d":" -f1)
else
  EXISTING_USER=$(dscl . -list /Users | grep -Ev "^_|daemon|nobody|root|Guest|${USER_NAME}" | tail -1)
fi

# osx
ADMIN_GROUP_ID=80
# linux
ADMIN_GROUP=adm
ask_confirmation() {
  echo -e "\nWe will now create a user '${USER_NAME}' with (limited) impersonation privileges."
  echo -e "This means he will be able to run commands on behalf of other users, in order to give Prey"
  echo -e "the ability to run actions (ie. alarm, lock) or get bits of information (ie. screenshot)"
  echo -e "regardless of the logged in user.\n"

  echo -e "The '${USER_NAME}' user will not be able to run commands as root, however."
  echo -e "Should we continue? (y/n)"
  read ANSWER

  [[ "$ANSWER" != 'y' && "$ANSWER" != 'yes' ]] && echo "Ok maybe some other day." && exit 1
}

create_user() {
  echo "Creating a user called ${USER_NAME}"

  if [ "$(uname)" == "Linux" ]; then

    local groups="video audio plugdev netdev"
    useradd -r -M -U -G ${ADMIN_GROUP} -s $SHELL $USER_NAME

    for group in $groups; do
      usermod -a -G $group $USER_NAME 2> /dev/null || true
    done

  else

    # create user using dscl
    # this user will be inactive and not shown on the login user selection
    # since it will not have a password set.

    # if you wish to remove the user later, run:
    # > sudo dscl . -delete /Users/${USER_NAME}

    local MAX_ID=$(dscl . -list /Users UniqueID | awk '{print $2}' | sort -ug | tail -1)
    local USER_ID=$((MAX_ID+1))

    [ -z "$USER_ID" ] && echo "Unable to get user id, cannot continue." && exit 1

    dscl . -create /Users/${USER_NAME}
    dscl . -create /Users/${USER_NAME} IsHidden 1
    dscl . -create /Users/${USER_NAME} UserShell "${SHELL}"
    dscl . -create /Users/${USER_NAME} RealName "${FULL_NAME}"
    dscl . -create /Users/${USER_NAME} UniqueID "$USER_ID"
    dscl . -create /Users/${USER_NAME} PrimaryGroupID "$ADMIN_GROUP_ID"
    dscl . -delete /Users/${USER_NAME} AuthenticationAuthority
    dscl . -create /Users/${USER_NAME} Password "*"

  fi
}

remove_old_files() {
  # Delete old sudoers file on macOS
  if [ "$(uname)" == "Darwin" ]; then
    if [ -f "${SUDOERS_FILE_50}" ]; then
      echo "removing file on: ${SUDOERS_FILE_50}, output (empty is ok): $(rm -rf "${SUDOERS_FILE_50}")"
    elif [[ -f "${SUDOERS_FILE_51}" && -f "${SUDOERS_FILE}" ]]; then
      echo "removing file on: ${SUDOERS_FILE_51}, output (empty is ok): $(rm -rf "${SUDOERS_FILE_51}")" 
    fi
  fi
}

grant_privileges() {
  if [ -f "$SUDOERS_FILE" ]; then
    remove_old_files
    echo "${USER_NAME} already seems to have impersonation privileges. Skipping..."
    return 0
  fi

  echo "Giving ${USER_NAME} user passwordless sudo priviledges..."
  [ ! -d /etc/sudoers.d ] && mkdir /etc/sudoers.d

  # make sure sudo is including files in /etc/sudoers.d in its configuration
  grep -q "^#includedir.*/etc/sudoers.d" /etc/sudoers || echo "#includedir /etc/sudoers.d" >> /etc/sudoers

  ( umask 226 && echo "${SUDOERS_LINE}" > "$SUDOERS_FILE" )

}

test_impersonation() {
  echo "Testing impersonation from ${USER_NAME} to ${EXISTING_USER}..."

  # the output of the following command should be the user name of $EXISTING_USER
  # local output=$(sudo -u ${USER_NAME} sudo -u ${EXISTING_USER} whoami)
  local output=$(sudo su ${USER_NAME} -c "sudo su ${EXISTING_USER} -c whoami")

  if [[ $? -eq 0 && "$output" == "$EXISTING_USER" ]]; then
    echo "It worked!"
    return 0
  else
    echo "Whoops, didn't work. Try removing the ${USER_NAME} user and running this script again."
    return 1
  fi
}

####################
## the main course

# ask_confirmation
id $USER_NAME &> /dev/null

if [ $? -eq 0 ]; then
  echo "${USER_NAME} user already exists!"
else
  create_user
fi

grant_privileges
# test_impersonation
exit $?
