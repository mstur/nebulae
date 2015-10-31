var mongoose = require('mongoose');

var probSchema = mongoose.Schema({
  number: Number,
  name: String,
  output: String,
  runtime: Number,
});

module.exports = mongoose.model('Prob', probSchema);