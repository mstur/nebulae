'use strict';
var session = require('express-session');
var csv = require('csv');
var fs = require('fs');

var config = require('./config');

var Team = require('./models/team');
var Contest = require('./models/contest');
var Clar = require('./models/clar');
var Run = require('./models/run');
var Prob = require('./models/problem');
var School = require('./models/school');

var judgehelper = require('./judges/judgehelper');
var proc = require('child_process');
var async = require('async');

var sessionmiddleware = require('./sessionmiddleware');

module.exports = function(io) {
  io.use(function(socket, next) {
    sessionmiddleware(socket.request, {}, next);
  });

  var timingInterval = null;

  var getTime = function(callback) {
    Contest.findOne({}, {}, {sort: {starttime: -1}}, function(err, contest) {
      if (err) {
        console.log(err);
      }
      var timeString = '';

      if (contest && contest.status === 'started') {

        var startTime = contest.starttime;
        var currTime = new Date();
        var timeDelta = (startTime.getTime() + contest.duration * 60 * 1000 -
          currTime.getTime()) / 1000;
        if (timeDelta <= 0) {
          contest.status = 'finished';
          contest.save(function(err) {
            if (err) {
              console.log(err);
              return err;
            }
            timeString = 'FINISHED';
            return callback(timeString);
          });
        }
        var hours = Math.floor(timeDelta / 3600);
        var minutes = Math.floor((timeDelta - (hours * 3600)) / 60);
        timeString = hours + ':';
        if (minutes < 10) {
          timeString += '0';
        }
        timeString += minutes;
      } else {
        if (contest.status === 'stopped') {
          timeString = 'STOPPED';
        } else if (contest.status === 'finished') {
          timeString = 'FINISHED';
        }
      }
      callback(timeString);
    });
  };

  var whenStarted = function(callback) {
    Contest.findOne({}, {}, {sort: {starttime: -1}}, function(err, contest) {
      if (err) {
        console.log(err);
      }
      if (contest && contest.status === 'started') {
        callback();
      }
    });
  };

  var computeScoreboard = function(callback) {
    Team.find({division: 'novice', admin: {$ne: true,},}, {salt: 0, hash: 0}, {sort: {name: 1}}, function(err,teams) {
      async.map(teams, function(item, callback) {
        calcScore(item, function(score) {
          callback(null, {team: item.username, score: score});
        });
      }, function(err, noviceResults) {
        Team.find({division: 'advanced', admin: {$ne: true,},}, {salt: 0, hash: 0}, {sort: {name: 1}}, function(err,teams) {
          async.map(teams, function(item, callback) {
            calcScore(item, function(score) {
              callback(null, {team: item.username, score: score});
            });
          }, function(err, advResults) {
            callback({novice: noviceResults, advanced: advResults});
          });
        });
      });
    });
  };

  var computeWrittenScoreboard = function(callback) {
    Team.find({division: 'novice', admin: {$ne: true,},}, {salt: 0, hash: 0}, {sort: {name: 1}}, function(err,teams) {
      async.concat(teams, function(item, concatcb) {
        async.map(item.members, function(member, mapcb) {
          mapcb(null, {name: member.name, team: item.username, school: item.school, division: item.division, score: member.score});
        }, function(err, teamMembers) {
          concatcb(null, teamMembers);
        });
      }, function(err, noviceResults) {
        Team.find({division: 'advanced', admin: {$ne: true,},}, {salt: 0, hash: 0}, {sort: {name: 1}}, function(err,teams) {
          async.concat(teams, function(item, concatcb) {
            async.map(item.members, function(member, mapcb) {
              mapcb(null, {name: member.name, team: item.username, school: item.school, division: item.division, score: member.score});
            }, function(err, teamMembers) {
              concatcb(null, teamMembers);
            });
          }, function(err, advResults) {
            callback({novice: noviceResults, advanced: advResults});
          });
        });
      });
    });
  }

  var pointscorrect = 60;
  var pointsdeduction = 5;

  var calcScore = function(team, callback) {
    Run.find({team: team.username}, {}, {sort: {_id: -1}}, function(err, runs) {
      var initial = {
        runningtotal: 0,
        correctquestions: [],
        missedTimes: [],
      };
      var score = runs.reduce(function(prev, curr) {
        if (curr.ruling === 'correct') {
          if (prev.correctquestions !== undefined &&
            prev.correctquestions.indexOf(curr.probnumber) === -1) {
            prev.correctquestions.push(curr.probnumber);
            prev.missedTimes.push(0);
            prev.runningtotal += pointscorrect;
          } else if (prev.correctquestions !== undefined &&
            prev.correctquestions.indexOf(curr.probnumber) !== -1) {
            prev.runningtotal += prev.missedTimes[prev.correctquestions.indexOf(curr.probnumber)] * pointsdeduction;
            prev.missedTimes[prev.correctquestions.indexOf(curr.probnumber)] = 0;
          }
        }else if (curr.ruling === 'compile' || curr.ruling === 'runtime'
          || curr.ruling === 'timeout' || curr.ruling === 'incorrect') {
          if (prev.correctquestions !== undefined &&
            prev.correctquestions.indexOf(curr.probnumber) !== -1) {
            prev.runningtotal -= pointsdeduction;
            prev.missedTimes[prev.correctquestions.indexOf(curr.probnumber)]++;
          }
        }
        return prev;
      }, initial);
      return callback(score.runningtotal);
    });
  };

  var judgeRun = function(id) {
    Run.findOne({_id: id}, function(err, run) {
      if (err) {
        console.log(err);
        return;
      }
      Prob.findOne({number: run.probnumber}, function(err, prob) {
        if (err) {
          console.log(err);
          return;
        }
        if (!prob) {
          console.log('info: Problem ' + run.probnumber + ' does not exist for run ' + run._id);
          return;
        }
        console.log('info: Begin judging run ' + run._id + ' from team ' +
          run.team + ' for problem ' + run.probnumber);

        // TODO: spin this off to config file
        var jdklocation = config.javapath;
        var execstring = '"' + jdklocation + 'java" JavaJudge ' +
          run.path + ' ' + run.filename + ' ' + prob.runtime;
        proc.exec(execstring, {cwd: './judges'}, function(error, stdout) {
          if (error) {
            if (error.code == 1) {
              run.ruling = 'compile';
            } else if (error.code == 2) {
              run.ruling = 'runtime';
            } else if (error.code == 3) {
              run.ruling = 'timeout';
            } else {
              console.log('!!!!!!!!! CRITICAL SYSTEM ERROR !!!!!!!!');
              console.log(error);
              console.log(stdout);
            }
            run.save(function(err, run) {
              if (err) {
                console.log(err);
                return err;
              }
              console.log('info: Run ' + run._id + ' judged as ' + run.ruling);
              io.to(run.team).emit('judgeruling', {
                  runnumber: run.runid,
                  probnumber: run.probnumber,
                  ruling: run.ruling,
                });
            });
            return;
          }

          run.output = stdout;
          run.save();

          var output = stdout.split(/\r?\n/);
          var expected = prob.output.split(/\n/);

          for (var i = 0; i < expected.length; i++) {
            var trimExpected = expected[i].replace(/\\s+$/, '');
            var trimOutput = output[i].replace(/\\s+$/, '');
            if (trimExpected !== trimOutput) {
              console.log('info: Run ' + run._id + ' judged as incorrect');

              run.ruling = 'incorrect';
              run.save(function(err, run) {
                if (err) {
                  console.log(err);
                  return err;
                }
                io.to(run.team).emit('judgeruling', {
                  runnumber: run.runid,
                  probnumber: run.probnumber,
                  ruling: run.ruling,
                });
              });
              return;
            }
          }
          console.log('info: Run ' + run._id + ' judged as correct');

          run.ruling = 'correct';
          run.save(function(err, run) {
            if (err) {
              console.log(err);
              return err;
            }
            io.to(run.team).emit('judgeruling', {
              runnumber: run.runid,
              probnumber: run.probnumber,
              ruling: run.ruling,
            });

            Run.find({team: run.team}, {}, {sort: {_id: 1}},
              function(err, runs) {
              io.to(run.team).emit('updateruns', runs);
            });

            updateScores();
            getOwnScore(run.team);

            Run.find({}, {}, {sort: {_id: 1}}, function(err, runs) {
              if (err) {
                console.log(err);
                return err;
              }
              io.to('admin').emit('updateruns', runs);
            });
          });
        });
      });
    });
  }

  var updateScores = function() {
    computeScoreboard(function(things) {
      io.emit('updatescores', things);
    });
  }

  var getOwnScore = function(team) {
    calcScore({username: team}, function(score) {
      io.to(team).emit('updateteamscore', score);
    });
  }

  whenStarted(function() {
    timingInterval = setInterval(function() {
      getTime(function(timeString) {
        io.sockets.emit('updatetime', {
          timeleft: timeString,
        });
      });
    }, 1000 * 60);
  });

  judgehelper.on('submit', function(id) {
    judgeRun(id);
  });

  io.on('connection', function(socket) {
    socket.on('team connected', function() {
      if (socket.request.session.passport.user) {
        Team.findOne({
          username: socket.request.session.passport.user,
          admin: {$ne: true},
        }, function(err, team) {
          if (err) {
            console.log(err);
            return;
          }
          if (team === null) {
            console.log('error: team auth');
            return;
          }

          socket.join(socket.request.session.passport.user);

          socket.emit('updateinfo', {
            username: team.username,
            school: team.school,
            division: team.division,
            members: team.members,
          });

          getTime(function(timeString) {
            socket.emit('updatetime', {
              timeleft: timeString,
            });
          });
          var memberNames = [];
          team.members.forEach(function(item) {
            memberNames.push(item.name);
          });
          socket.emit('updatemembers', {
            members: memberNames,
          });
          Prob.find({},{},{sort: {number: 1}}, function(err, probs) {
            if (err) {
              console.log(err);
              return err;
            }
            socket.emit('updateprobs', probs);
          });
          Clar.find({
            $or: [{
              team: socket.request.session.passport.user,
            },{
              global: true,
            },],
          }, function(err, clars) {
            socket.emit('updateclars', clars);
          });
          Run.find({team: socket.request.session.passport.user}, function(err, runs) {
            socket.emit('updateruns', runs);
          });
          updateScores();
          getOwnScore(team.username);
          console.log('info: Team ' + socket.request.session.passport.user + ' connected to socket');
        });
      }
    });

    socket.on('clar submitted', function(msg) {
      if (socket.request.session.passport.user) {
        Team.findOne({username: socket.request.session.passport.user,}, function(err, team) {
          if (err) {
            console.log(err);
            return;
          }
          if (team === null) {
            console.log('error: team auth');
            return;
          }
          var newClar = new Clar({
            team: socket.request.session.passport.user,
            problem: msg.problem,
            content: msg.content,
            response: '',
          });

          newClar.save(function(err, newClar) {
            if (err) {
              return console.error(err);
            }
            console.log('info: Recieved clarification ' +
              newClar._id + ' from team ' + newClar.team);
          });
          Clar.find({}, function(err, clars) {
            socket.broadcast.to('admin').emit('updateclars', clars);
          });
          Clar.find({
            $or: [{
              team: socket.request.session.passport.user,
            }, {
              global: true,
            },],
          }, function(err, clars) {
            socket.emit('updateclars', clars);
          });
        });
      }
    });

    socket.on('admin connected', function(msg) {
      if (socket.request.session.passport.user) {
        Team.findOne({
          username: socket.request.session.passport.user,
          admin: true,
        }, function(err, admin) {
          if (err) {
            console.log(err);
            return err;
          }
          if (admin === null) {
            console.log('error: admin auth');
            return;
          }

          socket.join('admin');
          getTime(function(timeString) {
            socket.emit('updatetime', {
              timeleft: timeString,
            });
          });

          Clar.find({}, {}, {sort: {_id: 1}}, function(err, clars) {
            if (err) {
              console.log(err);
              return err;
            }
            socket.emit('updateclars', clars);
          });

          Run.find({}, {}, {sort: {_id: 1}}, function(err, runs) {
            if (err) {
              console.log(err);
              return err;
            }
            socket.emit('updateruns', runs);
          });
          Team.find({admin: {$ne: true}},{salt: 0, hash: 0}, {sort: {username: 1}}, function(err, teams) {
            if (err) {
              console.log(err);
              return err;
            }
            socket.emit('updateteams', teams);
            socket.emit('updatewritten', teams);
          });
          updateScores();
          computeWrittenScoreboard(function(things) {
            socket.emit('updatewrittenscores', things);
          })
          console.log('info: Admin ' + msg + ' connected to socket');
        });
      }
    });

    socket.on('clar response', function(msg) {
      if (socket.request.session.passport.user) {
        Team.findOne({
          username: socket.request.session.passport.user,
          admin: true,
        }, function(err, admin) {
          if (err) {
            console.log(err);
            return err;
          }
          if (admin === null) {
            console.log('error: admin auth');
            return;
          }

          Clar.findOneAndUpdate({
            _id: msg.id,
          }, {
            $set: {
              response: msg.response,
              global: msg.global,
            },
          }, {
            new: true,
          }, function(err, clarification) {
            if (err) {
              console.log(err);
              return err;
            }
            console.log('info: Response recieved for clarification ' +
              clarification._id);
            socket.broadcast.to(clarification.team)
              .emit('clar notification', clarification);
            Clar.find({
              $or: [{
                team: clarification.team,
              }, {
                global: true,
              },],
            }, function(err, clars) {
              socket.broadcast.to(clarification.team).emit('updateclars', clars);
            });
            Clar.find({}, {}, {sort: {_id: 1}}, function(err, clars) {
              if (err) {
                console.log(err);
                return err;
              }
              socket.broadcast.to('admin').emit('updateclars', clars);
            });
          });
        });
      }
    });

    socket.on('change score', function(msg) {
      if (socket.request.session.passport.user) {
        Team.findOne({
          username: socket.request.session.passport.user,
          admin: true,
        }, function(err, admin) {
          if (err) {
            console.log(err);
            return err;
          }
          if (admin === null) {
            console.log('error: admin auth');
            return;
          }

          Team.findOneAndUpdate({
            username: msg.team,
            'members.name': msg.name,
          }, {
            $set: {
              'members.$.score': msg.score,
            },
          }, {
            new: true,
          }, function(err, team) {
            if (err) {
              console.log(err);
              return err;
            }
            console.log('info: Changed score for member ' + msg.name + ' in team ' + msg.team);
            getOwnScore(msg.team);
            Team.find({admin: {$ne: true}},{salt: 0, hash: 0}, {sort: {username: 1}}, function(err, teams) {
              if (err) {
                console.log(err);
                return err;
              }
              io.sockets.to('admin').emit('updatewritten', teams);
              computeWrittenScoreboard(function(things) {
                io.sockets.to('admin').emit('updatewrittenscores', things);
              });
            });
          });
        });
      }
    });

    socket.on('search run', function(msg) {
      if (socket.request.session.passport.user) {
        Team.findOne({
          username: socket.request.session.passport.user,
          admin: true,
        }, function(err, admin) {
          if (err) {
            console.log(err);
            return err;
          }
          if (admin === null) {
            console.log('error: admin auth');
            return;
          }

          console.log('info: searched for team ' + msg.team +
            ' problem ' + msg.probnumber + ' ruling ' + msg.ruling +
            ' runid ' + msg.runid);
          Run.findOne(msg, function(err, run) {
            if (err) {
              console.log(err);
              return err;
            }
            if (run === null) {
              socket.emit('norunfound');
            } else {
              console.log(msg);
              socket.emit('runfound', run);
            }
          });
        });
      }
    });

    socket.on('change ruling', function(msg) {
      if (socket.request.session.passport.user) {
        Team.findOne({
          username: socket.request.session.passport.user,
          admin: true,
        }, function(err, admin) {
          if (err) {
            console.log(err);
            return err;
          }
          if (admin === null) {
            console.log('error: admin auth');
            return;
          }
          Run.findOneAndUpdate({
            _id: msg.id,
          }, {
            $set: {
              ruling: msg.ruling,
            },
          }, {
            new: true,
          }, function(err, run) {
            if (err) {
              console.log(err);
              return err;
            }
            console.log('info: Changed ruling for run ' + run._id + ' to ' + run.ruling);
            Run.find({team: run.team}, {}, {sort: {_id: 1}},
              function(err, runs) {
              io.to(run.team).emit('updateruns', runs);
            });

            Run.find({}, {}, {sort: {_id: 1}}, function(err, runs) {
              if (err) {
                console.log(err);
                return err;
              }
              io.to('admin').emit('updateruns', runs);
            });
          });
        });
      }
    });
    socket.on('start contest', function() {
      if (socket.request.session.passport.user) {
        Team.findOne({
          username: socket.request.session.passport.user,
          admin: true,
        }, function(err, admin) {
          if (err) {
            console.log(err);
            return err;
          }
          if (admin === null) {
            console.log('error: admin auth');
            return;
          }
          Contest.findOne({}, function(err, con) {
            if (err) {
              console.log(err);
              return err;
            }
            if (con === null) {
              console.log('error: no contest');
            }
            con.status = 'started';
            con.starttime = new Date();
            con.save(function(err, con) {
              if (err) {
                console.log(err);
                return err;
              }
              getTime(function(timeString) {
                io.sockets.emit('updatetime', {
                  timeleft: timeString,
                });
              });
              whenStarted(function() {
                timingInterval = setInterval(function() {
                  getTime(function(timeString) {
                    io.sockets.emit('updatetime', {
                      timeleft: timeString,
                    });
                  });
                }, 1000 * 60);
              });
            });
          });
        });
      }
    });

    socket.on('stop contest', function() {
      if (socket.request.session.passport.user) {
        Team.findOne({
          username: socket.request.session.passport.user,
          admin: true,
        }, function(err, admin) {
          if (err) {
            console.log(err);
            return err;
          }
          if (admin === null) {
            console.log('error: admin auth');
            return;
          }
          Contest.findOne({}, function(err, con) {
            if (err) {
              console.log(err);
              return err;
            }
            if (con === null) {
              console.log('error: no contest');
            }
            con.status = 'stopped';

            var startTime = con.starttime;
            var currTime = new Date();
            var timeDelta = (startTime.getTime() + con.duration * 60 * 1000 -
              currTime.getTime()) / 1000;
            var minutes = (timeDelta) / 60;

            con.duration = minutes;

            con.save();
            clearInterval(timingInterval);
            io.sockets.emit('updatetime', {
              timeleft: 'STOPPED',
            });
          });
        });
      }
    });
    socket.on('change duration', function(contest) {
      if (socket.request.session.passport.user) {
        Team.findOne({
          username: socket.request.session.passport.user,
          admin: true,
        }, function(err, admin) {
          if (err) {
            console.log(err);
            return err;
          }
          if (admin === null) {
            console.log('error: admin auth');
            return;
          }
          Contest.findOne({}, function(err, con) {
            if (err) {
              console.log(err);
              return err;
            }
            if (con === null) {
              console.log('error: no contest');
            }

            con.duration = contest.duration;

            con.save(function(err) {
              if (err) {
                console.log(err);
                return err;
              }
              getTime(function(timeString) {
                io.sockets.emit('updatetime', {
                  timeleft: timeString,
                });
              });
            });
          });
        });
      }
    });
    socket.on('get schools', function(contest) {
      if (socket.request.session.passport.user) {
        Team.findOne({
          username: socket.request.session.passport.user,
        }, function(err, user) {
          if (err) {
            console.log(err);
            return err;
          }
          if (user === null) {
            console.log('error: team auth');
            return;
          }
          School.find({}, function(err, schools) {
            socket.emit('updateschools', schools);
          });
        });
      }
    });
    socket.on('batch create accounts', function(data) {
      if (socket.request.session.passport.user) {
        Team.findOne({
          username: socket.request.session.passport.user,
          admin: true,
        }, function(err, admin) {
          if (err) {
            console.log(err);
            return err;
          }
          if (admin === null) {
            console.log('error: admin auth');
            return;
          }
          var parser = csv.parse(data, function(err, parsed) {
            if (err) {
              console.log(err);
              return err;
            }
            async.each(parsed, function(item, cb) {
              Team.register(new Team({
                username: item[0],
                lastrun: -1,
                school: '',
                division: '',
              }), item[1], function(err) {
                if (err) {
                  console.log(err);
                  return err;
                }
                fs.mkdir(__dirname + '/runs/' + item[0] + '/', function(err) {
                  if (err && err.code !== 'EEXIST') {
                    // Ignore error if the folder already exists
                    console.log(err);
                  }
                });
                console.log('info: created account ' + item[0]);
              });
            }, function(err) {
              console.log(err);
            });
          });
        });
      }
    });
    socket.on('create problem', function(data) {
      if (socket.request.session.passport.user) {
        Team.findOne({
          username: socket.request.session.passport.user,
          admin: true,
        }, function(err, admin) {
          if (err) {
            console.log(err);
            return err;
          }
          if (admin === null) {
            console.log('error: admin auth');
            return;
          }
          var prob = new Prob(data).save(function(err, problem) {
            if (err) {
              console.log(err);
              return err;
            }
            console.log('info: created problem ' + problem.name);
          });
        });
      }
    });
  });
};