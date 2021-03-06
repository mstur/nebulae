var express = require('express');
var router = express.Router();
var config = require('../config');

var passport = require('passport');

router.get('/', function(req, res, next) {
  if (req.isAuthenticated()) {
    res.redirect('/');
  }else {
    res.render('login', {title: config.name});
  }
});

router.post('/', function(req, res, next) {
  passport.authenticate('local', function(err, user, info) {
    if (err) {
      return next(err);
    }
    if (!user) {
      return res.redirect('/login');
    }
    console.log('info: Team ' + user.username + ' logged in');
    req.logIn(user, function(err) {
      if (err) {
        return next(err);
      }
      return res.redirect('/');
    });
  }) (req, res, next);
});

module.exports = router;
