const fs = require("fs"),
      http = require("http");

exports.path = __dirname + "ib.js";
exports.read = () => exports.src = fs.readFileSync(exports.path).toString();
exports.read();

exports.server = () => http.createServer((req, res) => {
    
});