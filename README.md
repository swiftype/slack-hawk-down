# <img src="slack_hawk_down.png" width="100px" /> Slack Hawk Down

Slack-flavored markdown as HTML

## Installation
```
npm install --save slack-hawk-down
```

## Usage

```
import { escapeForSlack, escapeForSlackWithMarkdown } from 'slack-hawk-down'

escapeForSlack(':wave:') // => '&#1168;'
escapeForSlackWithMarkdown('`this is a code block`) // => '<span class="slack_code">this is a code block</span>'
```

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
