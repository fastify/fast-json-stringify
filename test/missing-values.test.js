'use strict'

const { test } = require('node:test')
const build = require('..')

test('missing values', (t) => {
  t.plan(3)

  const stringify = build({
    title: 'object with missing values',
    type: 'object',
    properties: {
      str: {
        type: 'string'
      },
      num: {
        type: 'number'
      },
      val: {
        type: 'string'
      }
    }
  })

  t.assert.equal('{"val":"value"}', stringify({ val: 'value' }))
  t.assert.equal('{"str":"string","val":"value"}', stringify({ str: 'string', val: 'value' }))
  t.assert.equal('{"str":"string","num":42,"val":"value"}', stringify({ str: 'string', num: 42, val: 'value' }))
})

test('handle null when value should be string', (t) => {
  t.plan(1)

  const stringify = build({
    type: 'object',
    properties: {
      str: {
        type: 'string'
      }
    }
  })

  t.assert.equal('{"str":""}', stringify({ str: null }))
})

test('handle null when value should be integer', (t) => {
  t.plan(1)

  const stringify = build({
    type: 'object',
    properties: {
      int: {
        type: 'integer'
      }
    }
  })

  t.assert.equal('{"int":0}', stringify({ int: null }))
})

test('handle null when value should be number', (t) => {
  t.plan(1)

  const stringify = build({
    type: 'object',
    properties: {
      num: {
        type: 'number'
      }
    }
  })

  t.assert.equal('{"num":0}', stringify({ num: null }))
})

test('handle null when value should be boolean', (t) => {
  t.plan(1)

  const stringify = build({
    type: 'object',
    properties: {
      bool: {
        type: 'boolean'
      }
    }
  })

  t.assert.equal('{"bool":false}', stringify({ bool: null }))
})

test('handle undefined when value should be string', (t) => {
  t.plan(1)

  const stringify = build({
    type: 'string'
  })

  t.assert.equal('""', stringify(undefined))
})

test('handle undefined in array of strings', (t) => {
  t.plan(1)

  const stringify = build({
    type: 'array',
    items: {
      type: 'string'
    }
  })

  t.assert.equal('["test1","test2","test3",""]', stringify(['test1', 'test2', 'test3', undefined]))
})

test('handle undefined in array of integers', (t) => {
  t.plan(1)

  const stringify = build({
    type: 'array',
    items: {
      type: 'integer'
    }
  })

  t.assert.equal('[1,2,0]', stringify([1, 2, undefined]))
})

test('handle undefined in array of numbers', (t) => {
  t.plan(1)

  const stringify = build({
    type: 'array',
    items: {
      type: 'number'
    }
  })

  t.assert.equal('[1.5,0]', stringify([1.5, undefined]))
})

test('handle undefined in array of booleans', (t) => {
  t.plan(1)

  const stringify = build({
    type: 'array',
    items: {
      type: 'boolean'
    }
  })

  t.assert.equal('[true,false]', stringify([true, undefined]))
})

test('handle undefined in array of objects', (t) => {
  t.plan(1)

  const stringify = build({
    type: 'array',
    items: {
      type: 'object',
      properties: {
        str: {
          type: 'string'
        }
      }
    }
  })

  t.assert.equal('[{"str":"test"},{}]', stringify([{ str: 'test' }, undefined]))
})

test('handle undefined in array of date-time strings', (t) => {
  t.plan(1)

  const stringify = build({
    type: 'array',
    items: {
      type: 'string',
      format: 'date-time'
    }
  })

  t.assert.equal('["2020-01-01T00:00:00.000Z",""]', stringify(['2020-01-01T00:00:00.000Z', undefined]))
})

test('handle undefined in array of date strings', (t) => {
  t.plan(1)

  const stringify = build({
    type: 'array',
    items: {
      type: 'string',
      format: 'date'
    }
  })

  t.assert.equal('["2020-01-01",""]', stringify(['2020-01-01', undefined]))
})

test('handle undefined in array of time strings', (t) => {
  t.plan(1)

  const stringify = build({
    type: 'array',
    items: {
      type: 'string',
      format: 'time'
    }
  })

  t.assert.equal('["00:00:00",""]', stringify(['00:00:00', undefined]))
})

test('handle undefined when value is nullable', (t) => {
  t.plan(1)

  const stringify = build({
    type: 'string',
    nullable: true
  })

  t.assert.equal('null', stringify(undefined))
})

test('handle undefined in tuple of strings', (t) => {
  t.plan(1)

  const stringify = build({
    type: 'array',
    items: [
      {
        type: 'string'
      },
      {
        type: 'string'
      }
    ]
  })

  t.assert.equal('["test",""]', stringify(['test', undefined]))
})

test('handle undefined in array with multiple item types', (t) => {
  t.plan(1)

  const stringify = build({
    type: 'array',
    items: {
      type: ['string', 'integer']
    }
  })

  t.assert.equal('["test",""]', stringify(['test', undefined]))
})

test('handle undefined in nested arrays', (t) => {
  t.plan(1)

  const stringify = build({
    type: 'array',
    items: {
      type: 'array',
      items: {
        type: 'string'
      }
    }
  })

  t.assert.equal('[["test"],[]]', stringify([['test'], undefined]))
})

test('undefined object properties are still skipped', (t) => {
  t.plan(1)

  const stringify = build({
    type: 'object',
    properties: {
      str: {
        type: 'string'
      }
    }
  })

  t.assert.equal('{}', stringify({ str: undefined }))
})

test('handle undefined in multi-type, tuple and const positions', (t) => {
  t.plan(6)

  t.assert.equal('["a",null]', build({ type: 'array', items: { type: ['null', 'string'] } })(['a', undefined]))
  t.assert.equal('[1,0]', build({ type: 'array', items: { type: ['integer', 'string'] } })([1, undefined]))
  t.assert.equal('[{},{}]', build({ type: 'array', items: { type: ['object', 'string'] } })([{}, undefined]))
  t.assert.equal('[true,false]', build({ type: 'array', items: { type: ['boolean', 'string'] } })([true, undefined]))
  t.assert.equal('[null]', build({ type: 'array', items: [{ type: 'null' }] })([undefined]))
  t.assert.equal('["x",null]', build({ type: 'array', items: { type: ['string', 'null'], const: 'x' } })(['x', undefined]))
})

test('handle undefined in an array of strings of any length', (t) => {
  // from 8 elements an array of strings takes the primitive array path
  const stringify = build({ type: 'array', items: { type: 'string' } })
  const lengths = [1, 4, 7, 8, 9, 40]
  t.plan(lengths.length * 3)
  for (const length of lengths) {
    for (const position of [0, Math.floor(length / 2), length - 1]) {
      const input = Array.from({ length }, (_, i) => i === position ? undefined : 'item ' + i)
      const expected = JSON.stringify(input.map((item) => item === undefined ? '' : item))
      t.assert.equal(stringify(input), expected, `length ${length}, undefined at ${position}`)
    }
  }
})

test("undefined gives the same output with objectMechanism 'native'", (t) => {
  // forceProjection enables the projection on every Node.js version
  const native = { objectMechanism: 'native', forceProjection: true }
  const withUndefined = (first, more) => [first, undefined, ...Array.from({ length: 9 }, () => more), undefined]
  const cases = [
    [{ type: 'array', items: { type: 'string' } }, withUndefined('a', 'b'), '["a","","b","b","b","b","b","b","b","b","b",""]'],
    [{ type: 'array', items: { type: 'string' } }, [undefined, 'a'], '["","a"]'],
    [{ type: 'array', items: { type: 'number' } }, withUndefined(1.5, 2), '[1.5,0,2,2,2,2,2,2,2,2,2,0]'],
    [{ type: 'array', items: { type: 'integer' } }, [1, undefined], '[1,0]'],
    [{ type: 'array', items: { type: 'boolean' } }, [true, undefined], '[true,false]'],
    [{ type: 'array', items: { type: 'string', format: 'date-time' } }, ['2026-01-02T03:04:05.000Z', undefined], '["2026-01-02T03:04:05.000Z",""]'],
    [{ type: 'array', items: { type: 'string', format: 'date' } }, ['2026-01-02', undefined], '["2026-01-02",""]'],
    [{ type: 'array', items: { type: 'string', format: 'time' } }, ['03:04:05', undefined], '["03:04:05",""]'],
    [{ type: 'array', items: { type: 'string', nullable: true } }, ['a', undefined], '["a",null]'],
    [{ type: 'array', items: { type: 'number', nullable: true } }, [1, undefined], '[1,null]'],
    [{ type: 'array', items: { type: ['string', 'null'] } }, ['a', undefined], '["a",null]'],
    [{ type: 'array', items: { type: ['null', 'number'] } }, [1, undefined], '[1,null]'],
    [{ type: 'array', items: { type: ['boolean', 'null'] } }, [true, undefined], '[true,null]'],
    [{ type: 'array', items: { type: 'object', properties: { a: { type: 'string' } } } }, [{ a: 'x' }, undefined], '[{"a":"x"},{}]'],
    [{ type: 'array', items: { type: 'object', nullable: true, properties: { a: { type: 'string' } } } }, [{ a: 'x' }, undefined], '[{"a":"x"},null]'],
    [{ type: 'array', items: { type: 'array', items: { type: 'string' } } }, [['x'], undefined], '[["x"],[]]'],
    [{ type: 'array', items: { type: 'array', nullable: true, items: { type: 'string' } } }, [['x'], undefined], '[["x"],null]'],
    [{ type: 'object', properties: { a: { type: 'string' } } }, undefined, '{}'],
    [{ type: 'object', nullable: true, properties: { a: { type: 'string' } } }, undefined, 'null'],
    [{ type: 'object', properties: { a: { type: 'string' } } }, { toJSON () { return undefined } }, '{}'],
    [{ type: 'array', items: { type: 'string' } }, undefined, '[]'],
    [{ type: 'array', nullable: true, items: { type: 'string' } }, undefined, 'null'],
    // an undefined property is still skipped, and a required one still throws
    [{ type: 'object', properties: { a: { type: 'string' }, b: { type: 'string' } } }, { a: undefined, b: 'x' }, '{"b":"x"}']
  ]
  t.plan(cases.length * 2 + 2)
  for (const [schema, input, expected] of cases) {
    t.assert.equal(build(schema)(input), expected, 'default: ' + JSON.stringify(schema))
    t.assert.equal(build(schema, native)(input), expected, 'native: ' + JSON.stringify(schema))
  }
  const required = { type: 'object', required: ['a'], properties: { a: { type: 'string' } } }
  t.assert.throws(() => build(required)({ a: undefined }), /"a" is required!/)
  t.assert.throws(() => build(required, native)({ a: undefined }), /"a" is required!/)
})
