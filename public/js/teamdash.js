var socket = io();

var nebulaeTeamApp = angular.module('nebulaeTeam', ['ngFileUpload']);

nebulaeTeamApp.config(function($interpolateProvider) {
  $interpolateProvider.startSymbol('((');
  $interpolateProvider.endSymbol('))');
});

nebulaeTeamApp.value('probs', {});

nebulaeTeamApp.controller('overviewController', function($scope, $http) {
  $http.get('/api/username').success(function(data, status, headers, config) {
    if (data.hasOwnProperty('username')) {
      $scope.username = data.username;
      socket.emit('team connected', data.username);
    }
  }).error(function(data, status, headers, config) {
    console.log('could not get team name');
  });

  socket.on('updateteamscore', function(score){
    $scope.score = score;
    $scope.$apply();
  })

  socket.on('updatetime', function(msg) {
    $scope.timeleft = msg.timeleft;
    $scope.$apply();
  });

  socket.on('updatemembers', function(msg) {
    $scope.members = msg.members;
    $scope.$apply();
  });
});

nebulaeTeamApp.controller('tabController', function($scope) {
  $scope.activetab = 'runs';

  $scope.switchToRuns = function() {
    $scope.activetab = 'runs'
  };

  $scope.switchToClars = function() {
    $scope.activetab = 'clars'
  };

  $scope.switchToScores = function() {
    $scope.activetab = 'scores'
  };

  $scope.switchToTeam = function() {
    $scope.activetab = 'team'
  };
});


nebulaeTeamApp.controller('runController', ['$scope', 'Upload', 'probs', function($scope, Upload, probs) {
  $scope.sendFile = function(run) {
    if (run.file && !run.file.$error) {
      var query = 'Are you sure you want to send the following run:' +
                  '\nProblem: ' + run.problem +
                  '\nFile: ' + run.file.name;
      setTimeout(function() {
        if (confirm(query)) {
          Upload.upload({
            url: 'submit',
            fields: {
              probnumber: run.problem,
            },
            file: run.file,
          }).success(function(data, status, headers, config) {
            if (data.success) {
              setTimeout(function() {
                alert('Confirmation of run receipt: ' +
                  '\nRun ID: ' + data.runnumber +
                  '\nProblem: ' + data.probnumber
                );
                $scope.runs = data.runs;
                $scope.$apply();
              }, 1);
            } else {
              setTimeout(function() {
                alert(data.msg);
              }, 1);
            }
          }).error(function(data, status, headers, config) {
            setTimeout(function() {
              alert('Error submitting run');
            }, 1);
          });
          $scope.run = null;
        }
      }, 1);
    }
  };

  socket.on('updateprobs', function(msg) {
    $scope.probs = msg;
    $scope.$apply();
  });

  socket.on('updateruns', function(data) {
    $scope.runs = data;
    $scope.$apply();
  });

  socket.on('judgeruling', function(data) {
    setTimeout(function() {
      if (data.ruling === 'runtime' || data.ruling === 'compile') {
        data.ruling += ' error';
      }
      alert('Judge response:' +
      '\nRun ID: ' + data.runnumber +
      '\nProblem: ' + data.probnumber +
      '\nRuling: ' + data.ruling
      );
    }, 1);
  });
},]);

nebulaeTeamApp.controller('clarificationController', function($scope, $http) {
  $http.get('/api/username').success(function(data, status, headers, config) {
    if (data.hasOwnProperty('username')) {
      $scope.username = data.username;
    }
  }).error(function(data, status, headers, config) {
    console.log('could not get team name');
  });


  $scope.sendClar = function(clar) {
    clar.team = $scope.username;

    var query = 'Are you sure you want to request this clarification?' +
          '\nProblem: ' + clar.problem +
          '\nQuestion: ' + clar.content;
    setTimeout(function() {
      if (confirm(query)) {
        socket.emit('clar submitted', clar);
        $scope.clar = null;
      }
    }, 1);
  }

  socket.on('updateprobs', function(msg) {
    $scope.probs = msg;
    $scope.$apply();
  });

  socket.on('updateclars', function(msg) {
    $scope.clars = msg;
    $scope.$apply();
  });

  socket.on('clar notification', function(msg) {
    setTimeout(function() {
      alert('Clarification Response: ' +
      '\nTeam: ' + msg.team +
      '\nQuestion: ' + msg.content +
      '\nResponse: ' + msg.response
      );
    }, 1);
  });
});


nebulaeTeamApp.controller('scoreboardController', function($scope, $http) {
  $http.get('/api/username').success(function(data, status, headers, config) {
    if (data.hasOwnProperty('username')) {
      $scope.username = data.username;
    }
  }).error(function(data, status, headers, config) {
    console.log('could not get team name');
  });
  socket.emit('getscore', $scope.username);

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

nebulaeTeamApp.controller('infoController', function($scope, $http) {
  socket.emit('get schools');
  socket.on('updateschools', function(msg) {
    $scope.schools = msg;
    $scope.$apply();
  });
});

nebulaeTeamApp.controller('teamController', function($scope, $http) {
  socket.on('updateinfo', function(info) {
    $scope.name = info.username;
    $scope.school = info.school;
    $scope.division = info.division;
    $scope.members = info.members;
    $scope.$apply();
  });
});