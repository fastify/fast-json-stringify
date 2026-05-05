'use strict'

const { test } = require('node:test')
const build = require('..')

test('external $ref schema should be reused, not inlined at every reference', (t) => {
  t.plan(3)

  const contactSchema = {
    $id: 'contact.json',
    type: 'object',
    properties: {
      firstName: { type: 'string' },
      lastName: { type: 'string' },
      email: { type: 'string' }
    }
  }

  // Schema referencing the same external $ref multiple times
  const parentSchema = {
    type: 'object',
    properties: {
      owner: { $ref: 'contact.json' },
      assignee: { $ref: 'contact.json' },
      reporter: { $ref: 'contact.json' }
    }
  }

  const serializer = build(parentSchema, { schema: { 'contact.json': contactSchema } })
  const code = serializer.toString()

  // The serialized function should contain extracted anonymous functions
  // rather than inlining the full contact schema at every reference.
  // With the fix, `firstName` appears 0 times in the main serializer body
  // (it is inside the extracted function, which is not included in .toString())
  // or at most 1 time if in a single extracted function.
  const firstNameMatches = code.match(/firstName/g)
  t.assert.ok(firstNameMatches === null || firstNameMatches.length <= 1,
    `firstName should appear at most once (extracted function), got ${firstNameMatches ? firstNameMatches.length : 0}`)

  // Verify correct serialization
  const data = {
    owner: { firstName: 'John', lastName: 'Doe', email: 'john@example.com' },
    assignee: { firstName: 'Jane', lastName: 'Smith', email: 'jane@example.com' },
    reporter: { firstName: 'Bob', lastName: 'Jones', email: 'bob@example.com' }
  }

  const output = serializer(data)
  t.assert.doesNotThrow(() => JSON.parse(output))
  t.assert.equal(output, JSON.stringify(data))
})

test('external $ref schema reused with anyOf wrapping', (t) => {
  t.plan(2)

  const contactSchema = {
    $id: 'contact.json',
    type: 'object',
    properties: {
      firstName: { type: 'string' },
      lastName: { type: 'string' },
      email: { type: 'string' }
    }
  }

  // Common pattern: anyOf wrapping $ref for polymorphic fields (populated object OR string ID OR null)
  const parentSchema = {
    type: 'object',
    properties: {
      owner: {
        anyOf: [{ type: ['string', 'null'] }, { $ref: 'contact.json' }]
      },
      assignee: {
        anyOf: [{ type: ['string', 'null'] }, { $ref: 'contact.json' }]
      },
      reporter: {
        anyOf: [{ type: ['string', 'null'] }, { $ref: 'contact.json' }]
      }
    }
  }

  const serializer = build(parentSchema, { schema: { 'contact.json': contactSchema } })

  // Serialize with populated objects
  const data = {
    owner: { firstName: 'John', lastName: 'Doe', email: 'john@example.com' },
    assignee: { firstName: 'Jane', lastName: 'Smith', email: 'jane@example.com' },
    reporter: { firstName: 'Bob', lastName: 'Jones', email: 'bob@example.com' }
  }

  const output = serializer(data)
  t.assert.doesNotThrow(() => JSON.parse(output))
  t.assert.equal(output, JSON.stringify(data))
})

test('external $ref schema reused in array items', (t) => {
  t.plan(2)

  const contactSchema = {
    $id: 'contact.json',
    type: 'object',
    properties: {
      firstName: { type: 'string' },
      lastName: { type: 'string' }
    }
  }

  const parentSchema = {
    type: 'object',
    properties: {
      contacts: {
        type: 'array',
        items: { $ref: 'contact.json' }
      },
      primary: { $ref: 'contact.json' },
      secondary: { $ref: 'contact.json' }
    }
  }

  const serializer = build(parentSchema, { schema: { 'contact.json': contactSchema } })

  const data = {
    contacts: [
      { firstName: 'Alice', lastName: 'Wonder' },
      { firstName: 'Bob', lastName: 'Builder' }
    ],
    primary: { firstName: 'Charlie', lastName: 'Charm' },
    secondary: { firstName: 'Diana', lastName: 'Prince' }
  }

  const output = serializer(data)
  t.assert.doesNotThrow(() => JSON.parse(output))
  t.assert.equal(output, JSON.stringify(data))
})

test('external array $ref schema should be reused, not inlined at every reference', (t) => {
  t.plan(2)

  const tagsSchema = {
    $id: 'tags.json',
    type: 'array',
    items: { type: 'string' }
  }

  const parentSchema = {
    type: 'object',
    properties: {
      a: { $ref: 'tags.json' },
      b: { $ref: 'tags.json' },
      c: { $ref: 'tags.json' }
    }
  }

  const serializer = build(parentSchema, { schema: { 'tags.json': tagsSchema } })

  const data = {
    a: ['x', 'y'],
    b: ['z'],
    c: []
  }

  const output = serializer(data)
  t.assert.doesNotThrow(() => JSON.parse(output))
  t.assert.equal(output, JSON.stringify(data))
})

test('inline anonymous schemas should still be inlined (not extracted)', (t) => {
  t.plan(1)

  // Inline schemas (no external $ref) should continue to work normally
  const schema = {
    type: 'object',
    properties: {
      a: { type: 'object', properties: { x: { type: 'string' } } },
      b: { type: 'object', properties: { x: { type: 'string' } } }
    }
  }

  const serializer = build(schema)
  const output = serializer({ a: { x: 'hello' }, b: { x: 'world' } })

  t.assert.equal(output, '{"a":{"x":"hello"},"b":{"x":"world"}}')
})
