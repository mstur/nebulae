var mongoose = require('mongoose');
var plm = require('passport-local-mongoose');

var teamSchema = mongoose.Schema({
  members: [{name: String, score: Number}],
  school: String,
  division: String,
  admin: Boolean,
  lastrun: Number,
});
teamSchema.plugin(plm);

module.exports = mongoose.model('Team', teamSchema);