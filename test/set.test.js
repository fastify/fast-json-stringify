'use strict'

const { test } = require('tap')
const build = require('..')

function buildTest (schema, toStringify, expectedOutput, options) {
  test(`render a ${schema.title} as JSON`, t => {
    t.plan(1)

    const stringify = build(schema, options)
    const output = stringify(toStringify)

    t.same(expectedOutput, output)
  })
}

const testCases = [
  [
    {
      title: 'an empty set',
      type: 'array'
    },
    new Set(),
    '[]'
  ],
  [
    {
      title: 'a set of numbers',
      type: 'array',
      items: { type: 'number' }
    },
    new Set([1, 2, 3]),
    '[1,2,3]'
  ],
  [
    {
      title: 'a set of strings',
      type: 'array',
      items: { type: 'string' }
    },
    new Set(['string 1', 'string 2', "it's time 12:30pm"]),
    '["string 1","string 2","it\'s time 12:30pm"]'
  ],
  [
    {
      title: 'a set of booleans',
      type: 'array',
      items: { type: 'boolean' }
    },
    new Set([false, true]),
    '[false,true]'
  ],
  [
    {
      title: 'a set of bigints',
      type: 'array',
      items: { type: 'integer' }
    },
    new Set([1234n, 888n]),
    '[1234,888]'
  ],
  [
    {
      title: 'a set of mixed types',
      type: 'array'
    },
    new Set([null, 'test', 1, 1.1, true, { a: 'test' }, ['test']]),
    '[null,"test",1,1.1,true,{"a":"test"},["test"]]'
  ],
  [
    {
      title: 'a set in an object',
      type: 'object',
      properties: {
        values: {
          type: 'array'
        }
      }
    },
    { values: new Set([1, 2, 3]) },
    '{"values":[1,2,3]}'
  ],
  [
    {
      title: 'a set in an array',
      type: 'array',
      items: { type: 'array' }
    },
    [new Set([1, 2, 3])],
    '[[1,2,3]]'
  ],
  [
    {
      title: 'nested set',
      type: 'array',
      items: { type: 'array' }
    },
    new Set([new Set([1, 2, 3]), new Set([2, 3])]),
    '[[1,2,3],[2,3]]'
  ]
]

testCases.forEach(testCase => buildTest(...testCase))

test('order of the output array is the add order', t => {
  t.plan(1)

  const set = new Set()

  set.add(2)
  set.add(5)
  set.add(3)
  set.add(1)
  set.delete(5)
  set.add(5)
  set.delete(2)

  const stringify = build({ title: 'a normal set', type: 'array' })
  const output = stringify(set)

  t.same('[3,1,5]', output)
})
