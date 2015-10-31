'use strict';
var express = require('express');
var path = require('path');
var fs = require('fs');
// Var favicon = require('serve-favicon');
var logger = require('morgan');
var cookieParser = require('cookie-parser');
var bodyParser = require('body-parser');
var sessionmiddleware = require('./sessionmiddleware');
var mongoose = require('mongoose');
var passport = require('passport');
// Var LocalStrategy = require('passport-local').Strategy;

var routes = require('./routes/index');
var login = require('./routes/login');
var register = require('./routes/register');
var submit = require('./routes/submit');

var app = express();

mongoose.connect('mongodb://localhost/nebulae');
var db = mongoose.connection;
db.on('error', console.error.bind(console,'connection error:'));

// View engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'hbs');

// Uncomment after placing your favicon in /public
// app.use(favicon(path.join(__dirname, 'public', 'favicon.ico')));

app.use(logger('dev'));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(sessionmiddleware);
app.use(passport.initialize());
app.use(passport.session());
app.use(express.static(path.join(__dirname, 'public')));

app.use('/', routes);
app.use('/login', login);
app.use('/register', register);
app.use('/submit', submit);

var Team = require('./models/team');

passport.use(Team.createStrategy());
passport.serializeUser(Team.serializeUser());
passport.deserializeUser(Team.deserializeUser());

var Contest = require('./models/contest');
var Problem = require('./models/problem');

Contest.findOne({}, function(err, con) {
  if (err) {
    console.log(err);
    return err;
  }
  if (con === null) {
    var currentContest = new Contest({
      name: 'contest',
      status: 'stopped',
      starttime: null,
      duration: 120,
    });
    console.log('info: initializing a new contest');

    currentContest.save(function(err, contest) {
      if (err) {
        return console.error(err);
      }
      console.log('info: created a new contest');
      var DryRun = new Problem({
        number: 0,
        name: 'DryRun',
        output: 'I like cabbage.\nI like contests.\nI like judges.\nI like everything.',
        runtime: 1,
      }).save();

      Team.register(new Team({
        username: 'admin',
        admin: true,
      }), 'admin', function(err) {
        if (err) {
          console.log(err);
          return err;
        }
      });
    });
  }
  fs.mkdir(__dirname + '/runs/', function(err) {
    if (err && err.code !== 'EEXIST') {
      // Ignore error if the folder already exists
      console.log(err);
    }
  });
});

// Catch 404 and forward to error handler
app.use(function(req, res, next) {
  var err = new Error('Not Found');
  err.status = 404;
  next(err);
});

// Error handlers

// Development error handler
// will print stacktrace
if (app.get('env') === 'development') {
  app.use(function(err, req, res, next) {
    res.status(err.status || 500);
    res.render('error', {
      message: err.message,
      error: err,
    });
  });
}

// Production error handler
// no stacktraces leaked to user
app.use(function(err, req, res, next) {
  res.status(err.status || 500);
  res.render('error', {
    message: err.message,
    error: {},
  });

});


module.exports = app;
