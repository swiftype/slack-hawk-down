# Slack Hawk Down
Slack-flavored markdown as HTML

## Installation
```
npm install --save slack-hawk-down
```

## Usage

```javascript
import { escapeForSlack, escapeForSlackWithMarkdown } from 'slack-hawk-down'

escapeForSlack(':wave:') // => '&#1168;'
escapeForSlackWithMarkdown('`this is a code block`) // => '<span class="slack_code">this is a code block</span>'
```

## Upcoming
- Customizeable element and class names for markdown elements
- Consolidate functions into one function with a default option
- Tests

## Contribution
Please open a pull request or issue

## License
MIT
