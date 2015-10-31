var socket = io();

var nebulaeAdminApp = angular.module('nebulaeAdmin', []);

nebulaeAdminApp.config(function($interpolateProvider) {
  $interpolateProvider.startSymbol('((');
  $interpolateProvider.endSymbol('))');
});

nebulaeAdminApp.controller('overviewController', function($scope, $http) {
  $http.get('/api/username').success(function(data, status, headers, config) {
    if (data.hasOwnProperty('username')) {
      $scope.username = data.username;
      socket.emit('admin connected', data.username);
    }
  }).error(function(data, status, headers, config) {
    console.log('could not get team name');
  });

  socket.on('updatetime', function(msg) {
    $scope.timeleft = msg.timeleft;
    $scope.$apply();
  });

  socket.on('updatemembers', function(msg) {
    $scope.members = msg.members;
    $scope.$apply();
  });

  $scope.startContest = function() {
    socket.emit('start contest');
  };

  $scope.stopContest = function() {
    socket.emit('stop contest');
  };

  $scope.durationModal = function() {
    // JQuery jank
    $('#changeDurationModal').modal();
  };

  $scope.changeDuration = function(contest) {
    socket.emit('change duration', {
      duration: contest.duration,
    });
  };
});

nebulaeAdminApp.controller('tabController', function($scope) {
  $scope.activetab = 'runsandclars';

  $scope.switchToRunsAndClars = function() {
    $scope.activetab = 'runsandclars';
  };
  $scope.switchToAppeals = function() {
    $scope.activetab = 'appeals';
  };
  $scope.switchToTeams = function() {
    $scope.activetab = 'teams';
  };
  $scope.switchToScoreboard = function() {
    $scope.activetab = 'scoreboard';
  };
  $scope.switchToWritten = function() {
    $scope.activetab = 'written';
  };
  $scope.switchToAccounts = function() {
    $scope.activetab = 'accounts';
  };
  $scope.switchToProblems = function() {
    $scope.activetab = 'problems';
  };
});

nebulaeAdminApp.controller('runsAndClarsController', function($scope, $http) {
  $scope.sendResponse = function(resp) {
    var respGlobal = resp.global;
    if (respGlobal === undefined) {
      respGlobal = false;
    }
    socket.emit('clar response', {
      id: resp.id,
      response: resp.content,
      global: respGlobal,
    });
  };

  $scope.respondToClar = function(clarid) {
    // JQuery jank
    $('#responsemodal').modal();
    $scope.resp = {
      id: clarid,
    };
  };

  socket.on('updateclars', function(msg) {
    $scope.clars = msg;
    $scope.$apply();
  });

  socket.on('updateruns', function(msg) {
    $scope.runs = msg;
    $scope.$apply();
  });
});

nebulaeAdminApp.controller('appealsController', function($scope, $http) {
  var hasRun = false;
  $scope.searchRun = function(query) {
    socket.emit('search run', query);
  };

  $scope.changeRuling = function(run, ruling) {
    socket.emit('change ruling', {
      id: run._id,
      ruling: ruling,
    });
  };

  socket.on('runfound', function(msg) {
    $scope.run = msg;
    hasRun = true;
    $scope.$apply();
  });

  socket.on('norunfound', function() {
    setTimeout(function() {
      alert('No run found for the query');
    }, 1);
  });
});

nebulaeAdminApp.controller('teamsController', function($scope, $http) {
  socket.on('updateteams', function(teams) {
    teams = teams.sort(function(a, b) {
      var numA = parseInt(a.username.substring(4));
      var numB = parseInt(b.username.substring(4));
      return numA - numB;
    });
    $scope.teams = teams;
    $scope.$apply();
  });
});

nebulaeAdminApp.controller('scoreboardController', function($scope, $http) {
  $http.get('/api/username').success(function(data, status, headers, config) {
    if (data.hasOwnProperty('username')) {
      $scope.username = data.username;
    }
  }).error(function(data, status, headers, config) {
    console.log('could not get team name');
  });

  socket.on('updatescores', function(msg) {
    msg.novice = msg.novice.sort(function(a, b) {
      return b.score - a.score;
    });
    msg.advanced = msg.advanced.sort(function(a, b) {
      return b.score - a.score;
    });
    $scope.scores = msg;
    $scope.$apply();
  });
});

nebulaeAdminApp.controller('writtenController', function($scope, $http) {
  socket.on('updatewritten', function(msg) {
    msg = msg.sort(function(a, b) {
      var numA = parseInt(a.username.substring(4));
      var numB = parseInt(b.username.substring(4));
      return numA - numB;
    });
    $scope.teams = msg;
    $scope.$apply();
  });

  socket.on('updatewrittenscores', function(msg) {
    msg.novice = msg.novice.sort(function(a, b) {
      return b.score - a.score;
    });
    msg.advanced = msg.advanced.sort(function(a, b) {
      return b.score - a.score;
    });
    $scope.scores = msg;
    $scope.$apply();
  });

  $scope.changeScore = function(team, name, score) {
    if (parseInt(score) !== null && score <= 240 && score >= -80) {
      socket.emit('change score', {team: team, name: name, score: score});
    }
  }
});

nebulaeAdminApp.controller('accountController', function($scope, $http) {
  $scope.batchCreate = function(csv) {
    socket.emit('batch create accounts', csv);
  }
});

nebulaeAdminApp.controller('problemController', function($scope, $http) {
  $scope.sendProblem = function(problem) {
    socket.emit('create problem', problem);
  }
});