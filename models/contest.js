var mongoose = require('mongoose');

var contestSchema = mongoose.Schema({
  name: String,
  status: String,
  starttime: Date,
  duration: Number,
});

module.exports = mongoose.model('Contest', contestSchema);