'use strict'

const { describe } = require('node:test')
const { throws } = require('node:assert')
const build = require('..')

describe('required property containing single quote, contains property', (t) => {
  const stringify = build({
    type: 'object',
    properties: {
      '\'': { type: 'string' }
    },
    required: [
      '\''
    ]
  })

  throws(() => stringify({}), new Error('"\'" is required!'))
})

describe('required property containing double quote, contains property', (t) => {
  const stringify = build({
    type: 'object',
    properties: {
      '"': { type: 'string' }
    },
    required: [
      '"'
    ]
  })

  throws(() => stringify({}), new Error('""" is required!'))
})

describe('required property containing single quote, does not contain property', (t) => {
  const stringify = build({
    type: 'object',
    properties: {
      a: { type: 'string' }
    },
    required: [
      '\''
    ]
  })

  throws(() => stringify({}), new Error('"\'" is required!'))
})

describe('required property containing double quote, does not contain property', (t) => {
  const stringify = build({
    type: 'object',
    properties: {
      a: { type: 'string' }
    },
    required: [
      '"'
    ]
  })

  throws(() => stringify({}), new Error('""" is required!'))
})
