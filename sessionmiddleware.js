var cookieSession = require('cookie-session');
var config = require('./config');

module.exports = cookieSession({
  name: config.name,
  secret: config.secret,
});