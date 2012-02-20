#!/bin/bash

USER_NAME="prey"
FULL_NAME="Prey Anti-Theft"
SHELL="/bin/bash"
ADMIN_GROUP_ID=80
EXISTING_USER=$(find /Users -maxdepth 1 | tail -1 | cut -f3 -d "/")

# this means user will be able to run commands as other users except root
SUDOERS_FILE="/etc/sudoers.d/50_prey_switcher"
SUDOERS_LINE="${USER_NAME} ALL = NOPASSWD: $(which su) [A-z]*, !$(which su) root"

if [[ $EUID -ne 0 ]]; then
  echo "$0 must run this as root."
  exit 0
fi

echo "\nHello! We will now create a user '${USER_NAME}' with (limited) impersonation privileges."
echo "This means he will be able to run commands on behalf of other users, in order to give Prey"
echo "the ability to run actions (ie. alarm, lock) or get bits of information (ie. screenshot) regardless of the logged in user.\n"

echo "The '${USER_NAME}' user will not be able to run commands as root, however."
echo "Should we continue? (y/n)"
read ANSWER

[[ "$ANSWER" != 'y' && "$ANSWER" != 'yes' ]] && echo "Ok maybe some other day." && exit 1

if [ "$(uname)" == "Linux" ]; then
  dpkg -l sudo || apt_get update && apt_get install sudo
fi

if id $USER_NAME &>/dev/null; then
  
  echo "${USER_NAME} user already exists!"
  
else

    echo "Creating a user called ${USER_NAME}"
    
    if [ "$(uname)" == "Linux" ]; then

      useradd -U -G admin -s $SHELL -m $USER_NAME

    else
      
      # create user using dscl
      # this user will be inactive and not shown on the login user selection
      # since it will not have a password set.

      # if you wish to remove the user later, run:
      # > sudo dscl . -delete /Users/${USER_NAME}

      MAX_ID=$(dscl . -list /Users UniqueID | awk '{print $2}' | sort -ug | tail -1)
      USER_ID=$((MAX_ID+1))

      [ -z "$USER_ID" ] && echo "Unable to get user id, cannot continue." && exit 1

      dscl . -create /Users/${USER_NAME}
      dscl . -create /Users/${USER_NAME} UserShell "${SHELL}"
      dscl . -create /Users/${USER_NAME} RealName "${FULL_NAME}"
      dscl . -create /Users/${USER_NAME} UniqueID "$USER_ID"
      dscl . -create /Users/${USER_NAME} PrimaryGroupID "$ADMIN_GROUP_ID"

    fi

fi

# on osx we don't need the sudo magic as belonging to the admin group is enough
# to run the lock, get screenshot, imagesnap, etc
if [ "$(uname)" == "Darwin" ]; then
  echo "All done!"
  exit 0
fi

if [ -f "$SUDOERS_FILE" ]; then
  
  echo "${USER_NAME} already seems to have impersonation privileges. Skipping..."
  
else
  
  echo "Giving ${USER_NAME} user passwordless sudo priviledges..."
  [ ! -d /etc/sudoers.d ] && mkdir /etc/sudoers.d

  # make sure sudo is including files in /etc/sudoers.d in its configuration
  grep -q "^#includedir.*/etc/sudoers.d" /etc/sudoers || echo "#includedir /etc/sudoers.d" >> /etc/sudoers

  ( umask 226 && echo "${SUDOERS_LINE}" > "$SUDOERS_FILE" )

fi

echo "Testing impersonation from ${USER_NAME} to ${EXISTING_USER}..."

# the output of the following command should be the user name of $EXISTING_USER
OUTPUT=$(sudo -u ${USER_NAME} sudo -u ${EXISTING_USER} whoami)

if [[ $? -eq 0 && "$OUTPUT" == "$EXISTING_USER" ]]; then
  echo "It worked!"
else
  echo "Whoops, didn't work. Try removing the ${USER_NAME} user and running this script again."
fi