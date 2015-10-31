var mongoose = require('mongoose');
var plm = require('passport-local-mongoose');

var adminSchema = mongoose.Schema({});
adminSchema.plugin(plm);

module.exports = mongoose.model('Admin', adminSchema);