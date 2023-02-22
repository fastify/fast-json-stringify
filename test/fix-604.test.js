'use strict'

const t = require('tap')
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

const render = fjs(schema)

try {
  render(input)
} catch (err) {
  t.equal(err.message, 'The value "phone" cannot be converted to a number.')
}
