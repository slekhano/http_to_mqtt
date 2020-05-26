const settings = {
    mqtt: {
        host: process.env.MQTT_HOST || '',
        user: process.env.MQTT_USER || '',
        password: process.env.MQTT_PASS || '',
        clientId: process.env.MQTT_CLIENT_ID || null
    },
    debug: process.env.DEBUG_MODE || false,
    auth_key: process.env.AUTH_KEY || '',
    http_port: process.env.PORT || 5000
}

const mqtt = require('mqtt');
const express = require('express');
const bodyParser = require('body-parser');
const multer = require('multer');

const app = express();

function getMqttClient() {
    const options = {
        username: settings.mqtt.user,
        password: settings.mqtt.password
    };

    if (settings.mqtt.clientId) {
        options.clientId = settings.mqtt.clientId
    }

    return mqtt.connect(settings.mqtt.host, options);
}

const globalMqttClient = getMqttClient();

app.set('port', settings.http_port);
app.use(bodyParser.text({ type: 'text/plain' }))

function logRequest(req, res, next) {
    const ip = req.headers['x-forwarded-for'] || req.connection.remoteAddress;
    var message = 'Received request [' + req.originalUrl + '] from [' + ip + ']';

    if (settings.debug) {
        message += ' with payload [' + JSON.stringify(req.body) + ']';
    } else {
        message += '.';
    }
    console.log(message);

    next();
}


app.use('/', logRequest, function (req, res) {
    const topic = req.path.replace(/^\//g, '');
    if (req.method === 'PUT') {
        globalMqttClient.publish(topic, req.body, {retain: true });
        res.sendStatus(200);
    }
    else if (req.method === 'DELETE') {
        globalMqttClient.publish(topic, null, {retain: true});
        res.sendStatus(200);
    }
    else if (req.method === 'POST') {
        globalMqttClient.publish(topic, req.body);
        res.sendStatus(200);
    }
    else if (req.method === "GET") {
        const localMqttClient = getMqttClient();
        localMqttClient.on('connect', function () {
            localMqttClient.subscribe(topic);
        });

        localMqttClient.on('message', function (t, m) {
            res.send(m.toString());
            res.end();
            localMqttClient.end();
        });
        res.setTimeout(1 * 500, () => {
            res.end();
            localMqttClient.end();
        });
    }
    else {
        res.status(500).send("wrong method");
    }
});

app.listen(app.get('port'), function () {
    console.log('Node app is running on port', app.get('port'));
})//.setTimeout(1 * 1000);
