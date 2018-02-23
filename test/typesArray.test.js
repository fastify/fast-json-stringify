'use strict'

const test = require('tap').test
const build = require('..')

test('simple object with multi-type property', (t) => {
  t.plan(2)

  const schema = {
    title: 'simple object with multi-type property',
    type: 'object',
    properties: {
      stringOrNumber: {
        type: ['string', 'number']
      }
    }
  }
  const stringify = build(schema)

  try {
    const value = stringify({
      stringOrNumber: 'string'
    })
    t.is(value, '{"stringOrNumber":"string"}')
  } catch (e) {
    t.fail()
  }

  try {
    const value = stringify({
      stringOrNumber: 42
    })
    t.is(value, '{"stringOrNumber":42}')
  } catch (e) {
    t.fail()
  }
})

test('object with array of multiple types', (t) => {
  t.plan(3)

  const schema = {
    title: 'object with array of multiple types',
    type: 'object',
    properties: {
      arrayOfStringsAndNumbers: {
        type: 'array',
        items: {
          type: ['string', 'number']
        }
      }
    }
  }
  const stringify = build(schema)

  try {
    const value = stringify({
      arrayOfStringsAndNumbers: ['string1', 'string2']
    })
    t.is(value, '{"arrayOfStringsAndNumbers":["string1","string2"]}')
  } catch (e) {
    console.log(e)
    t.fail()
  }

  try {
    const value = stringify({
      arrayOfStringsAndNumbers: [42, 7]
    })
    t.is(value, '{"arrayOfStringsAndNumbers":[42,7]}')
  } catch (e) {
    t.fail()
  }

  try {
    const value = stringify({
      arrayOfStringsAndNumbers: ['string1', 42, 7, 'string2']
    })
    t.is(value, '{"arrayOfStringsAndNumbers":["string1",42,7,"string2"]}')
  } catch (e) {
    t.fail()
  }
})

test('object with tuple of multiple types', (t) => {
  t.plan(2)

  const schema = {
    title: 'object with array of multiple types',
    type: 'object',
    properties: {
      fixedTupleOfStringsAndNumbers: {
        type: 'array',
        items: [
          {
            type: 'string'
          },
          {
            type: 'number'
          },
          {
            type: ['string', 'number']
          }
        ]
      }
    }
  }
  const stringify = build(schema)

  try {
    const value = stringify({
      fixedTupleOfStringsAndNumbers: ['string1', 42, 7]
    })
    t.is(value, '{"fixedTupleOfStringsAndNumbers":["string1",42,7]}')
  } catch (e) {
    console.log(e)
    t.fail()
  }

  try {
    const value = stringify({
      fixedTupleOfStringsAndNumbers: ['string1', 42, 'string2']
    })
    t.is(value, '{"fixedTupleOfStringsAndNumbers":["string1",42,"string2"]}')
  } catch (e) {
    console.log(e)
    t.fail()
  }
})

test('object with anyOf and multiple types', (t) => {
  t.plan(3)

  const schema = {
    title: 'object with anyOf and multiple types',
    type: 'object',
    properties: {
      objectOrBoolean: {
        anyOf: [
          {
            type: 'object',
            properties: {
              stringOrNumber: {
                type: ['string', 'number']
              }
            }
          },
          {
            type: 'boolean'
          }
        ]
      }
    }
  }
  const stringify = build(schema)

  try {
    const value = stringify({
      objectOrBoolean: { stringOrNumber: 'string' }
    })
    t.is(value, '{"objectOrBoolean":{"stringOrNumber":"string"}}')
  } catch (e) {
    console.log(e)
    t.fail()
  }

  try {
    const value = stringify({
      objectOrBoolean: { stringOrNumber: 42 }
    })
    t.is(value, '{"objectOrBoolean":{"stringOrNumber":42}}')
  } catch (e) {
    t.fail()
  }

  try {
    const value = stringify({
      objectOrBoolean: true
    })
    t.is(value, '{"objectOrBoolean":true}')
  } catch (e) {
    t.fail()
  }
})
