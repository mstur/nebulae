'use strict';
var express = require('express');
var router = express.Router();
var Busboy = require('busboy');
var fs = require('fs');
var judgehelper = require('../judges/judgehelper');
var config = require('../config');

var Run = require('../models/run');
var Contest = require('../models/contest');
var Team = require('../models/team');

router.post('/', function(req, res, next) {
  if (req.isAuthenticated()) {
    Contest.findOne({}, {}, {sort: {starttime: -1}}, function(err, contest) {
      if (err) {
        console.log(err);
        return err;
      }
      if (contest.status === 'started') {
        Team.findOne({username: req.user.username}, function(err, team) {
          if (err) {
            console.log(err);
            return err;
          }
          team.lastrun += 1;
          team.save(function(err) {
            if (err) {
              console.log(err);
              return err;
            }
            var run = new Run({
              probnumber: -1,
              runid: team.lastrun,
              team: req.user.username,
              path: '',
              filename: '',
              output: '',
              ruling: 'preliminary',
            });
            run.path = __dirname + '/../runs/' + req.user.username + '/' + run._id + '/';

            run.save(function(err, run) {
              if (err) {
                console.log(err);
                return next(err);
              }
              var busboy = new Busboy({headers: req.headers});

              busboy.on('field', function(fieldname, val) {
                if (fieldname === 'probnumber') {
                  if (!isNaN(parseInt(val))) {
                    run.probnumber = parseInt(val);
                    run.save();
                  }else {
                    run.ruling = 'invalid';
                    run.save();
                  }
                }
              });

              busboy.on('file', function(fieldname, file, filename) {
                if (run.ruling !== 'invalid') {
                  var path = __dirname + '/../runs/' + req.user.username + '/' + run._id + '/';
                  fs.mkdir(path, function(err) {
                    if (err && err.code !== 'EEXIST') {
                      // Ignore error if the folder already exists
                      console.log(err);
                      return;
                    }
                    file.pipe(fs.createWriteStream(path + filename));
                    run.filename = filename.replace(/\.java$/, '');
                    run.ruling = 'uploaded';
                    run.save(function(err) {
                      if (err) {
                        console.log(err);
                        return;
                      }
                      console.log('info: Recieved run ' + run._id + ' from team ' + run.team + ' for problem ' + run.probnumber);
                      Run.find({team: run.team}, {}, {sort: {_id: 1}}, function(err, runs) {
                        res.json({
                          success: true,
                          runnumber: run.runid,
                          probnumber: run.probnumber,
                          runs: runs,
                        });
                      });
                      judgehelper.emit('submit', run._id);
                    });
                  });
                }
              });
              req.pipe(busboy);
            });
          });
        });
      } else {
        if (contest.status === 'stopped') {
          res.json({
            success: false,
            msg: 'The contest has not started yet',
          });
        } else if (contest.status === 'finished') {
          res.json({
            success: false,
            msg: 'The contest has ended',
          });
        }
      }
    });
  }
});

module.exports = router;