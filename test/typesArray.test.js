'use strict'

const { describe } = require('node:test')
const { equal, throws } = require('node:assert')
const build = require('..')

describe('possibly nullable integer primitive alternative', (t) => {
  const schema = {
    title: 'simple object with multi-type nullable primitive',
    type: 'object',
    properties: {
      data: {
        type: ['integer']
      }
    }
  }

  const stringify = build(schema, { ajv: { allowUnionTypes: true } })

  const value = stringify({
    data: 4
  })
  equal(value, '{"data":4}')
})

describe('possibly nullable number primitive alternative', (t) => {
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
  equal(value, '{"data":4}')
})

describe('possibly nullable integer primitive alternative with null value', (t) => {
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
  equal(value, '{"data":0}')
})

describe('possibly nullable number primitive alternative with null value', (t) => {
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
  equal(value, '{"data":0}')
})

describe('possibly nullable number primitive alternative with null value', (t) => {
  const schema = {
    title: 'simple object with multi-type nullable primitive',
    type: 'object',
    properties: {
      data: {
        type: ['boolean']
      }
    }
  }

  const stringify = build(schema)

  const value = stringify({
    data: null
  })
  equal(value, '{"data":false}')
})

describe('nullable integer primitive', (t) => {
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
  equal(value, '{"data":4}')
})

describe('nullable number primitive', (t) => {
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
  equal(value, '{"data":4}')
})

describe('nullable primitive with null value', (t) => {
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
  equal(value, '{"data":null}')
})

describe('nullable number primitive with null value', (t) => {
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
  equal(value, '{"data":null}')
})

describe('possibly null object with multi-type property', (t) => {
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

  equal(stringify({
    objectOrNull: {
      stringOrNumber: 'string'
    }
  }), '{"objectOrNull":{"stringOrNumber":"string"}}')

  equal(stringify({
    objectOrNull: {
      stringOrNumber: 42
    }
  }), '{"objectOrNull":{"stringOrNumber":42}}')

  equal(stringify({
    objectOrNull: null
  }), '{"objectOrNull":null}')
})

describe('object with possibly null array of multiple types', (t) => {
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
    equal(value, '{"arrayOfStringsAndNumbers":null}')
  } catch (e) {
    console.log(e)
    t.fail()
  }

  try {
    const value = stringify({
      arrayOfStringsAndNumbers: ['string1', 'string2']
    })
    equal(value, '{"arrayOfStringsAndNumbers":["string1","string2"]}')
  } catch (e) {
    console.log(e)
    t.fail()
  }

  equal(stringify({
    arrayOfStringsAndNumbers: [42, 7]
  }), '{"arrayOfStringsAndNumbers":[42,7]}')

  equal(stringify({
    arrayOfStringsAndNumbers: ['string1', 42, 7, 'string2']
  }), '{"arrayOfStringsAndNumbers":["string1",42,7,"string2"]}')

  equal(stringify({
    arrayOfStringsAndNumbers: ['string1', null, 42, 7, 'string2', null]
  }), '{"arrayOfStringsAndNumbers":["string1",null,42,7,"string2",null]}')
})

describe('object with tuple of multiple types', (t) => {
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
    equal(value, '{"fixedTupleOfStringsAndNumbers":["string1",42,7]}')
  } catch (e) {
    console.log(e)
    t.fail()
  }

  try {
    const value = stringify({
      fixedTupleOfStringsAndNumbers: ['string1', 42, 'string2']
    })
    equal(value, '{"fixedTupleOfStringsAndNumbers":["string1",42,"string2"]}')
  } catch (e) {
    console.log(e)
    t.fail()
  }
})

describe('object with anyOf and multiple types', (t) => {
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
  const stringify = build(schema, { ajv: { allowUnionTypes: true } })

  try {
    const value = stringify({
      objectOrBoolean: { stringOrNumber: 'string' }
    })
    equal(value, '{"objectOrBoolean":{"stringOrNumber":"string"}}')
  } catch (e) {
    console.log(e)
    t.fail()
  }

  equal(stringify({
    objectOrBoolean: { stringOrNumber: 42 }
  }), '{"objectOrBoolean":{"stringOrNumber":42}}')

  equal(stringify({
    objectOrBoolean: true
  }), '{"objectOrBoolean":true}')
})

describe('string type array can handle dates', (t) => {
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
    dateObject: new Date('2018-04-21T07:52:31.017Z')
  })
  equal(value, '{"date":"2018-04-20T07:52:31.017Z","dateObject":"2018-04-21T07:52:31.017Z"}')
})

describe('object that is simultaneously a string and a json', (t) => {
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
  equal(valueStr, '{"simultaneously":"hello"}')

  const valueObj = stringify({ simultaneously: { foo: likeObjectId } })
  equal(valueObj, '{"simultaneously":{"foo":"hello"}}')
})

describe('object that is simultaneously a string and a json switched', (t) => {
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
  equal(valueStr, '{"simultaneously":{}}')

  const valueObj = stringify({ simultaneously: { foo: likeObjectId } })
  equal(valueObj, '{"simultaneously":{"foo":"hello"}}')
})

describe('class instance that is simultaneously a string and a json', (t) => {
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

  class Test {
    toString () { return 'hello' }
  }

  const likeObjectId = new Test()

  const stringify = build(schema)
  const valueStr = stringify({ simultaneously: likeObjectId })
  equal(valueStr, '{"simultaneously":"hello"}')

  const valueObj = stringify({ simultaneously: { foo: likeObjectId } })
  equal(valueObj, '{"simultaneously":{"foo":"hello"}}')
})

describe('should not throw an error when type is array and object is null, it should instead coerce to []', (t) => {
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
  const result = stringify({ arr: null })
  equal(result, JSON.stringify({ arr: [] }))
})

describe('should throw an error when type is array and object is not an array', (t) => {
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
  throws(() => stringify({ arr: { foo: 'hello' } }), new TypeError('The value of \'#/properties/arr\' does not match schema definition.'))
})

describe('should throw an error when type is array and object is not an array with external schema', (t) => {
  const schema = {
    type: 'object',
    properties: {
      arr: {
        $ref: 'arrayOfNumbers#/definitions/arr'
      }
    }
  }

  const externalSchema = {
    arrayOfNumbers: {
      definitions: {
        arr: {
          type: 'array',
          items: {
            type: 'number'
          }
        }
      }
    }
  }

  const stringify = build(schema, { schema: externalSchema })
  throws(() => stringify({ arr: { foo: 'hello' } }), new TypeError('The value of \'arrayOfNumbers#/definitions/arr\' does not match schema definition.'))
})

describe('throw an error if none of types matches', (t) => {
  const schema = {
    title: 'simple object with multi-type nullable primitive',
    type: 'object',
    properties: {
      data: {
        type: ['number', 'boolean']
      }
    }
  }

  const stringify = build(schema)
  throws(() => stringify({ data: 'string' }), 'The value "string" does not match schema definition.')
})
