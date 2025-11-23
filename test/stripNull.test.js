const test = require('tap').test
const build = require('..')

test('should handle null string values properly', (t) => {
  t.plan(3)

  const schema = {
    type: 'object',
    properties: {
      firstName: { type: 'string' },
      lastName: { type: 'string' }
    },
    required: ['firstName']
  }
  const stringify = build(schema, { stripNull: true })

  const json1 = { firstName: 'Matteo', lastName: 'Collina' }
  t.equal(stringify(json1), '{"firstName":"Matteo","lastName":"Collina"}')

  const json2 = { firstName: 'Matteo', lastName: null }
  t.equal(stringify(json2), '{"firstName":"Matteo"}')

  const json3 = { firstName: null, lastName: 'Collina' }
  t.throws(() => stringify(json3)) // throw error when required property is missing
})

test('should handle null int values properly', (t) => {
  t.plan(3)

  const schema = {
    type: 'object',
    properties: {
      name: { type: 'string' },
      age: { type: 'integer' },
      experience: { type: 'integer' }
    }
  }
  const stringify = build(schema, { stripNull: true })

  const json1 = { name: 'Matteo', age: 32, experience: 12 }
  t.equal(stringify(json1), '{"name":"Matteo","age":32,"experience":12}')

  const json2 = { name: 'Matteo', age: null, experience: null }
  t.equal(stringify(json2), '{"name":"Matteo"}')

  const json3 = { name: 'Matteo', age: 3, experience: null }
  t.equal(stringify(json3), '{"name":"Matteo","age":3}')
})

test('should handle arrays properly', (t) => {
  t.plan(1)

  const schema = {
    type: 'object',
    properties: {
      name: { type: 'string' },
      experience: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            company: { type: 'string' },
            years: { type: 'integer' }
          }
        }
      }
    }
  }
  const stringify = build(schema, { stripNull: true })

  const json1 = {
    name: 'Matteo',
    experience: [
      { company: 'C1', years: 12 },
      { company: 'C2', years: null },
      { company: null, years: 6 },
      { company: null, years: null }
    ]
  }

  t.equal(
    stringify(json1),
    '{"name":"Matteo","experience":[{"company":"C1","years":12},{"company":"C2"},{"years":6},{}]}'
  )
})

test('should handle objects and nested objects properly', (t) => {
  t.plan(2)

  const schema = {
    type: 'object',
    properties: {
      name: { type: 'string' },
      address: {
        type: 'object',
        properties: {
          city: { type: 'string' },
          country: { type: 'string' }
        }
      }
    }
  }
  const stringify = build(schema, { stripNull: true })

  const json1 = { name: 'Matteo', address: { city: 'Mumbai', country: null } }
  t.equal(stringify(json1), '{"name":"Matteo","address":{"city":"Mumbai"}}')

  const json2 = { name: null, address: { city: null, country: 'India' } }
  t.equal(stringify(json2), '{"address":{"country":"India"}}')
})
