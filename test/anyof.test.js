'use strict'

const test = require('tap').test
const build = require('..')

test('object with multiple types field', (t) => {
  t.plan(2)

  const schema = {
    title: 'object with multiple types field',
    type: 'object',
    properties: {
      str: {
        anyOf: [{
          type: 'string'
        }, {
          type: 'boolean'
        }]
      }
    }
  }
  const stringify = build(schema)

  try {
    const value = stringify({
      str: 'string'
    })
    t.is(value, '{"str":"string"}')
  } catch (e) {
    t.fail()
  }

  try {
    const value = stringify({
      str: true
    })
    t.is(value, '{"str":true}')
  } catch (e) {
    t.fail()
  }
})

test('object with field of type object or null', (t) => {
  t.plan(2)

  const schema = {
    title: 'object with field of type object or null',
    type: 'object',
    properties: {
      prop: {
        anyOf: [{
          type: 'object',
          properties: {
            str: {
              type: 'string'
            }
          }
        }, {
          type: 'null'
        }]
      }
    }
  }
  const stringify = build(schema)

  try {
    const value = stringify({
      prop: null
    })
    t.is(value, '{"prop":null}')
  } catch (e) {
    t.fail()
  }

  try {
    const value = stringify({
      prop: {
        str: 'string'
      }
    })
    t.is(value, '{"prop":{"str":"string"}}')
  } catch (e) {
    t.fail()
  }
})

test('object with field of type object or array', (t) => {
  t.plan(2)

  const schema = {
    title: 'object with field of type object or array',
    type: 'object',
    properties: {
      prop: {
        anyOf: [{
          type: 'object',
          properties: {},
          additionalProperties: true
        }, {
          type: 'array',
          items: {
            type: 'string'
          }
        }]
      }
    }
  }
  const stringify = build(schema)

  try {
    const value = stringify({
      prop: {
        str: 'string'
      }
    })
    t.is(value, '{"prop":{"str":"string"}}')
  } catch (e) {
    t.fail()
  }

  try {
    const value = stringify({
      prop: ['string']
    })
    t.is(value, '{"prop":["string"]}')
  } catch (e) {
    t.fail()
  }
})

test('object with field of type string and coercion disable ', (t) => {
  t.plan(1)

  const schema = {
    title: 'object with field of type string',
    type: 'object',
    properties: {
      str: {
        anyOf: [{
          type: 'string'
        }]
      }
    }
  }
  const stringify = build(schema)

  try {
    const value = stringify({
      str: 1
    })
    t.is(value, '{"str":null}')
  } catch (e) {
    t.fail()
  }
})

test('object with field of type string and coercion enable ', (t) => {
  t.plan(1)

  const schema = {
    title: 'object with field of type string',
    type: 'object',
    properties: {
      str: {
        anyOf: [{
          type: 'string'
        }]
      }
    }
  }

  const options = {
    ajv: {
      coerceTypes: true
    }
  }
  const stringify = build(schema, options)

  try {
    const value = stringify({
      str: 1
    })
    t.is(value, '{"str":"1"}')
  } catch (e) {
    t.fail()
  }
})
