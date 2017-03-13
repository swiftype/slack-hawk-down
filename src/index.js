import 'babel-polyfill'
import XRegExp from 'xregexp'
import emoji from './emoji'

/* eslint-disable no-template-curly-in-string */

const expandEmoji = (text, customEmoji) => {
  const allEmoji = Object.assign({}, emoji, customEmoji)
  return text.replace(/:(\S+):/, ((match, originalKey) => {
    const aliasPattern = /alias:(\S+)/
    let key = originalKey
    let emojiValue

    for (;;) {
      emojiValue = allEmoji[key]
      if (!emojiValue || !emojiValue.match(aliasPattern)) {
        break
      }
      key = emojiValue.replace(aliasPattern, '$1')
    }

    if (key && emojiValue) {
      if (emojiValue.match(/https?:\/\/\S+/)) {
        return `<img alt=${originalKey} src=${emojiValue} class="slack_emoji" />`
      }
      return emojiValue.split('-').map((emojiCode) => (`&#x${emojiCode}`)).join('')
    }
    return originalKey
  }))
}

const excludingCharacterPatternString = (character) => (`(?<capturedMarkdown>[^${character}]+)`)
const closingDelimiterPatternString = '(?<previousDelimiter>^|\\s|[*_~>`]|`{3})'
const trailingClosingDelimiterPatternString = `${closingDelimiterPatternString}$`
const openingDelimiterLookaheadPatternString = '(?=($|\\s|[*_~<]|`{3}))'
// The XRegExp flag s allows . to also match whitespace and newline characters
const anythingPatternString = '.*?'
const codeSpanOpeningPatternString = '<span class="slack_code">'
const codeSpanClosingPatternString = '</span>'
const codeDivOpeningPatternString = '<div class="slack_code">'
const codeDivClosingPatternString = '</div>'
const closedCodeSpanPatternString = `${codeSpanOpeningPatternString}(?=(?<closingCodeSpan>${anythingPatternString}${codeSpanClosingPatternString}))\\k<closingCodeSpan>`
const closedCodeDivPatternString = `${codeDivOpeningPatternString}(?=(?<closingCodeDiv>${anythingPatternString}${codeDivClosingPatternString}))\\k<closingCodeDiv>`

// Use atomic capture groups and lazy quantifiers to prevent excessive backtracing
// To match a closed set of code block tags, the regex will walk forward after an opening tag until it finds
// a matching closing tag and will not allow backtracing beyond that point
const closedCodePatternString = `${closedCodeSpanPatternString}|${closedCodeDivPatternString}`
// Greedily capture as many code blocks as possible in this pattern
const anyClosedCodePatternString = `(${closedCodePatternString})*`
const atLeastOneCodePatternString = `(${closedCodePatternString})+?`
const codePatternCapturePatternString = `(?<capturedCodeBlocks>${anyClosedCodePatternString}(?<beforeMarkdown>${anythingPatternString}))`
const openCodePatternString = `${anyClosedCodePatternString}(?=(?<hangingCodeTag>${anythingPatternString}(${codeSpanOpeningPatternString}|${codeDivOpeningPatternString})))\\k<hangingCodeTag>`

// Anatomy of a slackdown regex
// (?<capturedCodeBlocks>)(?<beforeMarkdown>)(openingDelimiterGroup)(?<capturedMarkdown>)(closingDelimiterGroup)
//
// - `capturedCodeBlocks` is the greedy set of all <div|span class="slack_code"></div|span> elements
//   They do not have to be matching, but will normally be checked using `openCodePatternString` to check
//   if there is an unmatched opening code block when the delimiter occurs
// - `beforeMarkdown` is the captured set of all characters between the occurrence of any code blocks
//   and the opening delimiter being examined. This must be checked to ensure the delimiter is not in the
//   middle of a word. Keep in mind that being at the end of a closed code block is still a valid delimiter
//   location
// - `openingDelimiterGroup` contains the opening delimiter and option space padding that might occur between
//   the delimiter and beginning of the elements to wrapped in a markdown element
// - `capturedMarkdown` the elements to be wrapped in a markdown element
// - `closingDelimiterGroup` contains the optional space padding that might occur between `capturedMarkdown`
//    and the closing delimiter. This is checked with a lookahead group to verify the closing delimiter is
//    not in the middle of a word

// Explicitly only use named capture groups instead of indexed backreferences to improve performance
// and maintainability using the XRegExp flag n
const buildSlackdownPattern = (delimiter, spacePadded = false, excludingSelf = true) => {
  const escapedDelimiter = XRegExp.escape(delimiter)
  const spacePaddingPatternString = spacePadded ? '\\s*?' : ''
  const prefixDelimiterPatternString = `${escapedDelimiter}${spacePaddingPatternString}`
  const postfixDelimiterPatternString = `${spacePaddingPatternString}${escapedDelimiter}${openingDelimiterLookaheadPatternString}`
  const markdownCapturePatternString = excludingSelf ? excludingCharacterPatternString(escapedDelimiter) : '(?<capturedMarkdown>.*?)'
  return XRegExp(
    `${codePatternCapturePatternString}${prefixDelimiterPatternString}${markdownCapturePatternString}${postfixDelimiterPatternString}`,
    'nsg'
  )
}

const replaceFunctionForSlackdownPattern = (slackdownClass, slackdownEl = 'span') => ((match) => {
  if (XRegExp.test(match.capturedCodeBlocks, XRegExp(openCodePatternString)) ||
      XRegExp.test(match.capturedMarkdown, XRegExp(atLeastOneCodePatternString)) ||
      (match.beforeMarkdown.length && !XRegExp.test(match.beforeMarkdown, XRegExp(trailingClosingDelimiterPatternString)))) {
    return match.toString()
  }
  return `${match.capturedCodeBlocks}<${slackdownEl} class="${slackdownClass}">${match.capturedMarkdown}</${slackdownEl}>`
})

const codeDivRegexp = XRegExp(`${closingDelimiterPatternString}\`\`\`(?<capturedMarkdown>${anythingPatternString})\`\`\`${openingDelimiterLookaheadPatternString}`, 'nsg')
const codeSpanRegexp = buildSlackdownPattern('`')
const boldSpanRegexp = buildSlackdownPattern('*')
const strikeSpanRegexp = buildSlackdownPattern('~')
const italicSpanRegexp = buildSlackdownPattern('_', true, false)
const blockDivRegexp = XRegExp(`${codePatternCapturePatternString}(&gt;){3}(?<capturedMarkdown>${anythingPatternString})$`, 'nsg')
const blockSpanRegexp = XRegExp(`${codePatternCapturePatternString}&gt;\\s?(${excludingCharacterPatternString('\\n')}(\\n?))`, 'nsg')

const expandText = (text) => {
  return XRegExp.replaceEach(text, [
    [codeDivRegexp, '${previousDelimiter}<div class="slack_code">${capturedMarkdown}</div>'],
    [codeSpanRegexp, replaceFunctionForSlackdownPattern('slack_code')],
    [boldSpanRegexp, replaceFunctionForSlackdownPattern('slack_bold')],
    [strikeSpanRegexp, replaceFunctionForSlackdownPattern('slack_strikethrough')],
    [italicSpanRegexp, replaceFunctionForSlackdownPattern('slack_italics')],
    [blockDivRegexp, replaceFunctionForSlackdownPattern('slack_block', 'div')],
    [blockSpanRegexp, replaceFunctionForSlackdownPattern('slack_block')]
  ])
}

// https://api.slack.com/docs/message-formatting
const userMentionRegexp = XRegExp('<@(?<userID>U[^|>]+)(\\|(?<userName>[^>]+))?>', 'ng')
const linkRegexp = XRegExp('<(?<linkUrl>https?:[^|>]+)(\\|(?<linkHtml>[^>]+))?>', 'ng')
const mailToRegexp = XRegExp('<(?<mailTo>mailto:[^|>]+)(\\|(?<mailToName>[^>]+))?>', 'ng')
const commandRegexp = XRegExp('<!(?<commandLiteral>[^|>]+)(\\|(?<commandName>[^>]+))?>', 'ng')
const knownCommands = ['here', 'channel', 'group', 'everyone']

const replaceUserName = (users) => ((match) => {
  if (match.userName) {
    return (`@${match.userName}`)
  }
  const userName = match.userID && users && users[match.userID]
  if (userName) {
    return `@${userName}`
  }
  return match.toString()
})

const escapeForSlack = (text, customEmoji, users) => {
  return expandEmoji(
    XRegExp.replaceEach(text, [
      [userMentionRegexp, replaceUserName(users)],
      [linkRegexp, ((match) => (`<a href="${match.linkUrl}" target="_blank" rel="noopener noreferrer">${match.linkHtml || match.linkUrl}</a>`))],
      [mailToRegexp, ((match) => (`<a href="mailto:${match.mailTo}" target="_blank" rel="noopener noreferrer">${match.mailToName || match.mailTo}</a>`))],
      [commandRegexp, ((match) => {
        if (match.commandName) {
          return match.commandName
        } else if (knownCommands.includes(match.commandLiteral)) {
          return `@${match.commandLiteral}`
        }
        return match.commandLiteral
      })]
    ]),
    customEmoji
  )
}

const escapeForSlackWithMarkdown = (text, customEmoji, users) => {
  return escapeForSlack(expandText(text), emoji, users)
}

module.exports = {
  escapeForSlack: escapeForSlack,
  escapeForSlackWithMarkdown: escapeForSlackWithMarkdown
}
