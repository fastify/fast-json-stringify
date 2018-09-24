'use strict'

const test = require('tap').test
const build = require('..')

test('object with allOf and multiple schema on the allOf', (t) => {
  t.plan(4)

  const schema = {
    title: 'object with allOf and multiple schema on the allOf',
    type: 'object',
    allOf: [
      {
        type: 'object',
        required: [
          'name'
        ],
        properties: {
          name: {
            type: 'string'
          },
          tag: {
            type: 'string'
          }
        }
      },
      {
        required: [
          'id'
        ],
        type: 'object',
        properties: {
          id: {
            type: 'integer'
          }
        }
      }
    ]
  }
  const stringify = build(schema)

  try {
    stringify({
      id: 1
    })
  } catch (e) {
    t.is(e.message, 'name is required!')
  }

  try {
    stringify({
      name: 'string'
    })
  } catch (e) {
    t.is(e.message, 'id is required!')
  }

  try {
    const value = stringify({
      id: 1,
      name: 'string'
    })
    t.is(value, '{"name":"string","id":1}')
  } catch (e) {
    t.fail()
  }

  try {
    const value = stringify({
      id: 1,
      name: 'string',
      tag: 'otherString'
    })
    t.is(value, '{"name":"string","tag":"otherString","id":1}')
  } catch (e) {
    t.fail()
  }
})

test('object with allOf and one schema on the allOf', (t) => {
  t.plan(1)

  const schema = {
    title: 'object with allOf and one schema on the allOf',
    type: 'object',
    allOf: [
      {
        required: [
          'id'
        ],
        type: 'object',
        properties: {
          id: {
            type: 'integer'
          }
        }
      }
    ]
  }
  const stringify = build(schema)

  try {
    const value = stringify({
      id: 1
    })
    t.is(value, '{"id":1}')
  } catch (e) {
    t.fail()
  }
})

test('object with allOf and no schema on the allOf', (t) => {
  t.plan(1)

  const schema = {
    title: 'object with allOf and no schema on the allOf',
    type: 'object',
    allOf: []
  }

  try {
    build(schema)
    t.fail()
  } catch (e) {
    t.is(e.message, 'schema is invalid: data.allOf should NOT have fewer than 1 items')
  }
})

test('object with nested allOfs', (t) => {
  t.plan(1)

  const schema = {
    title: 'object with nested allOfs',
    type: 'object',
    allOf: [
      {
        required: [
          'id'
        ],
        type: 'object',
        properties: {
          id1: {
            type: 'integer'
          }
        }
      },
      {
        allOf: [
          {
            type: 'object',
            properties: {
              id2: {
                type: 'integer'
              }
            }
          },
          {
            type: 'object',
            properties: {
              id3: {
                type: 'integer'
              }
            }
          }
        ]
      }
    ]
  }

  try {
    const stringify = build(schema)
    try {
      const value = stringify({
        id1: 1,
        id2: 2,
        id3: 3,
        id4: 4 // extra prop shouldn't be in result
      })
      t.is(value, '{"id1":1,"id2":2,"id3":3}')
    } catch (e) {
      t.fail()
    }
  } catch (e) {
    t.fail()
  }
})
