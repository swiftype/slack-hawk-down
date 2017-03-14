import { escapeForSlack } from '../src/index.js'

describe('control sequences', () => {
  describe('user mentions', () => {
    it('should render the label', () => {
      escapeForSlack('<@U123|someone>').should.equal('@someone')
    })

    it('should render the user name if present', () => {
      escapeForSlack('<@U123>', { users: { U123: 'someone' } }).should.equal('@someone')
    })

    it('should render the original value if user name is not present', () => {
      escapeForSlack('<@U123>').should.equal('<@U123>')
    })
  })

  describe('channel mentions', () => {
    it('should render the label', () => {
      escapeForSlack('<#C123|channel>').should.equal('#channel')
    })

    it('should render the channel name if present', () => {
      escapeForSlack('<#C123>', { channels: { C123: 'channel' } }).should.equal('#channel')
    })

    it('should render the original value if the channel name is not present', () => {
      escapeForSlack('<#C123>').should.equal('<#C123>')
    })
  })

  describe('hyperlinks', () => {
    it('should render an anchor tag', () => {
      escapeForSlack('<https://swiftype.com>').should.equal('<a href="https://swiftype.com" target="_blank" rel="noopener noreferrer">https://swiftype.com</a>')
    })

    it('should render the label in the anchor tag if present', () => {
      escapeForSlack('<https://swiftype.com|Swiftype>').should.equal('<a href="https://swiftype.com" target="_blank" rel="noopener noreferrer">Swiftype</a>')
    })
  })

  describe('mail links', () => {
    it('should render a mailto tag', () => {
      escapeForSlack('<mailto:test@swiftype.com>').should.equal('<a href="mailto:test@swiftype.com" target="_blank" rel="noopener noreferrer">test@swiftype.com</a>')
    })

    it('should render the label in the anchor tag if present', () => {
      escapeForSlack('<mailto:test@swiftype.com|Test>').should.equal('<a href="mailto:test@swiftype.com" target="_blank" rel="noopener noreferrer">Test</a>')
    })
  })

  describe('commands', () => {
    describe('known commands', () => {
      ['here', 'channel', 'group', 'everyone'].map((command) => {
        it(`when @${command} should render as @${command}`, () => {
          escapeForSlack(`<!${command}>`).should.equal(`@${command}`)
        })

        it(`when @${command} should not render as the label`, () => {
          escapeForSlack(`<!${command}|something_else>`).should.not.equal('@something_else')
        })
      })

      describe('for the subteam command', () => {
        it('should render as a group link when the label is present', () => {
          escapeForSlack('<!subteam^S123|swiftype-eng>').should.equal('swiftype-eng')
        })

        it('should render the group name if present', () => {
          escapeForSlack('<!subteam^S123>', { usergroups: { S123: 'swiftype-eng' } }).should.equal('swiftype-eng')
        })

        it('should render the original value if the channel name is not present', () => {
          escapeForSlack('<!subteam^S123>').should.equal('<!subteam^S123>')
        })
      })
    })


    describe('unknown commands', () => {
      it('should render the label if present', () => {
        escapeForSlack('<!foo|bar>').should.equal('<bar>')
      })

      it('should render as the literal if present', () => {
        escapeForSlack('<!foo>').should.equal('<foo>')
      })
    })
  })
})
