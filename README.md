#Nebulae
Nebulae is a local network online judge for Java programming competitions, designed for UIL style Computer Science contests, built on Express, MongoDB and Mongoose, Socket.IO, and AngularJS.

With Nebulae, competition organizers can easily batch create teams, create problems, input written test scores, answer clarification questions, and respond to appeals. Once logged in, users are able to submit Java source code files to be compiled and checked against an expected output. Teams can also ask clarification questions, and view their own standings on the scoreboard.

##Requirements
Nebulae requires a valid JDK installed, node.js and npm, MongoDB, and Bower installed. Nebulae has been tested to run on Windows and Mac OS X. For teams, Nebulae has been tested to work on Internet Explorer 11, Google Chrome 46, and Mozilla Firefox 41.

##Installation
1. `git clone https://github.com/chufanl/nebulae.git`
2. `npm install`
3. `bower install`
4. Edit contest name, cookie secret, and JDK path settings in `config.js`

##Usage
###Administrators and Contest Organizers
Nebulae can be started by running `npm start`. On first startup, Nebulae will initialize a new contest with a single sample problem and a default admin user with username `admin` and password `admin`. Once logged in, organizers can use the Accounts and Problems to add team accounts and add problems. The contest can be started and stopped using the controls on the top menubar, and the duration of the contest can also be adjusted. During the contest, organizers can answer question by clicking on it in the Overview tab; unanswered clarification questions will be highlighted in yellow. Written test scores for each team member can be inputted through the Written tab. Once the contest has stopped, organizers can use the Appeals tab to search for specific runs and change the ruling, if necessary. Final standings can be found in the Scoreboard tab for teams and the Written tab for individual written scores.

###Teams
Teams can log in with credentials provided by the competition organizers. When logging in for the first time, teams will be prompted for member names, division, and school name.

Runs can only be submitted during the contest; a timer will indicate the status of the contest in the upper left corner. Source code can be submitted through the Runs tab by selecting a problem and uploading a file. When a file is submitted, a confirmation will appear, notifying the user that the file has been recieved and will be judged. When a verdict has arrived for the program, another notification will appear showing the judge ruling.

Teams can also submit clarification questions through the Clarifications tab by selecting a problem and typing a question. When the questions has been answered by the organizers, a notification will appear showing the organizer's answer to the question. In addition, previous questions and answers will be shown in a table.

##Todo
* Allow teams to change their information
* Editing problem details
* Rejudging runs automatically
* Programmatically release sample data
