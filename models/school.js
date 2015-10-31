var mongoose = require('mongoose');
var schoolSchema = mongoose.Schema({
  name: String,
});

module.exports = mongoose.model('School', schoolSchema);