var express = require('express');
var router = express.Router();
var config = require('../config');

var passport = require('passport');

var Team = require('../models/team');

router.get('/', function(req, res, next) {
  if (req.isAuthenticated()) {
    res.render('register', {title: config.name});
  }
});

router.post('/',  function(req, res, next) {
  if (req.isAuthenticated()) {
    var newmembers = [{
      name: req.body.member1,
      score: null,
    }, {
      name: req.body.member2,
      score: null,
    }, {
      name: req.body.member3,
      score: null,
    },];
    Team.findOneAndUpdate({
      username: req.user.username,
    }, {
      members: newmembers,
      school: req.body.school,
      division: req.body.division,
    }, function(err, team) {
      if (err) {
        console.log(err);
        return next(err);
      }
      res.redirect('/');
    });
  }
});

module.exports = router;
