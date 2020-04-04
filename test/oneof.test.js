'use strict'

const { test } = require('tap')
const build = require('..')

test('object with multiple types field', (t) => {
  t.plan(2)

  const schema = {
    title: 'object with multiple types field',
    type: 'object',
    properties: {
      str: {
        oneOf: [{
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
    t.fail(e.message)
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
        oneOf: [{
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
        str: 'string',
        remove: 'this'
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
        oneOf: [{
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
        oneOf: [{
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
        oneOf: [{
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

test('object with field with type union of multiple objects', (t) => {
  t.plan(2)

  const schema = {
    title: 'object with oneOf property value containing objects',
    type: 'object',
    properties: {
      oneOfSchema: {
        oneOf: [
          {
            type: 'object',
            properties: {
              baz: { type: 'number' }
            },
            required: ['baz']
          },
          {
            type: 'object',
            properties: {
              bar: { type: 'string' }
            },
            required: ['bar']
          }
        ]
      }
    },
    required: ['oneOfSchema']
  }

  const stringify = build(schema)

  try {
    const value = stringify({ oneOfSchema: { baz: 5 } })
    t.is(value, '{"oneOfSchema":{"baz":5}}')
  } catch (e) {
    t.fail()
  }

  try {
    const value = stringify({ oneOfSchema: { bar: 'foo' } })
    t.is(value, '{"oneOfSchema":{"bar":"foo"}}')
  } catch (e) {
    t.fail()
  }
})

test('null value in schema', (t) => {
  t.plan(0)

  const schema = {
    title: 'schema with null child',
    type: 'string',
    nullable: true,
    enum: [null]
  }

  try {
    build(schema)
  } catch (e) {
    t.fail()
  }
})

test('oneOf and $ref together', (t) => {
  t.plan(2)

  const schema = {
    type: 'object',
    properties: {
      cs: {
        oneOf: [
          {
            $ref: '#/definitions/Option'
          },
          {
            type: 'boolean'
          }
        ]
      }
    },
    definitions: {
      Option: {
        type: 'string'
      }
    }
  }

  const stringify = build(schema)

  try {
    const value = stringify({
      cs: 'franco'
    })
    t.is(value, '{"cs":"franco"}')
  } catch (e) {
    t.fail()
  }

  try {
    const value = stringify({
      cs: true
    })
    t.is(value, '{"cs":true}')
  } catch (e) {
    t.fail()
  }
})

test('oneOf and $ref: 2 levels are fine', (t) => {
  t.plan(1)

  const schema = {
    type: 'object',
    properties: {
      cs: {
        oneOf: [
          {
            $ref: '#/definitions/Option'
          },
          {
            type: 'boolean'
          }
        ]
      }
    },
    definitions: {
      Option: {
        oneOf: [
          {
            type: 'number'
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
      cs: 3
    })
    t.is(value, '{"cs":3}')
  } catch (e) {
    t.fail()
  }
})

test('oneOf and $ref: multiple levels should throw at build.', (t) => {
  t.plan(3)

  const schema = {
    type: 'object',
    properties: {
      cs: {
        oneOf: [
          {
            $ref: '#/definitions/Option'
          },
          {
            type: 'boolean'
          }
        ]
      }
    },
    definitions: {
      Option: {
        oneOf: [
          {
            $ref: '#/definitions/Option2'
          },
          {
            type: 'string'
          }
        ]
      },
      Option2: {
        type: 'number'
      }
    }
  }

  const stringify = build(schema)
  try {
    const value = stringify({
      cs: 3
    })
    t.is(value, '{"cs":3}')
  } catch (e) {
    t.fail(e)
  }
  try {
    const value = stringify({
      cs: true
    })
    t.is(value, '{"cs":true}')
  } catch (e) {
    t.fail(e)
  }
  try {
    const value = stringify({
      cs: 'pippo'
    })
    t.is(value, '{"cs":"pippo"}')
  } catch (e) {
    t.fail(e)
  }
})
