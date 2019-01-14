#!/bin/bash

if [ "$EUID" -ne 0 ]
 then echo 'Please run as root'
 exit
fi

file="/var/lib/polkit-1/localauthority/50-local.d/10-network-manager.pkla"

askAutorization () {
  read -p "Prey needs autorization to modify network parameters for the autoconnect feature (this is no mandatory for prey to work) (y/n)" answer </dev/tty
  case ${answer:0:1} in
    y|Y )
      authorized=true
    ;;
    n|N )
      # Leave everything as it was
      authorized=false
      cp "$file.old" $file
      rm "$file.old"
      exit
    ;;
    * )
      askAutorization
    ;;
  esac
}

processLine() {
  if   [[ $line == *"Identity"* ]];     then ready[0]=1; setIdentity $line
  elif [[ $line == *"ResultAny"* ]];    then ready[1]=1; setResults $line
  elif [[ $line == *"ResultActive"* ]]; then ready[2]=1; setResults $line
  else echo $line >> $file; fi
}

setResults() {
  key=`cut -d "=" -f 1 <<< "$1"`
  value=`cut -d "=" -f 2 <<< "$1"`

  if [[ "$value" != "yes" ]]; then
    if [ $authorized == false ]; then askAutorization; fi

    if [ $key == "ResultAny" ]; then ready[1]=2; else ready[2]=2; fi
    value="yes"
  fi

  echo $key=$value >> $file;
}

setIdentity() {
  key=`cut -d "=" -f 1 <<< "$1"`
  value=`cut -d "=" -f 2 <<< "$1"`

  if [[ $value != *":prey"* ]] && [[ $value != *":*"* ]]; then
    if [ $authorized == false ]; then askAutorization; fi
    ready[0]=2
    value="$value;unix-user:prey"
  fi

  echo $key=$value >> $file;
}

check () {
  # Covered all fields and nothing changed
  if [ ${ready[0]} == 1 ] && [ ${ready[1]} == 1 ] && [ ${ready[2]} == 1 ]; then
    rm "$file.old"
    exit
  fi

  # if any of the fields wasn't in the original file
  if [ ${ready[0]} == 0 ]; then setIdentity "Identity" "unix-user:prey"; fi
  if [ ${ready[1]} == 0 ]; then setResults "ResultAny" "yes"; fi
  if [ ${ready[2]} == 0 ]; then setResults "ResultActive" "yes"; fi
}

grant_permissions () {
# Verify if the files exists
  if [ -f $file ]; then
    authorized=false
    ready=(0 0 0)

    # Back up information and clear original file
    cp $file "$file.old"
    > $file

    while read -r line; do
      processLine $line
    done < "$file.old"

    check
    exit
  else
    # Create the file
    su -c `printf "[Grant network permissions to Prey user]\nIdentity=unix-user:prey\nAction=org.freedesktop.NetworkManager.*\nResultAny=yes\nResultInactive=no\nResultActive=yes\n" >  ${file}`
    exit
  fi
}

restore_permissions () {
  if [ -f $file ] && [ -f "$file.old" ]; then
    cp "$file.old" $file
    rm "$file.old"
    exit
  elif [ -f $file ]; then
    rm $file
    exit
  else
    exit
  fi
}

if [ -z "$1" ]; then
  echo 'Grant (--grant) or Restore (--restore) arguments necessary'
  exit
else
  if [[ $1 == "--grant" ]] || [[ $1 == "-g" ]]; then
    grant_permissions
  elif [[ $1 == "--restore" ]] || [[ $1 == "-r" ]]; then
    restore_permissions
  else
    echo 'Invalid argument'
    exit
  fi
fi