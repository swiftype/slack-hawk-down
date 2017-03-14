# <img src="slack_hawk_down.png" width="100px" /> Slack Hawk Down

Slack-flavored markdown as HTML

## Installation
```
npm install --save slack-hawk-down
```

## Usage

### Render universal Slack markdown as HTML
```
import { escapeForSlack, escapeForSlackWithMarkdown } from 'slack-hawk-down'

escapeForSlack(':wave:') // => '&#1168;'
escapeForSlackWithMarkdown('`this is a code block`) // => '<span class="slack_code">this is a code block</span>'
```

You can view the rest of the markdown styles [here](https://get.slack.help/hc/en-us/articles/202288908-Format-your-messages)

### Replace Slack user IDs with user names

```
escapeForSlack('<@U123|david> did you see my pull request?', { users: { 'U123': 'david', ... } }) // => '@david did you see my pull request?'
```
You can get a list of the users in your Slack team by requesting [this endpoint](https://api.slack.com/methods/users.list) with a `users:read` scope

### Replace Slack channel IDs with channel names

```
escapeForSlack('<#C123> please fill out this poll', { channels : { '#C123': 'general', ... } }) // => '#general please fill out this poll'
```
You can get a list of the users in your Slack team by requesting [this endpoint](https://api.slack.com/methods/channels.list) with a `channels:read` scope

### Replace Custom Slack emojis

```
escapeForSlack(':facepalm:', { customEmoji: { facepalm: 'http://emojis.slackmojis.com/emojis/images/1450319441/51/facepalm.png', ... } }) // => '<img alt="facepalm" src="http://emojis.slackmojis.com/emojis/images/1450319441/51/facepalm.png" />'
```
You can get a list of custom emoji for your Slack team by requesting [this endpoint](https://api.slack.com/methods/emoji.list) with a `emoji:read` scope

### Replace subteam names (for paid accounts)
```
escapeForSlack('<!subteam^S123>', { usergroups: { 'S123': 'swiftype-eng', ...} }) // => 'swiftype-eng'
```
You can get a list of user groups for your Slack team by requesting [this endpoint](https://api.slack.com/methods/usergroups.list) with a `usergroups:read` scope

## Testing

```
npm test
```

## Upcoming
- Customizeable element and class names for markdown elements

## Contribution
Please open a pull request or issue

## License
MIT
