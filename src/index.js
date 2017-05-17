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
        return `<img alt="${originalKey}" src="${emojiValue}" class="slack_emoji" />`
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

const openCodeRegExp = XRegExp.cache(openCodePatternString)
const atLeastOneCodeRegExp = XRegExp.cache(atLeastOneCodePatternString)
const trailingClosingDelimiterRegExp = XRegExp.cache(trailingClosingDelimiterPatternString)

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
  const markdownCapturePatternString = excludingSelf ? excludingCharacterPatternString(escapedDelimiter) : `(?<capturedMarkdown>${anythingPatternString})`
  return XRegExp.build(
    '{{codePatternCapturePattern}}{{prefixDelimiterPattern}}{{markdownCapturePattern}}{{postfixDelimiterPattern}}',
    {
      codePatternCapturePattern: codePatternCapturePatternString,
      prefixDelimiterPattern: prefixDelimiterPatternString,
      markdownCapturePattern: markdownCapturePatternString,
      postfixDelimiterPattern: postfixDelimiterPatternString
    },
    'nsg'
  )
}

const replaceFunctionForSlackdownPattern = (slackdownClass, slackdownEl = 'span') => ((match) => {
  if (XRegExp.test(match.capturedCodeBlocks, openCodeRegExp) ||
      XRegExp.test(match.capturedMarkdown, atLeastOneCodeRegExp) ||
      (match.beforeMarkdown.length && !XRegExp.test(match.beforeMarkdown, trailingClosingDelimiterRegExp))) {
    return match.toString()
  }
  return `${match.capturedCodeBlocks}<${slackdownEl} class="${slackdownClass}">${match.capturedMarkdown}</${slackdownEl}>`
})

const replaceNewlineFunction = (replaceFn) => ((match) => (
  replaceFn(Object.assign({}, match, { capturedMarkdown: match.capturedMarkdown && match.capturedMarkdown.replace('\n', '<br>') }))
))
const replaceFunctionForCodeDiv = (match) => {
  return `${match.previousDelimiter}<div class="slack_code">${match.capturedMarkdown}</div>`
}

const codeDivRegExp = XRegExp.cache(`${closingDelimiterPatternString}\`\`\`(?<capturedMarkdown>${anythingPatternString})\`\`\`${openingDelimiterLookaheadPatternString}`, 'nsg')
const codeSpanRegExp = buildSlackdownPattern('`')
const boldSpanRegExp = buildSlackdownPattern('*')
const strikeSpanRegExp = buildSlackdownPattern('~')
const italicSpanRegExp = buildSlackdownPattern('_', true, false)
const blockDivRegExp = XRegExp.cache(`${codePatternCapturePatternString}(&gt;){3}(?<capturedMarkdown>${anythingPatternString})$`, 'nsg')
const blockSpanRegExp = XRegExp.cache(`${codePatternCapturePatternString}&gt;\\s?(${excludingCharacterPatternString('\\n')}(\\n?))`, 'nsg')

const expandText = (text) => {
  return XRegExp.replaceEach(text, [
    [codeDivRegExp, replaceNewlineFunction(replaceFunctionForCodeDiv)],
    [codeSpanRegExp, replaceFunctionForSlackdownPattern('slack_code')],
    [boldSpanRegExp, replaceFunctionForSlackdownPattern('slack_bold')],
    [strikeSpanRegExp, replaceFunctionForSlackdownPattern('slack_strikethrough')],
    [italicSpanRegExp, replaceFunctionForSlackdownPattern('slack_italics')],
    [blockDivRegExp, replaceNewlineFunction(replaceFunctionForSlackdownPattern('slack_block', 'div'))],
    [blockSpanRegExp, replaceFunctionForSlackdownPattern('slack_block')]
  ])
}

// https://api.slack.com/docs/message-formatting
const userMentionRegExp = XRegExp.cache('<@(?<userID>U[^|>]+)(\\|(?<userName>[^>]+))?>', 'ng')
const channelMentionRegExp = XRegExp.cache('<#(?<channelID>C[^|>]+)(\\|(?<channelName>[^>]+))?>', 'ng')
const linkRegExp = XRegExp.cache('<(?<linkUrl>https?:[^|>]+)(\\|(?<linkHtml>[^>]+))?>', 'ng')
const mailToRegExp = XRegExp.cache('<mailto:(?<mailTo>[^|>]+)(\\|(?<mailToName>[^>]+))?>', 'ng')
const subteamCommandRegExp = XRegExp.cache('<!subteam\\^(?<subteamID>S[^|>]+)(\\|(?<subteamName>[^>]+))?>', 'ng')
const commandRegExp = XRegExp.cache('<!(?<commandLiteral>[^|>]+)(\\|(?<commandName>[^>]+))?>', 'ng')
const knownCommands = ['here', 'channel', 'group', 'everyone']

const replaceUserName = (users) => ((match) => {
  const userName = match.userName || (match.userID && users && users[match.userID])
  if (userName) {
    return (`@${userName}`)
  }
  return match.toString()
})

const replaceChannelName = (channels) => ((match) => {
  const channelName = match.channelName || (match.channelID && channels && channels[match.channelID])
  if (channelName) {
    return (`#${channelName}`)
  }
  return match.toString()
})

const replaceUserGroupName = (usergroups) => ((match) => {
  const userGroupName = match.subteamName || (match.subteamID && usergroups && usergroups[match.subteamID])
  if (userGroupName) {
    return `${userGroupName}`
  }
  return match.toString()
})

const escapeForSlack = (text, options = {}) => {
  const customEmoji = options.customEmoji || {}
  const users = options.users || {}
  const channels = options.channels || {}
  const usergroups = options.usergroups || {}
  const markdown = options.markdown || false

  const expandedText = markdown ? expandText(text || '') : text || ''
  return expandEmoji(
    XRegExp.replaceEach(expandedText, [
      [userMentionRegExp, replaceUserName(users)],
      [channelMentionRegExp, replaceChannelName(channels)],
      [linkRegExp, ((match) => (`<a href="${match.linkUrl}" target="_blank" rel="noopener noreferrer">${match.linkHtml || match.linkUrl}</a>`))],
      [mailToRegExp, ((match) => (`<a href="mailto:${match.mailTo}" target="_blank" rel="noopener noreferrer">${match.mailToName || match.mailTo}</a>`))],
      [subteamCommandRegExp, replaceUserGroupName(usergroups)],
      [commandRegExp, ((match) => {
        if (match.commandLiteral && match.commandLiteral.startsWith('subteam')) {
          return match.toString()
        } else if (knownCommands.includes(match.commandLiteral)) {
          return `@${match.commandLiteral}`
        } else if (match.commandName) {
          return `<${match.commandName}>`
        }
        return `<${match.commandLiteral}>`
      })]
    ]),
    customEmoji
  )
}

const escapeForSlackWithMarkdown = (text, options = {}) => {
  return escapeForSlack(text, Object.assign({}, options, { markdown: true }))
}

const buildSlackHawkDownRegExps = () => {
  return {
    openCodeRegExp: openCodeRegExp,
    atLeastOneCodeRegExp: atLeastOneCodeRegExp,
    trailingClosingDelimiterRegExp: trailingClosingDelimiterRegExp,
    codeDivRegExp: codeDivRegExp,
    codeSpanRegExp: codeSpanRegExp,
    boldSpanRegExp: boldSpanRegExp,
    strikeSpanRegExp: strikeSpanRegExp,
    italicSpanRegExp: italicSpanRegExp,
    blockDivRegExp: blockDivRegExp,
    blockSpanRegExp: blockSpanRegExp,
    userMentionRegExp: userMentionRegExp,
    channelMentionRegExp: channelMentionRegExp,
    linkRegExp: linkRegExp,
    mailToRegExp: mailToRegExp,
    subteamCommandRegExp: subteamCommandRegExp,
    commandRegExp: commandRegExp
  }
}

module.exports = {
  escapeForSlack: escapeForSlack,
  escapeForSlackWithMarkdown: escapeForSlackWithMarkdown,
  buildSlackHawkDownRegExps: buildSlackHawkDownRegExps
}
