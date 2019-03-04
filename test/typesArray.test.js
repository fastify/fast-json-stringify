'use strict'

const test = require('tap').test
const build = require('..')

test('possibly nullable integer primitive alternative', (t) => {
  t.plan(1)

  const schema = {
    title: 'simple object with multi-type nullable primitive',
    type: 'object',
    properties: {
      data: {
        type: ['integer']
      }
    }
  }

  const stringify = build(schema)

  try {
    const value = stringify({
      data: 4
    })
    t.is(value, '{"data":4}')
  } catch (e) {
    t.fail()
  }
})

test('possibly nullable number primitive alternative', (t) => {
  t.plan(1)

  const schema = {
    title: 'simple object with multi-type nullable primitive',
    type: 'object',
    properties: {
      data: {
        type: ['number']
      }
    }
  }

  const stringify = build(schema)

  try {
    const value = stringify({
      data: 4
    })
    t.is(value, '{"data":4}')
  } catch (e) {
    t.fail()
  }
})

test('possibly nullable integer primitive alternative with null value', (t) => {
  t.plan(1)

  const schema = {
    title: 'simple object with multi-type nullable primitive',
    type: 'object',
    properties: {
      data: {
        type: ['integer']
      }
    }
  }

  const stringify = build(schema)

  try {
    const value = stringify({
      data: null
    })
    t.is(value, '{"data":0}')
  } catch (e) {
    t.fail()
  }
})

test('possibly nullable number primitive alternative with null value', (t) => {
  t.plan(1)

  const schema = {
    title: 'simple object with multi-type nullable primitive',
    type: 'object',
    properties: {
      data: {
        type: ['number']
      }
    }
  }

  const stringify = build(schema)

  try {
    const value = stringify({
      data: null
    })
    t.is(value, '{"data":0}')
  } catch (e) {
    t.fail()
  }
})

test('nullable integer primitive', (t) => {
  t.plan(1)

  const schema = {
    title: 'simple object with nullable primitive',
    type: 'object',
    properties: {
      data: {
        type: ['integer', 'null']
      }
    }
  }

  const stringify = build(schema)

  try {
    const value = stringify({
      data: 4
    })
    t.is(value, '{"data":4}')
  } catch (e) {
    t.fail()
  }
})

test('nullable number primitive', (t) => {
  t.plan(1)

  const schema = {
    title: 'simple object with nullable primitive',
    type: 'object',
    properties: {
      data: {
        type: ['number', 'null']
      }
    }
  }

  const stringify = build(schema)

  try {
    const value = stringify({
      data: 4
    })
    t.is(value, '{"data":4}')
  } catch (e) {
    t.fail()
  }
})

test('nullable primitive with null value', (t) => {
  t.plan(1)

  const schema = {
    title: 'simple object with nullable primitive',
    type: 'object',
    properties: {
      data: {
        type: ['integer', 'null']
      }
    }
  }

  const stringify = build(schema)

  try {
    const value = stringify({
      data: null
    })
    t.is(value, '{"data":null}')
  } catch (e) {
    t.fail()
  }
})

test('nullable number primitive with null value', (t) => {
  t.plan(1)

  const schema = {
    title: 'simple object with nullable primitive',
    type: 'object',
    properties: {
      data: {
        type: ['number', 'null']
      }
    }
  }

  const stringify = build(schema)

  try {
    const value = stringify({
      data: null
    })
    t.is(value, '{"data":null}')
  } catch (e) {
    t.fail()
  }
})

test('possibly null object with multi-type property', (t) => {
  t.plan(3)

  const schema = {
    title: 'simple object with multi-type property',
    type: 'object',
    properties: {
      objectOrNull: {
        type: ['object', 'null'],
        properties: {
          stringOrNumber: {
            type: ['string', 'number']
          }
        }
      }
    }
  }
  const stringify = build(schema)

  try {
    const value = stringify({
      objectOrNull: {
        stringOrNumber: 'string'
      }
    })
    t.is(value, '{"objectOrNull":{"stringOrNumber":"string"}}')
  } catch (e) {
    t.fail()
  }

  try {
    const value = stringify({
      objectOrNull: {
        stringOrNumber: 42
      }
    })
    t.is(value, '{"objectOrNull":{"stringOrNumber":42}}')
  } catch (e) {
    t.fail()
  }
  try {
    const value = stringify({
      objectOrNull: null
    })
    t.is(value, '{"objectOrNull":null}')
  } catch (e) {
    t.fail()
  }
})

test('object with possibly null array of multiple types', (t) => {
  t.plan(5)

  const schema = {
    title: 'object with array of multiple types',
    type: 'object',
    properties: {
      arrayOfStringsAndNumbers: {
        type: ['array', 'null'],
        items: {
          type: ['string', 'number', 'null']
        }
      }
    }
  }
  const stringify = build(schema)

  try {
    const value = stringify({
      arrayOfStringsAndNumbers: null
    })
    t.is(value, '{"arrayOfStringsAndNumbers":null}')
  } catch (e) {
    console.log(e)
    t.fail()
  }

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
  try {
    const value = stringify({
      arrayOfStringsAndNumbers: ['string1', null, 42, 7, 'string2', null]
    })
    t.is(value, '{"arrayOfStringsAndNumbers":["string1",null,42,7,"string2",null]}')
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

test('string type array can handle dates', (t) => {
  t.plan(1)
  const schema = {
    type: 'object',
    properties: {
      date: { type: ['string'] }
    }
  }
  const stringify = build(schema)
  try {
    const value = stringify({
      date: new Date('2018-04-20T07:52:31.017Z')
    })
    t.is(value, '{"date":"2018-04-20T07:52:31.017Z"}')
  } catch (e) {
    t.fail()
  }
})
