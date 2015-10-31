var mongoose = require('mongoose');

var runSchema = mongoose.Schema({
  probnumber: Number,
  runid: Number,
  team: String,
  path: String,
  filename: String,
  output: String,
  ruling: String,
});

module.exports = mongoose.model('Run', runSchema);