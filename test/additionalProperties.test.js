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

  let obj = { str: 'test', foo: 42, ofoo: true, foof: 'string', objfoo: {a: true} }
  t.equal('{"foo":"42","ofoo":"true","foof":"string","objfoo":"[object Object]","str":"test"}', stringify(obj))
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
  t.equal('{"ofoo":42,"foo":"42"}', stringify(obj))
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
  t.equal('{"ofoo":"42","test":42,"foo":"42"}', stringify(obj))
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

test('additionalProperties - number coerce ok', (t) => {
  t.plan(1)
  const stringify = build({
    title: 'check number coerce ok',
    type: 'object',
    properties: {},
    additionalProperties: {
      type: 'number'
    }
  })

  const obj = { foo: '22', ofoo: '42.5' }
  t.equal('{"foo":22,"ofoo":42.5}', stringify(obj))
})

test('additionalProperties - number coerce fails', (t) => {
  t.plan(1)
  const stringify = build({
    title: 'check number coerce fails',
    type: 'object',
    properties: {},
    additionalProperties: {
      type: 'number'
    }
  })

  const obj = { foo: true, ofoo: '42', xfoo: 'string', arrfoo: [1, 2], objfoo: { num: 42 } }
  const err = stringify(obj)
  t.equal(err.message, 'Cannot coerce to number')
})

test('additionalProperties', (t) => {
  t.plan(1)
  const stringify = build({
    title: 'check boolean coerce',
    type: 'object',
    properties: {},
    additionalProperties: {
      type: 'boolean'
    }
  })

  const obj = { foo: 'true', ofoo: true, arrfoo: false, objfoo: 'false' }
  t.equal('{"foo":true,"ofoo":true,"arrfoo":false,"objfoo":false}', stringify(obj))
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

  let obj = [{ ap: { value: 'string' } }]
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

  let obj = [{ ap: { nested: { moarNested: { finally: { value: 'str' } } } } }]
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

  let obj = { ap: { value: 'string', someNumber: 42 } }
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

  let obj = { ap: { value: 'string', someNumber: undefined } }
  t.equal('{"ap":{"value":"string"}}', stringify(obj))
})
