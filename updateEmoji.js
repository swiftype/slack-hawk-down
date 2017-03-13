var rawEmoji = require('./config/emoji_pretty.json');
var fs = require('fs')

var EMOJI_PATHS = ['dist/emoji.js', 'src/emoji.js'];

process.stdout.write('Processing raw emoji list...');
var condensedEmoji = rawEmoji.reduce(function(accumulator, emoji) {
  accumulator[emoji.short_name] = emoji.unified
  return accumulator
}, {});

for (var i in EMOJI_PATHS) {
  fs.writeFileSync(EMOJI_PATHS[i], `module.exports = ${JSON.stringify(condensedEmoji)}`, 'utf8');
}
console.log('Complete!');
