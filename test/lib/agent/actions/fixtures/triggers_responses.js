var exact_triggers = [
  {
    "id":105,
    "name":"trigger 105",
    "events":[
      {
        "type": "exact_time",
        "info": {
          "date": "" + (new Date().getFullYear() +1) + "0725150006"     // "20200725150406" Always next year
        }
      }
    ],
    "actions":[
      {
        "delay": 0,
        "action":{
          "command": "start",
          "target": "alert",
          "options": {
            "alert_message": "hi"
          }
        }
      },
      {
        "delay": 5000,
        "action":{
          "command": "start",
          "target": "alarm",
          "options": {
            "sound": "modem"
          }
        }
      }
    ]
   },
   
   {
    "id":106,
    "name":"trigger 106",
    "events":[
      {
        "type": "exact_time",
        "info": {
          //"date": "" + (new Date().getFullYear()+1) + "-07-25T15:04:07Z-04:00" // "2020-07-25T15:04:07Z-04:00"
          "date": "" + (new Date().getFullYear() +1) + "0725150007"
        }
      }
    ],
    "actions":[
      {
        "delay": 1000,
        "action":{
          "command": "start",
          "target": "lock",
          "options": {
            "unlock_pass": "preyrocks"
          }
        }
      }
    ]

   }
]

var repeat_triggers = [
  {
    "id": 107,
    "name": "trigger 107",
    "events":[
      {
        "type" : "repeat_time",
        "info" : {
          "days_of_week" : [1, 4],  // Mondays and Thursdays
          "hour" : 20,
          "minute" : 25,
          "second" : 10,
          "until" : "20190626"
        }
      }
    ],
    "actions":[
      {
        "delay": 0,
        "action": {
          "command": "start",
          "target": "alert",
          "options": {
            "alert_message": "holi"
          }
        }
      },
    ]
  }
]

var event_triggers = [
  {
    "id": 108,
    "name": "trigger 108",
    "events":[
      {
        "type" : "new_location"
      }
    ],
    "actions":[
      {
        "delay": 100,
        "action":{
          "command": "start",
          "target": "alert",
          "options":{
            "alert_message": "holi"
          }
        }
      },
    ]
  },
  {
    "id": 109,
    "name": "trigger 109",
    "events":[
      {
        "type" : "disconnected"
      }
    ],
    "actions":[
      {
        "delay": 0,
        "action":{
          "command": "start",
          "target": "lock",
          "options":{
            "unlock_pass":"preyrocks"
          }
        }
      },
    ]
  },
  {
    "id": 110,
    "name": "trigger 110",
    "events":[
      {
        "type" : "new_location"
      },
      { 
        "type":"repeat_range_time", 
        "info": {
          "days_of_week": [6, 0],    // Saturday and Sunday
          "hour_from": "090000",
          "hour_until": "090159",
          "until":null
        }
      }
    ],
    "actions":[
      {
        "delay": 500,
        "action": {
          "command": "start",
          "target": "alarm",
          "options":{
            "sound":"modem"
          }
        }
      },
    ]
  },
  {
    "id": 111,
    "name": "trigger 111",
    "events":[
      {
        "type" : "geofencing_in",
        "info" : {
          "id": 666
        }
      }
    ],
    "actions":[
      {
        "delay": 0,
        "action": {
          "command": "start",
          "target": "alarm",
          "options": {
            "sound":"modem"
          }
        }
      },
    ]
  },
  {
    "id": 112,
    "name": "trigger 112",
    "events":[
      {
        "type" : "geofencing_in",
        "info" : {
          "id": 667
        }
      }
    ],
    "actions":[
      {
        "delay": 0,
        "action": {
          "command": "start",
          "target": "lock",
          "options": {
            "unlock_pass":"dapassword"
          }
        }
      },
    ]
  },
  {
    "id": 113,
    "name": "trigger 113",
    "events":[
      {
        "type" : "power_changed",
      }
    ],
    "actions":[
      {
        "delay": 0,
        "action": {
          "command": "start",
          "target": "lock",
          "options": {
            "unlock_pass":"dapassword2"
          }
        }
      },
    ]
  },
  {
    "id": 114,
    "name": "trigger 114",
    "events":[
      {
        "type" : "stopped_charging",
      },
      {
        "type" : "range_time",
        "info" : {
          "from" : '20190630120000',
          "until" : '20190701150000'
        }
      }
    ],
    "actions":[
      {
        "delay": 0,
        "action": {
          "command": "start",
          "target": "alert",
          "options": {
            "alert_message":"alo"
          }
        }
      },
    ]
  },
  {
    "id": 115,
    "name": "trigger 115",
    "events":[
      {
        "type" : "mac_address_changed",
      },
      {
        "type" : "range_time",
        "info" : {
          "from" : '20190130120000',
          "until" : '20190801150000'
        }
      },
      {
        "type":"repeat_range_time",
        "info": {
          "days_of_week": [1, 2],    // Saturday and Sunday
          "hour_from": "120000",
          "hour_until": "133000",
          "until":null
        }
      }
    ],
    "actions":[
      {
        "delay": 0,
        "action": {
          "command": "start",
          "target": "lock",
          "options": {
            "unlock_pass":"oeoe"
          }
        }
      }
    ]
  },

]

module.exports = {exact_triggers, repeat_triggers, event_triggers};