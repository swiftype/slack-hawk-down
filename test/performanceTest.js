import fs from 'fs'
import path from 'path'
import { escapeForSlackWithMarkdown } from '../src/index.js'

describe('performance', () => {
  describe('negative matching', () => {
    const input = fs.readFileSync(path.join(__dirname, 'fixtures/long_negative_input.txt'))

    it('should perform around the baseline', () => {
      console.time('long_negative_input_baseline')
      RegExp('/b/').exec(input)
      console.timeEnd('long_negative_input_baseline')
    })

    it('should scan through a long input', () => {
      console.time('long_negative_input_match')
      escapeForSlackWithMarkdown(input)
      console.timeEnd('long_negative_input_match')
    })
  })

  describe('many Slack div|span blocks', () => {
    const input = fs.readFileSync(path.join(__dirname, 'fixtures/long_positive_input.txt'))
    it ('should perform near the baseline', () => {
      console.time('long_positive_input_baseline')
      RegExp('/b/').exec(input)
      console.timeEnd('long_positive_input_baseline')
    })

    it('should scan through a long input', () => {
      console.time('long_positive_input_match')
      escapeForSlackWithMarkdown(input)
      console.timeEnd('long_positive_input_match')
    })
  })

  describe('many replacements', () => {
    const input = fs.readFileSync(path.join(__dirname, 'fixtures/long_repetitive_block_quotes.txt'))
    
    it('should not run out of memory', () => {
      escapeForSlackWithMarkdown(input)
    })
  })
})
