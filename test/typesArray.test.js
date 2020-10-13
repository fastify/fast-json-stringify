'use strict'

const test = require('tap').test
const moment = require('moment')
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

  const value = stringify({
    data: 4
  })
  t.is(value, '{"data":4}')
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

  const value = stringify({
    data: 4
  })
  t.is(value, '{"data":4}')
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

  const value = stringify({
    data: null
  })
  t.is(value, '{"data":0}')
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

  const value = stringify({
    data: null
  })
  t.is(value, '{"data":0}')
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

  const value = stringify({
    data: 4
  })
  t.is(value, '{"data":4}')
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

  const value = stringify({
    data: 4
  })
  t.is(value, '{"data":4}')
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

  const value = stringify({
    data: null
  })
  t.is(value, '{"data":null}')
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

  const value = stringify({
    data: null
  })
  t.is(value, '{"data":null}')
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

  t.is(stringify({
    objectOrNull: {
      stringOrNumber: 'string'
    }
  }), '{"objectOrNull":{"stringOrNumber":"string"}}')

  t.is(stringify({
    objectOrNull: {
      stringOrNumber: 42
    }
  }), '{"objectOrNull":{"stringOrNumber":42}}')

  t.is(stringify({
    objectOrNull: null
  }), '{"objectOrNull":null}')
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

  t.is(stringify({
    arrayOfStringsAndNumbers: [42, 7]
  }), '{"arrayOfStringsAndNumbers":[42,7]}')

  t.is(stringify({
    arrayOfStringsAndNumbers: ['string1', 42, 7, 'string2']
  }), '{"arrayOfStringsAndNumbers":["string1",42,7,"string2"]}')

  t.is(stringify({
    arrayOfStringsAndNumbers: ['string1', null, 42, 7, 'string2', null]
  }), '{"arrayOfStringsAndNumbers":["string1",null,42,7,"string2",null]}')
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

  t.is(stringify({
    objectOrBoolean: { stringOrNumber: 42 }
  }), '{"objectOrBoolean":{"stringOrNumber":42}}')

  t.is(stringify({
    objectOrBoolean: true
  }), '{"objectOrBoolean":true}')
})

test('string type array can handle dates', (t) => {
  t.plan(1)
  const schema = {
    type: 'object',
    properties: {
      date: { type: ['string'] },
      dateObject: { type: ['string'], format: 'date-time' }
    }
  }
  const stringify = build(schema)
  const value = stringify({
    date: new Date('2018-04-20T07:52:31.017Z'),
    dateObject: moment('2018-04-21T07:52:31.017Z')
  })
  t.is(value, '{"date":"2018-04-20T07:52:31.017Z","dateObject":"2018-04-21T07:52:31.017Z"}')
})

test('object that is simultaneously a string and a json', (t) => {
  t.plan(2)
  const schema = {
    type: 'object',
    properties: {
      simultaneously: {
        type: ['string', 'object'],
        properties: {
          foo: { type: 'string' }
        }
      }
    }
  }

  const likeObjectId = {
    toString () { return 'hello' }
  }

  const stringify = build(schema)
  const valueStr = stringify({ simultaneously: likeObjectId })
  t.is(valueStr, '{"simultaneously":"hello"}')

  const valueObj = stringify({ simultaneously: { foo: likeObjectId } })
  t.is(valueObj, '{"simultaneously":{"foo":"hello"}}')
})

test('object that is simultaneously a string and a json switched', (t) => {
  t.plan(2)
  const schema = {
    type: 'object',
    properties: {
      simultaneously: {
        type: ['object', 'string'],
        properties: {
          foo: { type: 'string' }
        }
      }
    }
  }

  const likeObjectId = {
    toString () { return 'hello' }
  }

  const stringify = build(schema)
  const valueStr = stringify({ simultaneously: likeObjectId })
  t.is(valueStr, '{"simultaneously":{}}')

  const valueObj = stringify({ simultaneously: { foo: likeObjectId } })
  t.is(valueObj, '{"simultaneously":{"foo":"hello"}}')
})

test('should throw an error when type is array and object is null', (t) => {
  t.plan(1)
  const schema = {
    type: 'object',
    properties: {
      arr: {
        type: 'array',
        items: {
          type: 'number'
        }
      }
    }
  }

  const stringify = build(schema)
  t.throws(() => stringify({ arr: null }), new TypeError('Property \'arr\' should be of type array, received \'null\' instead.'))
})
