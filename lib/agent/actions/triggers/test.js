var exact_triggers = [
  {
    "id":105,
    "name":"trigger 105",
    "events":[
      {
        "type": "exact_time",
        "info": {
          "date" : "20190627153200"
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
  }
]

var event_triggers = [
  {
    "id": 109,
    "name": "trigger 109",
    "events":[
      {
        "type" : "stopped_charging"
      }
    ],
    "actions":[
      {
        "delay": 0,
        "action":{
          "command": "start",
          "target": "alert",
          "options":{
            "alert_message":"STOPPED CHARGING!"
          }
        }
      },
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
          "days_of_week" : [4, 1],
          "hour" : 15,
          "minute" : 46,
          "second" : 00,
          "until" : "20190726"
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


module.exports = {exact_triggers, event_triggers, repeat_triggers};