'use strict';
var express = require('express');
var router = express.Router();
var Busboy = require('busboy');
var fs = require('fs');
var config = require('../config');

// Var Contest = require('../models/contest');
var Team = require('../models/team');
var Run = require('../models/run');

router.get('/', function(req, res, next) {
  if (req.isAuthenticated()) {
    Team.findOne({username: req.user.username}, function(err, team) {
      if (err) {
        console.log(err);
        return next(err);
      }
      if (team.admin) {
        res.render('admin', {title: config.name});
      }else {
        if (team.members.length > 0) {
          res.render('index', {title: config.name});
        }else {
          res.redirect('/register');
        }
      }
    });
  }else {
    res.redirect('/login');
  }
});

router.get('/api/username', function(req, res) {
  if (req.isAuthenticated()) {
    res.json({
      username: req.user.username,
    });
  }else {
    res.json({});
  }
});

router.get('/logout', function(req, res) {
  if (req.isAuthenticated()) {
    req.logout();
  }
  res.redirect('/');
});

module.exports = router;
