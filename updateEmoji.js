var rawEmoji = require('./config/emoji_pretty.json');
var fs = require('fs')

var EMOJI_PATH = 'dist/emoji.js';

process.stdout.write('Processing raw emoji list...');
var condensedEmoji = rawEmoji.reduce(function(accumulator, emoji) {
  accumulator[emoji.short_name] = emoji.unified
  return accumulator
}, {});

fs.writeFileSync(EMOJI_PATH, `module.exports = ${JSON.stringify(condensedEmoji)}`, 'utf8');
console.log('Complete!');
