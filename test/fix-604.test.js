'use strict'

const { describe } = require('node:test')
const { throws } = require('node:assert')
const fjs = require('..')
const schema = {
  type: 'object',
  properties: {
    fullName: { type: 'string' },
    phone: { type: 'number' }
  }
}

const input = {
  fullName: 'Jone',
  phone: 'phone'
}

describe('fix #604', () => {
  const render = fjs(schema)

  throws(() => {
    render(input)
  }, {
    message: 'The value "phone" cannot be converted to a number.'
  })
})
