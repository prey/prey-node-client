const storage = require('./utils/storage');

    exports.processAck = (json, cb) => {
        json.ack_id = '1234534'
        if (!existKeyAckInJson(json)) {
        return cb(new Error('there is no key ack_id in the json'));
        }
        else{
            exports.verifyIfExistId(json.ack_id, (err, exist) => {
                if (err) return cb(new Error(err));
                if (exist) return cb(new Error('El ack_id ya existe!'));
                exports.registerAck(json, (err, register) => {
                    if (err) return cb(new Error(err));
                    return cb(null, register)
                });
            });
        }
    }

    const existKeyAckInJson = (json) => {
        if (json.hasOwnProperty("ack_id")) 
            return true;
        return false;
    }
    exports.updateAck = (json, cb) => {
        storage.do('update', {
            type: 'ack',
            id: json.ack_id,
            columns: ['retries'],
            values: [json.retries + 1],
          }, (err) => {
            if (err) return cb(new Error(err));
            return cb && cb(null, {
                "ack_id": json.ack_id,
                "type": "ack",
                "retries": json.retries + 1
            })
          });
    }

     exports.registerAck = (json, cb) => {
        storage.do(
            'set', 
            {type: 'ack', id: json.ack_id, data: {id: json.ack_id, type: 'ack', retries: json.retries}},
            function(err) {
            if (err) return cb(new Error(err));
            return cb(null, {
                "ack_id": json.ack_id,
                "type": "ack"
            })
        })
    }

    exports.verifyIfExistId = (ack_id, cb) => {
        storage.do(
        'query',
        { type: 'ack', column: 'id', data: ack_id },
        function (err, rows) {
            if (err) return cb(err);

            if (rows && rows.length == 0)
            return cb(null, false);

            else return cb(null, true);
        }
        );
    };