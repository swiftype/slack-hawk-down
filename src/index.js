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

const closingDivPatternString = '</div>'
const closingSpanPatternString = '</span>'
const codeDivOpeningPatternString = '<div class="slack_code">'
const codeSpanOpeningPatternString = '<span class="slack_code">'
const boldOpeningPatternString = '<span class="slack_bold">'
const strikethroughOpeningPatternString = '<span class="slack_strikethrough">'
const italicOpeningPatternString = '<span class="slack_italics">'
const blockDivOpeningPatternString = '<div class="slack_block">'
const blockSpanOpeningPatternString = '<span class="slack_block">'
const lineBreakTagLiteral = '<br>'
const newlineRegExp = XRegExp.cache('\\n', 'nsg')
const whitespaceRegExp = XRegExp.cache('\\s', 'ns')

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

const buildOpeningDelimiterRegExp = (delimiter, { spacePadded = false, escapeDelimiter = true } = {}) => {
  const escapedDelimiter = escapeDelimiter ? XRegExp.escape(delimiter) : delimiter
  return XRegExp.cache(
    `${spacePadded ? '(?<openingCapturedWhitespace>^|\\s)' : ''}${escapedDelimiter}`,
    'ns'
  )
}

// We can't perform negative lookahead to capture the last consecutive delimiter
// since delimiters can be more than once character long
const buildClosingDelimiterRegExp = (delimiter, { spacePadded = false, escapeDelimiter = true } = {}) => {
  const escapedDelimiter = escapeDelimiter ? XRegExp.escape(delimiter) : delimiter
  return XRegExp.cache(
    `${escapedDelimiter}${spacePadded ? '(?<closingCapturedWhitespace>\\s|$)' : ''}`,
    'ns'
  )
}

const replaceInWindows = (
  text,
  delimiterLiteral,
  replacementOpeningLiteral,
  replacementClosingLiteral,
  closedTagWindows,
  options = {},
  tagWindowIndex = 0,
  currentTagWindowOffset = 0
) => {
  if (tagWindowIndex >= closedTagWindows.length) {
    return [text, closedTagWindows]
  }

  const partitionWindowOnMatch = options.partitionWindowOnMatch
  const spacePadded = options.spacePadded
  const asymmetric = options.endingPattern
  const replaceNewlines = options.replaceNewlines

  const openingDelimiterRegExp = buildOpeningDelimiterRegExp(delimiterLiteral, { spacePadded })
  const closingDelimiterRegExp = asymmetric ? buildClosingDelimiterRegExp(options.endingPattern, { escapeDelimiter: false }) : buildClosingDelimiterRegExp(delimiterLiteral, { spacePadded })

  const currentClosedTagWindow = closedTagWindows[tagWindowIndex]
  const openingMatch = XRegExp.exec(text, openingDelimiterRegExp, currentClosedTagWindow[0] + currentTagWindowOffset)

  if (openingMatch && openingMatch.index < currentClosedTagWindow[1]) {
    const closingDelimiterLength = asymmetric ? 0 : delimiterLiteral.length
    const closingMatchMaxIndex = (tagWindowIndex === closedTagWindows.length - 1 ? currentClosedTagWindow[1] + 1 : currentClosedTagWindow[1]) - closingDelimiterLength + 1

    // Look ahead at the next index to greedily capture as much inside the delimiters as possible
    let closingMatch = XRegExp.exec(text, closingDelimiterRegExp, openingMatch.index + delimiterLiteral.length)
    let nextClosingMatch = closingMatch && XRegExp.exec(text, closingDelimiterRegExp, closingMatch.index + 1)
    while (nextClosingMatch) {
      // If the next match is still in the window and there is not whitespace in between the two, use the later one
      const nextWhitespace = XRegExp.exec(text, whitespaceRegExp, closingMatch.index + delimiterLiteral.length)
      const crossedWhitespace = nextWhitespace && nextWhitespace.index < closingMatchMaxIndex
      if (nextClosingMatch.index >= closingMatchMaxIndex || crossedWhitespace) {
        break
      }
      closingMatch = nextClosingMatch
      nextClosingMatch = XRegExp.exec(text, closingDelimiterRegExp, closingMatch.index + 1)
    }

    if (closingMatch && closingMatch.index < closingMatchMaxIndex) {
      const textBeforeWindow = text.slice(0, currentClosedTagWindow[0])
      const textAfterWindow = text.slice(currentClosedTagWindow[1])

      const openingReplacementString = `${spacePadded ? openingMatch.openingCapturedWhitespace : ''}${replacementOpeningLiteral}`
      const closingReplacementString = `${replacementClosingLiteral}${spacePadded ? closingMatch.closingCapturedWhitespace : ''}${asymmetric ? closingMatch[0] : ''}`

      const textBetweenDelimiters = text.slice(openingMatch.index + openingMatch[0].length, closingMatch.index)
      const replacedTextBetweenDelimiters = replaceNewlines ? XRegExp.replace(textBetweenDelimiters, newlineRegExp, lineBreakTagLiteral) : textBetweenDelimiters
      const replacedWindowText = [
        text.slice(currentClosedTagWindow[0], openingMatch.index),
        openingReplacementString,
        replacedTextBetweenDelimiters,
        closingReplacementString,
        text.slice(closingMatch.index + closingMatch[0].length)
      ].join('')

      const windowOffset = replacementOpeningLiteral.length + replacementClosingLiteral.length - (2 * delimiterLiteral.length) + replacedTextBetweenDelimiters.length - textBetweenDelimiters.length
      const newUpperWindowLimit = currentClosedTagWindow[1] + windowOffset

      const nextWindowIndex = partitionWindowOnMatch ? tagWindowIndex + 1 : tagWindowIndex
      const nextTagWindowOffset = partitionWindowOnMatch ? 0 : closingMatch.index + replacementClosingLiteral.length
      if (partitionWindowOnMatch) {
        // Split the current window into two by the occurrence of the delimiter pair
        currentClosedTagWindow[1] = openingMatch.index
        closedTagWindows.splice(tagWindowIndex + 1, 0, [closingMatch.index + replacementClosingLiteral.length, newUpperWindowLimit])
      }
      closedTagWindows.slice(nextWindowIndex + 1).forEach((tagWindow) => {
        tagWindow[0] += windowOffset
        tagWindow[1] += windowOffset
      })

      return replaceInWindows(
        [textBeforeWindow, replacedWindowText, textAfterWindow].join(''),
        delimiterLiteral,
        replacementOpeningLiteral,
        replacementClosingLiteral,
        closedTagWindows,
        options,
        nextWindowIndex,
        nextTagWindowOffset
      )
    }
  }

  return replaceInWindows(
    text,
    delimiterLiteral,
    replacementOpeningLiteral,
    replacementClosingLiteral,
    closedTagWindows,
    options,
    tagWindowIndex + 1
  )
}

const expandText = (text) => {
  let expandedTextAndWindows
  expandedTextAndWindows = [text, [[0, text.length]]]
  expandedTextAndWindows = replaceInWindows(expandedTextAndWindows[0], '```', codeDivOpeningPatternString, closingDivPatternString, expandedTextAndWindows[1], { partitionWindowOnMatch: true, replaceNewlines: true })
  expandedTextAndWindows = replaceInWindows(expandedTextAndWindows[0], '`', codeSpanOpeningPatternString, closingSpanPatternString, expandedTextAndWindows[1], { partitionWindowOnMatch: true })
  expandedTextAndWindows = replaceInWindows(expandedTextAndWindows[0], '*', boldOpeningPatternString, closingSpanPatternString, expandedTextAndWindows[1])
  expandedTextAndWindows = replaceInWindows(expandedTextAndWindows[0], '~', strikethroughOpeningPatternString, closingSpanPatternString, expandedTextAndWindows[1])
  expandedTextAndWindows = replaceInWindows(expandedTextAndWindows[0], '_', italicOpeningPatternString, closingSpanPatternString, expandedTextAndWindows[1], { spacePadded: true })
  expandedTextAndWindows = replaceInWindows(expandedTextAndWindows[0], '&gt;&gt;&gt;', blockDivOpeningPatternString, closingDivPatternString, expandedTextAndWindows[1], { endingPattern: '$', replaceNewlines: true })
  expandedTextAndWindows = replaceInWindows(expandedTextAndWindows[0], '&gt;', blockSpanOpeningPatternString, closingSpanPatternString, expandedTextAndWindows[1], { endingPattern: '\\n|$' })

  return expandedTextAndWindows[0]
}

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
    userMentionRegExp: userMentionRegExp,
    channelMentionRegExp: channelMentionRegExp,
    linkRegExp: linkRegExp,
    mailToRegExp: mailToRegExp,
    subteamCommandRegExp: subteamCommandRegExp,
    boldOpeningDelimiterRegExp: buildOpeningDelimiterRegExp('*'),
    boldClosingDelimiterRegExp: buildClosingDelimiterRegExp('*'),
    italicsOpeningDelimiterRegExp: buildOpeningDelimiterRegExp('_', { spacePadded: true }),
    italicsClosingDelimiterRegExp: buildClosingDelimiterRegExp('_', { spacePadded: true }),
    strikethroughOpeningDelimiterRegExp: buildOpeningDelimiterRegExp('~'),
    strikethroughClosingDelimiterRegExp: buildClosingDelimiterRegExp('~'),
    blockDivOpeningDelimiterRegExp: buildOpeningDelimiterRegExp('&gt;&gt;&gt;'),
    blockDivClosingDelimiterRegExp: buildClosingDelimiterRegExp('$', { escapeDelimiter: false }),
    blockSpanOpeningDelimiterRegExp: buildOpeningDelimiterRegExp('&gt;'),
    blockSpanClosingDelimiterRegExp: buildClosingDelimiterRegExp('\\n|$', { escapeDelimiter: false })
  }
}

module.exports = {
  escapeForSlack: escapeForSlack,
  escapeForSlackWithMarkdown: escapeForSlackWithMarkdown,
  buildSlackHawkDownRegExps: buildSlackHawkDownRegExps
}
