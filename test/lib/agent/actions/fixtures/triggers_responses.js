var exact_triggers = [
  {
    "id":105,
    "name":"trigger 105",
    "events":[
      {
        "type": "exact_time",
        "info": {
          "date": "" + (new Date().getFullYear() +1) + "0725150406"     // "20200725150406" Always next year
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
          "date": "" + (new Date().getFullYear()+1) + "-07-25T15:04:07Z-04:00" // "2020-07-25T15:04:07Z-04:00"
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
            "password": "preyrocks"
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
          "hour" : 14,
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
            "password":"preyrocks"
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
    "name": "trigger 111",
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
            "password":"dapassword"
          }
        }
      },
    ]
  },
  {
    "id": 113,
    "name": "trigger 111",
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
            "password":"dapassword2"
          }
        }
      },
    ]
  }

]

module.exports = {exact_triggers, repeat_triggers, event_triggers};