'use strict'

const test = require('tap').test
const build = require('..')

const data4 = {
  data: { toJSON () { return 4 } }
}
const dataNull = {
  data: { toJSON () { return null } }
}
const oNull = { toJSON () { return null } }
const oTrue = { toJSON () { return true } }
const oString1 = { toJSON () { return 'string1' } }
const oString2 = { toJSON () { return 'string2' } }
const oNumber42 = { toJSON () { return 42 } }
const oNumber7 = { toJSON () { return 7 } }

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

  const stringify = build(schema, { ajv: { allowUnionTypes: true } })

  t.equal(stringify(data4), '{"data":4}')
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

  t.equal(stringify(data4), '{"data":4}')
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

  const value = stringify(dataNull)
  t.equal(value, '{"data":0}')
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

  const value = stringify(dataNull)
  t.equal(value, '{"data":0}')
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

  const value = stringify(data4)
  t.equal(value, '{"data":4}')
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

  const value = stringify(data4)
  t.equal(value, '{"data":4}')
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

  const value = stringify(dataNull)
  t.equal(value, '{"data":null}')
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

  const value = stringify(dataNull)
  t.equal(value, '{"data":null}')
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

  t.equal(stringify({ objectOrNull: { toJSON () { return { stringOrNumber: oString1 } } } }), '{"objectOrNull":{"stringOrNumber":"string1"}}')

  t.equal(stringify({ objectOrNull: { toJSON () { return { stringOrNumber: oNumber42 } } } }), '{"objectOrNull":{"stringOrNumber":42}}')

  t.equal(stringify({ objectOrNull: oNull }), '{"objectOrNull":null}')
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

  const arrayStringsAndNumberString = {
    arrayOfStringsAndNumbers: { toJSON () { return [oString1, oString2] } }
  }
  const arrayStringsAndNumberNumber = {
    arrayOfStringsAndNumbers: { toJSON () { return [oNumber42, oNumber7] } }
  }
  const arrayStringsAndNumberMixed = {
    arrayOfStringsAndNumbers: { toJSON () { return [oString1, oNumber42, oNumber7, oString2] } }
  }
  const arrayStringsAndNumberMixedNull = {
    arrayOfStringsAndNumbers: { toJSON () { return [oString1, oNull, oNumber42, oNumber7, oString2, oNull] } }
  }

  try {
    const value = stringify({ arrayOfStringsAndNumbers: oNull })
    t.equal(value, '{"arrayOfStringsAndNumbers":null}')
  } catch (e) {
    console.log(e)
    t.fail()
  }

  try {
    const value = stringify(arrayStringsAndNumberString)
    t.equal(value, '{"arrayOfStringsAndNumbers":["string1","string2"]}')
  } catch (e) {
    console.log(e)
    t.fail()
  }

  t.equal(stringify(arrayStringsAndNumberNumber), '{"arrayOfStringsAndNumbers":[42,7]}')

  t.equal(stringify(arrayStringsAndNumberMixed), '{"arrayOfStringsAndNumbers":["string1",42,7,"string2"]}')

  t.equal(stringify(arrayStringsAndNumberMixedNull), '{"arrayOfStringsAndNumbers":["string1",null,42,7,"string2",null]}')
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
      fixedTupleOfStringsAndNumbers: { toJSON () { return [oString1, oNumber42, oNumber7] } }
    })
    t.equal(value, '{"fixedTupleOfStringsAndNumbers":["string1",42,7]}')
  } catch (e) {
    console.log(e)
    t.fail()
  }

  try {
    // const value = stringify({
    //   fixedTupleOfStringsAndNumbers: { toJSON () { return [ oString1, oNumber42, oString2 ] } }
    // })
    const value = JSON.stringify({
      fixedTupleOfStringsAndNumbers: { toJSON () { return [oString1, oNumber42, oString2] } }
    })
    t.equal(value, '{"fixedTupleOfStringsAndNumbers":["string1",42,"string2"]}')
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
  const stringify = build(schema, { ajv: { allowUnionTypes: true } })

  try {
    const value = stringify({
      objectOrBoolean: { toJSON () { return { stringOrNumber: oString1 } } }
    })
    t.equal(value, '{"objectOrBoolean":{"stringOrNumber":"string1"}}')
  } catch (e) {
    console.log(e)
    t.fail()
  }

  t.equal(stringify({
    objectOrBoolean: { toJSON () { return { stringOrNumber: oNumber42 } } }
  }), '{"objectOrBoolean":{"stringOrNumber":42}}')

  t.equal(stringify({ objectOrBoolean: oTrue }), '{"objectOrBoolean":true}')
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
  const valueStr = stringify({ simultaneously: { toJSON () { return likeObjectId } } })
  t.equal(valueStr, '{"simultaneously":"hello"}')

  const valueObj = stringify({ simultaneously: { toJSON () { return { foo: likeObjectId } } } })
  t.equal(valueObj, '{"simultaneously":{"foo":"hello"}}')
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
  const valueStr = stringify({ simultaneously: { toJSON () { return likeObjectId } } })
  t.equal(valueStr, '{"simultaneously":{}}')

  const valueObj = stringify({ simultaneously: { toJSON () { return { foo: likeObjectId } } } })
  t.equal(valueObj, '{"simultaneously":{"foo":"hello"}}')
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
  t.throws(() => stringify({ arr: oNull }), new TypeError('Property \'arr\' should be of type array, received \'null\' instead.'))
})
