import 'babel-polyfill'
import { escapeForSlackWithMarkdown } from '../src/index.js'

const customEmoji = {}
const users = {}

describe('markdown', () => {
  describe('code multiline', () => {
    it('should render an element', () => {
      escapeForSlackWithMarkdown('```this is a code multiline```', customEmoji, users).should.equal('<div class="slack_code">this is a code multiline</div>')
    })
  })

  describe('code inline', () => {
    it('should render an element', () => {
      escapeForSlackWithMarkdown('`this is a code inline`').should.equal('<span class="slack_code">this is a code inline</span>')
    })
  })

  describe('bold', () => {
    it('should render an element', () => {
      escapeForSlackWithMarkdown('this is *bold*').should.equal('this is <span class="slack_bold">bold</span>')
    })
  })

  describe('italic', () => {
    it('should render an element', () => {
      escapeForSlackWithMarkdown('this is _italic_').should.equal('this is <span class="slack_italics">italic</span>')
    })
  })

  describe('strikethrough', () => {
    it('should render an element', () => {
      escapeForSlackWithMarkdown('this is ~struck~').should.equal('this is <span class="slack_strikethrough">struck</span>')
    })
  })

  describe('block quote', () => {
    it('should render an element', () => {
      escapeForSlackWithMarkdown('&gt;&gt;&gt;this is a block quote').should.equal('<div class="slack_block">this is a block quote</div>')
    })
  })

  describe('inline quote', () => {
    it('should render an element', () => {
      escapeForSlackWithMarkdown('this is an &gt;inline quote').should.equal('this is an <span class="slack_block">inline quote</span>')
    })
  })
})
