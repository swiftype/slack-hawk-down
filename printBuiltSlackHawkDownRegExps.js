var slackHawkDown = require('./dist/index.js');

var patterns = slackHawkDown.buildSlackHawkDownRegExps();

 for (var key in patterns) {      
     if (patterns.hasOwnProperty(key)) {
       console.log(`${key}: ${patterns[key].source}`);
     }
 }

console.log('Complete!')
