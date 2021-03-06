const fs = require('fs');
const dotenv = require('dotenv').load();
const express = require('express');
const app = express();

const env = process.env.NODE_ENV || "development";

let http, https, httpapp;

if(env == "production") {

    httpapp = express();
    httpapp.set('httpport', 8080);
    const creds = require('../config/config').credentials;
    const credentials = {
        key: fs.readFileSync(creds.key),
        cert: fs.readFileSync(creds.cert),
        requestCert: true
    }; 


    http = require('http').createServer(httpapp);

    httpapp.get('*', (req, res) => {
        res.redirect('https://hellochess.com');
    });
    https = require('https').createServer(credentials, app);
} else {
    http = require('http').createServer(app);
}


const path = require('path');
const bodyParser = require('body-parser');
const morgan = require('morgan');
const _ = require('lodash');
let io;
if(env == "production") {
    io = require('socket.io')(https);
} else {
    io = require('socket.io')(http);
}

const cors = require('cors');

const router = require('./router');
const {mongoose} = require('./db/mongoose');
const {User} = require('./models/user');
const {authenticate} = require('./middleware/authenticate');

let allowCrossDomain = null;

//CORS middleware for testing purposes
if(env == "production") {
    allowCrossDomain = function(req, res, next) {
        res.header('Access-Control-Allow-Origin', [
            'https://www.hellochess.com'
        ]);
        res.header('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE,PATCH');
        res.header('Access-Control-Allow-Headers', 'Content-Type, x-auth');
        res.header('Access-Control-Expose-Headers', 'x-auth');
        next();
    }
} else {
    allowCrossDomain = function(req, res, next) {
        res.header('Access-Control-Allow-Origin', [
            'http://localhost:8080', 
            'https://hellochess-johnnyvf24.c9users.io', 
            'https://www.hellochess.com', 
            'https://hellochess-dev-johnnyvf24.c9users.io'
        ]);
        res.header('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE,PATCH');
        res.header('Access-Control-Allow-Headers', 'Content-Type, x-auth');
        res.header('Access-Control-Expose-Headers', 'x-auth');
        next();
    }
}

if(env == "production") {
    //set port variable
    app.set('port', process.env.PORT || 8443);
} else {
    app.set('port', process.env.PORT || 3000);
}
//middleware
//app.use(morgan('combined'));
app.use(allowCrossDomain);
app.use(bodyParser.json());
//serve up static public folder
app.use(express.static(path.join(__dirname, '../public')));

if(env == "production") {
    httpapp.listen(httpapp.get('httpport'), function() {
        console.log(`http redirecting from port ${httpapp.get('httpport')}`);
    });
    //listen to the required port
    https.listen(app.get('port'), function() {
      console.log(`Express server listening on port ${app.get('port')}`);
    });
} else {
    //listen to the required port
    http.listen(app.get('port'), function() {
        console.log(`Express server listening on port ${app.get('port')}`);
    });
}

process.on("uncaughtException", function(err) {
    console.log("uncaughtException:", err);
});

require('./sockets/sockets').socketServer(io);
router(app);
