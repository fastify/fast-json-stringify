'use strict'

const { test } = require('node:test')

const OriginalLocation = require('../lib/location')

const buildPath = require.resolve('..')
const locationPath = require.resolve('../lib/location')

function loadBuildWithLocation (Location) {
  require.cache[locationPath].exports = Location
  delete require.cache[buildPath]

  try {
    return require(buildPath)
  } finally {
    require.cache[locationPath].exports = OriginalLocation
    delete require.cache[buildPath]
  }
}

class LocationWithoutSchemaId {
  constructor (schema, _schemaId, jsonPointer = '#') {
    this.schema = schema
    this.schemaId = ''
    this.jsonPointer = _schemaId ? _schemaId + jsonPointer : jsonPointer
  }

  getPropertyLocation (propertyName) {
    return new LocationWithoutSchemaId(
      this.schema[propertyName],
      '',
      this.jsonPointer + '/' + propertyName
    )
  }

  getSchemaRef () {
    return this.schemaId + this.jsonPointer
  }
}

class LocationWithoutJsonPointer {
  constructor (schema, schemaId) {
    this.schema = schema
    this.schemaId = schemaId
    this.jsonPointer = ''
  }

  getPropertyLocation (propertyName) {
    return new LocationWithoutJsonPointer(this.schema[propertyName], this.schemaId)
  }

  getSchemaRef () {
    return this.schemaId
  }
}

class LocationWithoutSchemaRef extends OriginalLocation {
  getSchemaRef () {}
}

test('inline object generation without schema IDs', t => {
  t.plan(3)

  const build = loadBuildWithLocation(LocationWithoutSchemaId)
  const stringify = build({
    type: 'object',
    properties: {
      value: { type: 'string' }
    }
  })
  const stringifyNullable = build({ type: 'object', nullable: true })

  t.assert.equal(stringify({ value: 'test' }), '{"value":"test"}')
  t.assert.equal(stringify(null), '{}')
  t.assert.equal(stringifyNullable(null), 'null')
})

test('inline array generation without schema IDs', t => {
  t.plan(6)

  const build = loadBuildWithLocation(LocationWithoutSchemaId)
  const stringify = build({ type: 'array', items: { type: 'string' } }, { largeArrayMechanism: 'default' })
  const stringifyNullable = build({ type: 'array', nullable: true })
  const stringifyTuple = build({
    type: 'array',
    items: [{ $ref: 'item' }, { type: 'number' }],
    additionalItems: true
  }, {
    schema: {
      item: { type: 'string' }
    }
  })
  const stringifyFixedTuple = build({
    type: 'array',
    items: [{ type: 'string' }],
    additionalItems: false
  })
  const stringifyLargeArray = build({ type: 'array', items: { type: 'number' } }, {
    largeArrayMechanism: 'json-stringify',
    largeArraySize: 1
  })

  t.assert.equal(stringify(['one', 'two']), '["one","two"]')
  t.assert.equal(stringifyNullable(null), 'null')
  t.assert.equal(stringifyTuple(['one', 2, true]), '["one",2,true]')
  t.assert.throws(() => stringifyFixedTuple(['one', 'two']), /Item at 1/)
  t.assert.equal(stringifyLargeArray([1, 2]), '[1,2]')
  t.assert.throws(() => stringify('not-an-array'), /does not match schema definition/)
})

test('code generation reference fallbacks', t => {
  t.plan(3)

  const buildWithoutPointer = loadBuildWithLocation(LocationWithoutJsonPointer)
  const stringifyObject = buildWithoutPointer({ type: 'object' })
  const stringifyArray = buildWithoutPointer({ type: 'array' })

  const buildWithoutRef = loadBuildWithLocation(LocationWithoutSchemaRef)
  const stringifyWithoutRef = buildWithoutRef({ type: 'object' })

  t.assert.equal(stringifyObject({}), '{}')
  t.assert.equal(stringifyArray([]), '[]')
  t.assert.equal(stringifyWithoutRef({}), '{}')
})

test('required-property fallback tolerates unexpected property ordering', t => {
  t.plan(2)

  const originalSort = Array.prototype.sort
  // Deliberately fault-inject unexpected ordering to exercise the defensive branch.
  // eslint-disable-next-line no-extend-native
  Array.prototype.sort = function (compareFn) {
    const result = originalSort.call(this, compareFn)
    if (this.length === 2 && this.includes('optional') && this.includes('required')) {
      result.reverse()
    }
    return result
  }

  try {
    const build = loadBuildWithLocation(OriginalLocation)
    const stringify = build({
      type: 'object',
      properties: {
        optional: { type: 'string' },
        required: { type: 'string' }
      },
      required: ['required']
    })

    t.assert.equal(stringify({ optional: 'one', required: 'two' }), '{"optional":"one","required":"two"}')
    t.assert.throws(() => stringify({ optional: 'one' }), /"required" is required/)
  } finally {
    // eslint-disable-next-line no-extend-native
    Array.prototype.sort = originalSort
  }
})
