var mongoose = require('mongoose');

var clarSchema = mongoose.Schema({
  team: String,
  problem: Number,
  content: String,
  response: String,
  global: Boolean,
});

module.exports = mongoose.model('Clarification', clarSchema);