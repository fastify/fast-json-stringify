'use strict'

const test = require('tap').test
const build = require('..')

test('additionalProperties', (t) => {
  t.plan(1)
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
  t.equal('{"str":"test","foo":"42","ofoo":"true","foof":"string","objfoo":"[object Object]"}', stringify(obj))
})

test('additionalProperties should not change properties', (t) => {
  t.plan(1)
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
  t.equal('{"foo":"42","ofoo":42}', stringify(obj))
})

test('additionalProperties should not change properties and patternProperties', (t) => {
  t.plan(1)
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
  t.equal('{"foo":"42","ofoo":"42","test":42}', stringify(obj))
})

test('additionalProperties set to true, use of fast-safe-stringify', (t) => {
  t.plan(1)
  const stringify = build({
    title: 'check string coerce',
    type: 'object',
    properties: {},
    additionalProperties: true
  })

  const obj = { foo: true, ofoo: 42, arrfoo: ['array', 'test'], objfoo: { a: 'world' } }
  t.equal('{"foo":true,"ofoo":42,"arrfoo":["array","test"],"objfoo":{"a":"world"}}', stringify(obj))
})

test('additionalProperties - string coerce', (t) => {
  t.plan(1)
  const stringify = build({
    title: 'check string coerce',
    type: 'object',
    properties: {},
    additionalProperties: {
      type: 'string'
    }
  })

  const obj = { foo: true, ofoo: 42, arrfoo: ['array', 'test'], objfoo: { a: 'world' } }
  t.equal('{"foo":"true","ofoo":"42","arrfoo":"array,test","objfoo":"[object Object]"}', stringify(obj))
})

test('additionalProperties - number skip', (t) => {
  t.plan(1)
  const stringify = build({
    title: 'check number coerce',
    type: 'object',
    properties: {},
    additionalProperties: {
      type: 'number'
    }
  })

  const obj = { foo: true, ofoo: '42', xfoo: 'string', arrfoo: [1, 2], objfoo: { num: 42 } }
  t.equal(stringify(obj), '{"foo":1,"ofoo":42}')
})

test('additionalProperties - boolean coerce', (t) => {
  t.plan(1)
  const stringify = build({
    title: 'check boolean coerce',
    type: 'object',
    properties: {},
    additionalProperties: {
      type: 'boolean'
    }
  })

  const obj = { foo: 'true', ofoo: 0, arrfoo: [1, 2], objfoo: { a: true } }
  t.equal(stringify(obj), '{"foo":true,"ofoo":false,"arrfoo":true,"objfoo":true}')
})

test('additionalProperties - object coerce', (t) => {
  t.plan(1)
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
  t.equal('{"objfoo":{"answer":42}}', stringify(obj))
})

test('additionalProperties - array coerce', (t) => {
  t.plan(1)
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

  const obj = { foo: 'true', ofoo: 0, arrfoo: [1, 2], objfoo: { tyrion: 'lannister' } }
  t.equal('{"foo":["t","r","u","e"],"ofoo":[],"arrfoo":["1","2"],"objfoo":[]}', stringify(obj))
})

test('additionalProperties with empty schema', (t) => {
  t.plan(1)
  const stringify = build({
    type: 'object',
    additionalProperties: {}
  })

  const obj = { a: 1, b: true, c: null }
  t.equal('{"a":1,"b":true,"c":null}', stringify(obj))
})

test('additionalProperties with nested empty schema', (t) => {
  t.plan(1)
  const stringify = build({
    type: 'object',
    properties: {
      data: { type: 'object', additionalProperties: {} }
    },
    required: ['data']
  })

  const obj = { data: { a: 1, b: true, c: null } }
  t.equal('{"data":{"a":1,"b":true,"c":null}}', stringify(obj))
})

test('nested additionalProperties', (t) => {
  t.plan(1)
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
  t.equal('[{"ap":{"value":"string"}}]', stringify(obj))
})

test('very nested additionalProperties', (t) => {
  t.plan(1)
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
  t.equal('[{"ap":{"nested":{"moarNested":{"finally":{"value":"str"}}}}}]', stringify(obj))
})

test('nested additionalProperties set to true', (t) => {
  t.plan(1)
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
  t.equal('{"ap":{"value":"string","someNumber":42}}', stringify(obj))
})

test('field passed to fastSafeStringify as undefined should be removed', (t) => {
  t.plan(1)
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
  t.equal('{"ap":{"value":"string"}}', stringify(obj))
})

test('property without type but with enum, will acts as additionalProperties', (t) => {
  t.plan(1)
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
  t.equal('{"ap":{"additional":"field"}}', stringify(obj))
})

test('property without type but with enum, will acts as additionalProperties without overwriting', (t) => {
  t.plan(1)
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
  t.equal('{"ap":{}}', stringify(obj))
})

test('function and symbol references are not serialized as undefined', (t) => {
  t.plan(1)
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
  t.equal('{"str":"x","test":"test"}', stringify(obj))
})
