'use strict'

const { describe } = require('node:test')
const { deepStrictEqual, throws } = require('node:assert')
const build = require('..')

describe('additionalProperties', () => {
  const stringify = build({
    title: 'additionalProperties',
    type: 'object',
    properties: {
      str: {
        type: 'string'
      }
    },
    additionalProperties: {
      type: 'string'
    }
  })

  const obj = { str: 'test', foo: 42, ofoo: true, foof: 'string', objfoo: { a: true } }
  deepStrictEqual(stringify(obj), '{"str":"test","foo":"42","ofoo":"true","foof":"string","objfoo":"[object Object]"}')
})

describe('additionalProperties should not change properties', () => {
  const stringify = build({
    title: 'patternProperties should not change properties',
    type: 'object',
    properties: {
      foo: {
        type: 'string'
      }
    },
    additionalProperties: {
      type: 'number'
    }
  })

  const obj = { foo: '42', ofoo: 42 }
  deepStrictEqual(stringify(obj), '{"foo":"42","ofoo":42}')
})

describe('additionalProperties should not change properties and patternProperties', () => {
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
        type: 'string'
      }
    },
    additionalProperties: {
      type: 'number'
    }
  })

  const obj = { foo: '42', ofoo: 42, test: '42' }
  deepStrictEqual(stringify(obj), '{"foo":"42","ofoo":"42","test":42}')
})

describe('additionalProperties set to true, use of fast-safe-stringify', () => {
  const stringify = build({
    title: 'check string coerce',
    type: 'object',
    properties: {},
    additionalProperties: true
  })

  const obj = { foo: true, ofoo: 42, arrfoo: ['array', 'test'], objfoo: { a: 'world' } }
  deepStrictEqual(stringify(obj), '{"foo":true,"ofoo":42,"arrfoo":["array","test"],"objfoo":{"a":"world"}}')
})

describe('additionalProperties - string coerce', () => {
  const stringify = build({
    title: 'check string coerce',
    type: 'object',
    properties: {},
    additionalProperties: {
      type: 'string'
    }
  })

  const obj = { foo: true, ofoo: 42, arrfoo: ['array', 'test'], objfoo: { a: 'world' } }
  deepStrictEqual(stringify(obj), '{"foo":"true","ofoo":"42","arrfoo":"array,test","objfoo":"[object Object]"}')
})

describe('additionalProperties - number skip', () => {
  const stringify = build({
    title: 'check number coerce',
    type: 'object',
    properties: {},
    additionalProperties: {
      type: 'number'
    }
  })

  // const obj = { foo: true, ofoo: '42', xfoo: 'string', arrfoo: [1, 2], objfoo: { num: 42 } }
  const obj = { foo: true, ofoo: '42' }
  deepStrictEqual(stringify(obj), '{"foo":1,"ofoo":42}')
})

describe('additionalProperties - boolean coerce', () => {
  const stringify = build({
    title: 'check boolean coerce',
    type: 'object',
    properties: {},
    additionalProperties: {
      type: 'boolean'
    }
  })

  const obj = { foo: 'true', ofoo: 0, arrfoo: [1, 2], objfoo: { a: true } }
  deepStrictEqual(stringify(obj), '{"foo":true,"ofoo":false,"arrfoo":true,"objfoo":true}')
})

describe('additionalProperties - object coerce', () => {
  const stringify = build({
    title: 'check object coerce',
    type: 'object',
    properties: {},
    additionalProperties: {
      type: 'object',
      properties: {
        answer: {
          type: 'number'
        }
      }
    }
  })

  const obj = { objfoo: { answer: 42 } }
  deepStrictEqual(stringify(obj), '{"objfoo":{"answer":42}}')
})

describe('additionalProperties - array coerce', () => {
  const stringify = build({
    title: 'check array coerce',
    type: 'object',
    properties: {},
    additionalProperties: {
      type: 'array',
      items: {
        type: 'string'
      }
    }
  })

  const coercibleValues = { arrfoo: [1, 2] }
  deepStrictEqual(stringify(coercibleValues), '{"arrfoo":["1","2"]}')

  const incoercibleValues = { foo: 'true', ofoo: 0, objfoo: { tyrion: 'lannister' } }
  throws(() => stringify(incoercibleValues))
})

describe('additionalProperties with empty schema', () => {
  const stringify = build({
    type: 'object',
    additionalProperties: {}
  })

  const obj = { a: 1, b: true, c: null }
  deepStrictEqual(stringify(obj), '{"a":1,"b":true,"c":null}')
})

describe('additionalProperties with nested empty schema', () => {
  const stringify = build({
    type: 'object',
    properties: {
      data: { type: 'object', additionalProperties: {} }
    },
    required: ['data']
  })

  const obj = { data: { a: 1, b: true, c: null } }
  deepStrictEqual(stringify(obj), '{"data":{"a":1,"b":true,"c":null}}')
})

describe('nested additionalProperties', () => {
  const stringify = build({
    title: 'additionalProperties',
    type: 'array',
    items: {
      type: 'object',
      properties: {
        ap: {
          type: 'object',
          additionalProperties: { type: 'string' }
        }
      }
    }
  })

  const obj = [{ ap: { value: 'string' } }]
  deepStrictEqual(stringify(obj), '[{"ap":{"value":"string"}}]')
})

describe('very nested additionalProperties', () => {
  const stringify = build({
    title: 'additionalProperties',
    type: 'array',
    items: {
      type: 'object',
      properties: {
        ap: {
          type: 'object',
          properties: {
            nested: {
              type: 'object',
              properties: {
                moarNested: {
                  type: 'object',
                  properties: {
                    finally: {
                      type: 'object',
                      additionalProperties: {
                        type: 'string'
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    }
  })

  const obj = [{ ap: { nested: { moarNested: { finally: { value: 'str' } } } } }]
  deepStrictEqual(stringify(obj), '[{"ap":{"nested":{"moarNested":{"finally":{"value":"str"}}}}}]')
})

describe('nested additionalProperties set to true', () => {
  const stringify = build({
    title: 'nested additionalProperties=true',
    type: 'object',
    properties: {
      ap: {
        type: 'object',
        additionalProperties: true
      }
    }
  })

  const obj = { ap: { value: 'string', someNumber: 42 } }
  deepStrictEqual(stringify(obj), '{"ap":{"value":"string","someNumber":42}}')
})

describe('field passed to fastSafeStringify as undefined should be removed', () => {
  const stringify = build({
    title: 'nested additionalProperties=true',
    type: 'object',
    properties: {
      ap: {
        type: 'object',
        additionalProperties: true
      }
    }
  })

  const obj = { ap: { value: 'string', someNumber: undefined } }
  deepStrictEqual(stringify(obj), '{"ap":{"value":"string"}}')
})

describe('property without type but with enum, will acts as additionalProperties', () => {
  const stringify = build({
    title: 'automatic additionalProperties',
    type: 'object',
    properties: {
      ap: {
        enum: ['foobar', 42, ['foo', 'bar'], {}]
      }
    }
  })

  const obj = { ap: { additional: 'field' } }
  deepStrictEqual(stringify(obj), '{"ap":{"additional":"field"}}')
})

describe('property without type but with enum, will acts as additionalProperties without overwriting', () => {
  const stringify = build({
    title: 'automatic additionalProperties',
    type: 'object',
    properties: {
      ap: {
        additionalProperties: false,
        enum: ['foobar', 42, ['foo', 'bar'], {}]
      }
    }
  })

  const obj = { ap: { additional: 'field' } }
  deepStrictEqual(stringify(obj), '{"ap":{}}')
})

describe('function and symbol references are not serialized as undefined', () => {
  const stringify = build({
    title: 'additionalProperties',
    type: 'object',
    additionalProperties: true,
    properties: {
      str: {
        type: 'string'
      }
    }
  })

  const obj = { str: 'x', test: 'test', meth: () => 'x', sym: Symbol('x') }
  deepStrictEqual(stringify(obj), '{"str":"x","test":"test"}')
})
