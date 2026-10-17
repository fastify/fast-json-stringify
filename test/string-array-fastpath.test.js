'use strict'

const { test } = require('node:test')

const build = require('..')
const Serializer = require('../lib/serializer')
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

function stringArray (options) {
  return build({
    type: 'array',
    items: { type: 'string' }
  }, options)
}

test('asPlainStringArray matches native strings and preserves coercion on misses', (t) => {
  const serializer = new Serializer()
  const samples = [
    [],
    [''],
    ['hello'],
    ['hello " world', 'a\\b', 'a"b\\c"'],
    ['\n\r\t\b\f\u0000\u001f'],
    ['A\uD800B', 'A\uDFFFB'],
    ['emoji \uD83D\uDE00 end'],
    ['a\u2028b\u2029c'],
    ['x'.repeat(41), 'x'.repeat(42)],
    ['x'.repeat(4999), 'y'.repeat(5000)],
    [('c"\\').repeat(2000)]
  ]

  for (const sample of samples) {
    t.assert.equal(serializer.asPlainStringArray(sample), JSON.stringify(sample))
  }

  const misses = [
    [42],
    [1.5],
    [null],
    [undefined],
    [true],
    [10n],
    [Symbol('s')],
    [new Date('2020-01-02T03:04:05.006Z')],
    [new Date('invalid')],
    [/a"b/],
    [{ a: 1 }],
    [{ toJSON () { return 'from-toJSON' }, toString () { return 'from-toString' } }],
    [Object('boxed')],
    [['x']],
    ['ok', 1],
    ['ok', 'still', null]
  ]

  for (const sample of misses) {
    const stringify = stringArray({ largeArraySize: 100 })
    let expected
    let failure
    try {
      expected = stringify(sample)
    } catch (error) {
      failure = error
    }
    if (failure) {
      t.assert.throws(() => serializer.asPlainStringArray(sample), failure.constructor)
    } else {
      t.assert.equal(serializer.asPlainStringArray(sample), expected)
    }
  }
})

test('asString matches JSON.stringify for string contents', (t) => {
  const serializer = new Serializer()
  const alphabet = ['a', '"', '\\', '\n', '\u0000', '\u0001', '\u2028', '\u2029', '\uD800', '\uDE00', '😀', ' ']
  const lengths = [0, 1, 8, 41, 42, 80, 4999, 5000, 5001]
  let seed = 0x12345678
  const next = () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0
    return seed
  }

  for (const length of lengths) {
    for (let sample = 0; sample < 15; sample++) {
      let value = ''
      for (let i = 0; i < length; i++) {
        value += alphabet[next() % alphabet.length]
      }
      t.assert.equal(serializer.asString(value), JSON.stringify(value))
    }
  }
})

test('large plain string arrays use the native fast path', (t) => {
  const stringify = stringArray({ largeArraySize: 3 })
  const input = ['hello "world"', 'a\\b', 'a\u2028b', 'x'.repeat(80)]
  input.toJSON = () => ['nope']

  const original = JSON.stringify
  let sawCopy = false
  JSON.stringify = function (value, replacer, space) {
    if (
      Array.isArray(value) &&
      value !== input &&
      value.length === input.length &&
      value[0] === input[0] &&
      typeof value.toJSON !== 'function'
    ) {
      sawCopy = true
    }
    return original.call(JSON, value, replacer, space)
  }

  try {
    t.assert.equal(stringify(input), original(input.slice()))
    t.assert.equal(sawCopy, true)
  } finally {
    JSON.stringify = original
  }
})

test('arrays below largeArraySize keep the per-element path', (t) => {
  const stringify = stringArray({ largeArraySize: 4 })
  const input = ['a', 'b', 'c']
  const original = JSON.stringify
  let sawArray = false
  JSON.stringify = function (value, replacer, space) {
    if (Array.isArray(value)) sawArray = true
    return original.call(JSON, value, replacer, space)
  }

  try {
    t.assert.equal(stringify(input), '["a","b","c"]')
    t.assert.equal(sawArray, false)
  } finally {
    JSON.stringify = original
  }
})

test('fast path reads each element once and ignores array toJSON', (t) => {
  const stringify = stringArray({ largeArraySize: 3 })
  let reads = 0
  const input = ['a', 'b', 'c']
  Object.defineProperty(input, 1, {
    enumerable: true,
    get () {
      reads++
      return 'q"q'
    }
  })
  input.toJSON = () => ['z']

  t.assert.equal(stringify(input), '["a","q\\"q","c"]')
  t.assert.equal(reads, 1)
})

test('mixed string arrays keep coercion and thrown errors', (t) => {
  const stringify = stringArray({ largeArraySize: 2 })
  const date = new Date('2020-01-02T03:04:05.006Z')

  t.assert.equal(stringify(['a', 42, 'b']), '["a","42","b"]')
  t.assert.equal(stringify(['a', 1.5]), '["a","1.5"]')
  t.assert.equal(stringify(['a', null, 'b']), '["a","","b"]')
  t.assert.equal(stringify([true, false]), '["true","false"]')
  t.assert.equal(stringify([10n]), '["10"]')
  t.assert.equal(stringify([Symbol('s')]), '["Symbol(s)"]')
  t.assert.equal(stringify([date]), `["${date.toISOString()}"]`)
  t.assert.equal(stringify([/a"b/]), '["a\\"b"]')
  t.assert.equal(stringify([{ a: 1 }]), '["[object Object]"]')
  t.assert.equal(stringify([{
    toJSON () { return 'from-toJSON' },
    toString () { return 'from-toString' }
  }]), '["from-toString"]')
  t.assert.equal(stringify([Object('boxed')]), '["boxed"]')
  t.assert.equal(stringify([['x', 'y']]), '["x,y"]')
  t.assert.equal(stringify(['only']), '["only"]')
  t.assert.throws(() => stringify([undefined]), TypeError)
  t.assert.throws(() => stringify(['a', undefined]), TypeError)
  t.assert.throws(() => stringify([new Date('invalid')]), RangeError)
  t.assert.throws(() => stringify('nope'), TypeError)
  t.assert.equal(stringify(null), '[]')
  t.assert.equal(stringify([]), '[]')

  const sparse = new Array(3)
  sparse[0] = 'a'
  t.assert.throws(() => stringify(sparse), TypeError)
})

test('special strings in a large array match JSON.stringify', (t) => {
  const stringify = stringArray({ largeArraySize: 2 })
  const input = [
    '',
    'plain',
    'hello " world',
    'a\\b',
    'trail\\',
    '\n\r\t\u0000',
    'A\uD800B',
    'A\uDFFFB',
    'emoji \uD83D\uDE00',
    'a\u2028b\u2029c',
    'x'.repeat(5000),
    ('q"\\').repeat(40)
  ]

  t.assert.equal(stringify(input), JSON.stringify(input))
})

test('plain string fast path is not used for other item schemas', (t) => {
  const options = { largeArraySize: 2, mode: 'debug' }
  const cases = [
    [{ type: 'number' }, [1, 2, 3], '[1,2,3]'],
    [{ type: 'string', format: 'unsafe' }, ['a"b', 'c', 'd'], '["a"b","c","d"]'],
    [{ type: 'string', nullable: true }, ['a', null, 'b"'], '["a",null,"b\\""]'],
    [{ type: 'string', const: 'fixed' }, ['nope', 'also', 'no'], '["fixed","fixed","fixed"]']
  ]

  for (const [items, input, expected] of cases) {
    const debug = build({ type: 'array', items }, options)
    t.assert.equal(debug.code.includes('asPlainStringArray('), false)
    const stringify = build({ type: 'array', items }, { largeArraySize: 2 })
    t.assert.equal(stringify(input), expected)
  }

  const plain = build({ type: 'array', items: { type: 'string' } }, options)
  t.assert.equal(plain.code.includes('asPlainStringArray('), true)

  const optedIn = build({ type: 'array', items: { type: 'string' } }, {
    largeArraySize: 2,
    largeArrayMechanism: 'json-stringify',
    mode: 'debug'
  })
  t.assert.equal(optedIn.code.includes('asPlainStringArray('), false)
  const optedInRun = build({ type: 'array', items: { type: 'string' } }, {
    largeArraySize: 2,
    largeArrayMechanism: 'json-stringify'
  })
  t.assert.equal(optedInRun(['a', 1, 'b']), '["a",1,"b"]')
})

test('combinators and formatted strings stay on the per-element path', (t) => {
  const options = { largeArraySize: 2 }
  const schemas = [
    { type: 'string', allOf: [{ type: 'string', minLength: 0 }] },
    { type: 'string', anyOf: [{ type: 'string', minLength: 0 }, { type: 'string', minLength: 1 }] },
    { type: 'string', oneOf: [{ type: 'string', minLength: 0 }] },
    {
      type: 'string',
      if: { type: 'string', minLength: 0 },
      then: { type: 'string' }
    }
  ]

  for (const items of schemas) {
    const debug = build({ type: 'array', items }, { ...options, mode: 'debug' })
    t.assert.equal(debug.code.includes('asPlainStringArray('), false)
    const stringify = build({ type: 'array', items }, options)
    t.assert.equal(stringify(['a"b', 'c', 'd']), '["a\\"b","c","d"]')
  }

  const dated = build({
    type: 'array',
    items: { type: 'string', format: 'date-time' }
  }, options)
  const date = new Date('2020-01-02T03:04:05.006Z')
  t.assert.equal(dated([date, date]), `["${date.toISOString()}","${date.toISOString()}"]`)
  t.assert.equal(dated(['already-a-string', 'second-string']), '["already-a-string","second-string"]')
})

test('nested string arrays and object properties use the fast path per array', (t) => {
  const nested = build({
    type: 'array',
    items: {
      type: 'array',
      items: { type: 'string' }
    }
  }, { largeArraySize: 2 })

  t.assert.equal(
    nested([['a"b', 'c'], ['d', 'e']]),
    '[["a\\"b","c"],["d","e"]]'
  )
  t.assert.equal(nested([['a', 1], ['b', 'c']]), '[["a","1"],["b","c"]]')

  const wrapped = build({
    type: 'object',
    properties: {
      ids: {
        type: 'array',
        items: { type: 'string' }
      }
    }
  }, { largeArraySize: 2 })

  t.assert.equal(wrapped({ ids: ['a"b', 'c', 'd'] }), '{"ids":["a\\"b","c","d"]}')
  t.assert.equal(wrapped({ ids: ['a', null] }), '{"ids":["a",""]}')
})

test('$ref to a plain string schema can fast-path and unsafe refs cannot', (t) => {
  const plain = build({
    $id: 'root',
    type: 'array',
    items: { $ref: 'str#' }
  }, {
    largeArraySize: 2,
    schema: {
      str: { $id: 'str', type: 'string' }
    }
  })
  t.assert.equal(plain(['a"b', 'c', 'd']), '["a\\"b","c","d"]')

  const unsafe = build({
    $id: 'root-unsafe',
    type: 'array',
    items: { $ref: 'unsafe#' }
  }, {
    largeArraySize: 2,
    mode: 'debug',
    schema: {
      unsafe: { $id: 'unsafe', type: 'string', format: 'unsafe' }
    }
  })
  t.assert.equal(unsafe.code.includes('asPlainStringArray('), false)
  const unsafeRun = build({
    $id: 'root-unsafe-run',
    type: 'array',
    items: { $ref: 'unsafe#' }
  }, {
    largeArraySize: 2,
    schema: {
      unsafe: { $id: 'unsafe', type: 'string', format: 'unsafe' }
    }
  })
  t.assert.equal(unsafeRun(['a"b', 'c']), '["a"b","c"]')
})

test('inlined string arrays without a schema id keep both paths', (t) => {
  const inlineBuild = loadBuildWithLocation(LocationWithoutSchemaId)
  const stringify = inlineBuild({
    type: 'array',
    items: { type: 'string' }
  }, { largeArraySize: 2 })
  const debug = inlineBuild({
    type: 'array',
    items: { type: 'string' }
  }, { largeArraySize: 2, mode: 'debug' })

  t.assert.equal(debug.code.includes('asPlainStringArray('), true)
  t.assert.equal(stringify(['a"b', 'c', 'd']), '["a\\"b","c","d"]')
  t.assert.equal(stringify(['a', 2]), '["a","2"]')
  t.assert.equal(stringify(['only']), '["only"]')

  let reads = 0
  const input = ['a', 'b', 'c']
  Object.defineProperty(input, 0, {
    enumerable: true,
    get () {
      reads++
      return 'z"z'
    }
  })
  t.assert.equal(stringify(input), '["z\\"z","b","c"]')
  t.assert.equal(reads, 1)
})
