

module.exports = {

  // Hardware
  NO_MAC:                {msg:"No mac address"},
  MALFORMED_MAC :        {msg:"Malformed mac address"},
  NO_OSINTERFACE :       {msg:"os.networkInterface Api not supported"},
  NO_NICS :              {msg:"No (active) network interfaces found."},
  FIRMWARE :             {msg:"Firmware issue"},
  BCAST_GET:             {msg:"Broadcast address not found."},
  
  // Network
  NO_PRIVATE_IP :        {msg:"No private IP found"},
  NO_NAMED_NIC :         {msg:"No named nic" },
  NO_WIFI_INTERFACES:    {msg:'No wifi network interfaces found.'},
  MAC_ACCESS:            {msg:'Unable to find matching access point for MAC '},

  // Windows
  NICLISTFULL:           {msg:'Nic list'},
  WMIC:                  {msg:'Run'},

  // System
  NO_LOGGED_USER:        {msg:"Can't get logged user"},
  OS_NAME:               {msg:"Can't get distro name"},
  OS_VERSION:            {msg:"Can't get distro version"},
  OS_BATTERY_STATE:      {msg:"Can't get battery state"},
  OS_BATTERY_INFO:       {msg:"Can't get battery info"}
};
  