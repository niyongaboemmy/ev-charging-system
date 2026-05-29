require('dotenv').config()
require('./ocpp/server')  // starts :8887
require('./api/app')      // starts :3000
