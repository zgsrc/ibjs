require("sugar").extend();

const connectErrorHelp = "Make sure TWS or IB Gateway is running and you are logged in.\n" + 
    "Then check IB software is configured to accept API connections over the correct port.\n" +
    "If all else fails, try restarting TWS or IB Gateway.";


////////////////////////////////////////////////////////////////////////
// NOT THAT YOU NEED IT, BUT YOU MIGHT WANT IT
////////////////////////////////////////////////////////////////////////
const id = exports.id = 0,
      IB = exports.IB = require("ib"),
      Service = exports.Service = require("./service/service"),
      Dispatch = exports.Dispatch = require("./service/dispatch"),
      Proxy = exports.Proxy = require("./service/proxy"),
      Session = exports.Session = require("./session");


////////////////////////////////////////////////////////////////////////
// THE PROGRAMMING INTERFACE
////////////////////////////////////////////////////////////////////////
const setup = exports.setup = require("./lang/setup"),
      constants = exports.constants = require("./constants"),
      studies = exports.studies = require("./model/studies");

exports.session = setup.initializeSession;