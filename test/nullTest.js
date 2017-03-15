import { escapeForSlack } from '../src/index.js'

describe('bad input', () => {
  [null, '', undefined].map((badInput) => {
    it(`when the input is \`${badInput}\` should return an empty string`, () => {
      escapeForSlack(badInput).should.equal('')
    })
  })
})
