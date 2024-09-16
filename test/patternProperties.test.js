'use strict'

const { describe } = require('node:test')
const { equal, throws } = require('node:assert')
const build = require('..')

describe('patternProperties', (t) => {
  const stringify = build({
    title: 'patternProperties',
    type: 'object',
    properties: {
      str: {
        type: 'string'
      }
    },
    patternProperties: {
      foo: {
        type: 'string'
      }
    }
  })

  const obj = { str: 'test', foo: 42, ofoo: true, foof: 'string', objfoo: { a: true }, notMe: false }
  equal(stringify(obj), '{"str":"test","foo":"42","ofoo":"true","foof":"string","objfoo":"[object Object]"}')
})

describe('patternProperties should not change properties', (t) => {
  const stringify = build({
    title: 'patternProperties should not change properties',
    type: 'object',
    properties: {
      foo: {
        type: 'string'
      }
    },
    patternProperties: {
      foo: {
        type: 'number'
      }
    }
  })

  const obj = { foo: '42', ofoo: 42 }
  equal(stringify(obj), '{"foo":"42","ofoo":42}')
})

describe('patternProperties - string coerce', (t) => {
  const stringify = build({
    title: 'check string coerce',
    type: 'object',
    properties: {},
    patternProperties: {
      foo: {
        type: 'string'
      }
    }
  })

  const obj = { foo: true, ofoo: 42, arrfoo: ['array', 'test'], objfoo: { a: 'world' } }
  equal(stringify(obj), '{"foo":"true","ofoo":"42","arrfoo":"array,test","objfoo":"[object Object]"}')
})

describe('patternProperties - number coerce', (t) => {
  const stringify = build({
    title: 'check number coerce',
    type: 'object',
    properties: {},
    patternProperties: {
      foo: {
        type: 'number'
      }
    }
  })

  const coercibleValues = { foo: true, ofoo: '42' }
  equal(stringify(coercibleValues), '{"foo":1,"ofoo":42}')

  const incoercibleValues = { xfoo: 'string', arrfoo: [1, 2], objfoo: { num: 42 } }
  throws(() => stringify(incoercibleValues))
})

describe('patternProperties - boolean coerce', (t) => {
  const stringify = build({
    title: 'check boolean coerce',
    type: 'object',
    properties: {},
    patternProperties: {
      foo: {
        type: 'boolean'
      }
    }
  })

  const obj = { foo: 'true', ofoo: 0, arrfoo: [1, 2], objfoo: { a: true } }
  equal(stringify(obj), '{"foo":true,"ofoo":false,"arrfoo":true,"objfoo":true}')
})

describe('patternProperties - object coerce', (t) => {
  const stringify = build({
    title: 'check object coerce',
    type: 'object',
    properties: {},
    patternProperties: {
      foo: {
        type: 'object',
        properties: {
          answer: {
            type: 'number'
          }
        }
      }
    }
  })

  const obj = { objfoo: { answer: 42 } }
  equal(stringify(obj), '{"objfoo":{"answer":42}}')
})

describe('patternProperties - array coerce', (t) => {
  const stringify = build({
    title: 'check array coerce',
    type: 'object',
    properties: {},
    patternProperties: {
      foo: {
        type: 'array',
        items: {
          type: 'string'
        }
      }
    }
  })

  const coercibleValues = { arrfoo: [1, 2] }
  equal(stringify(coercibleValues), '{"arrfoo":["1","2"]}')

  const incoercibleValues = { foo: 'true', ofoo: 0, objfoo: { tyrion: 'lannister' } }
  throws(() => stringify(incoercibleValues))
})

describe('patternProperties - fail on invalid regex, handled by ajv', (t) => {
  throws(() => build({
    title: 'check array coerce',
    type: 'object',
    properties: {},
    patternProperties: {
      'foo/\\': {
        type: 'array',
        items: {
          type: 'string'
        }
      }
    }
  }), new Error('schema is invalid: data/patternProperties must match format "regex"'))
})
