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
