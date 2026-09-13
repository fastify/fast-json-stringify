'use strict'

// Random schemas, values that conform to them, and what the serializer must write for them.
//
// `expected` is the small model of what the README promises: properties in schema order with
// the required ones first, then the extra ones the schema keeps, a default where a value is
// missing, dates by their format, null where the schema allows it. JSON.stringify of what it
// returns is the text the compiled serializer must produce, byte for byte.

const { int, pick, chance } = require('./lib')

// names a real schema has, and names that need escaping or collide with something
const NAMES = ['a', 'b', 'id', 'name', 'value', 'x y', 'q"uote', 'back\\slash', 'uni€', 'emoji😀', 'new\nline',
  'constructor', 'hasOwnProperty', '0', '1', '$ref', 'items', 'type', 'ünïcödé', 'a-b', 'a.b', 'x_y_z', 'a/b', 'a~b', 'a%b',
  'a#b', 'tick`', 'dollar$' + '{x}', '\\u', "single'quote"]

const ALPHABET = ['a', 'Z', '0', ' ', '"', '\\', '\n', '\t', String.fromCharCode(0), String.fromCharCode(31), 'é', '€', '😀',
  String.fromCharCode(0xd800), String.fromCharCode(0xdfff), String.fromCharCode(0x2028), '/', '<']
function text (rng) {
  // lengths around the boundaries of the serializer's fast paths: 42 and 5000
  const length = pick(rng, [0, 1, 5, 20, 41, 42, 43, 100, 4999, 5000, 5001, 6000, int(rng, 0, 60)])
  let out = ''
  for (let i = 0; i < length; i++) out += chance(rng, 0.85) ? pick(rng, ALPHABET.slice(0, 3)) : pick(rng, ALPHABET)
  return out
}

const NUMBERS = [0, -0, 1, -1, 1.5, -2.25, 1e21, 1e-7, 2 ** 53, -(2 ** 53), Number.MAX_VALUE, Number.MIN_VALUE, 0.1 + 0.2, 123456789.125, Infinity, -Infinity]
const INTEGERS = [0, 1, -1, 42, 2 ** 31 - 1, -(2 ** 31), 2 ** 53 - 1, 1e21, -1e21]
const number = (rng) => chance(rng, 0.5) ? pick(rng, NUMBERS) : (rng() - 0.5) * 1e6
const integer = (rng) => chance(rng, 0.5) ? pick(rng, INTEGERS) : int(rng, -100000, 100000)
const DATES = [0, 1e12, -1e12, 951782400000, 253402300799000, -62135596800000]
const date = (rng) => new Date(chance(rng, 0.5) ? pick(rng, DATES) : int(rng, -1e13, 1e13))

// the tree definition every root carries, so a $ref can recurse
const DEFINITIONS = {
  tree: {
    type: 'object',
    properties: {
      v: { type: 'string' },
      children: { type: 'array', items: { $ref: '#/definitions/tree' } }
    },
    required: ['v']
  },
  leaf: { type: 'object', properties: { n: { type: 'integer' }, s: { type: 'string', format: 'date-time' } } }
}

function drawSchema (rng, depth = 0) {
  const kind = depth > 2
    ? pick(rng, ['string', 'number', 'integer', 'boolean', 'null', 'const', 'enum'])
    : pick(rng, ['string', 'string', 'number', 'integer', 'boolean', 'null', 'object', 'object', 'array', 'array',
      'multi', 'anyOf', 'oneOf', 'ref', 'const', 'enum'])
  let schema
  switch (kind) {
    case 'string':
      schema = { type: 'string' }
      if (chance(rng, 0.3)) schema.format = pick(rng, ['date-time', 'date', 'time', 'email', 'uuid'])
      break
    case 'number':
    case 'integer':
    case 'boolean':
    case 'null':
      schema = { type: kind }
      break
    case 'const':
      schema = { const: pick(rng, [1, 'x', true, null, { a: [1, 'b'] }, [1, 2]]) }
      break
    case 'enum':
      schema = { type: 'string', enum: ['one', 'two', 'thr"ee'] }
      break
    case 'multi':
      schema = { type: pick(rng, [['string', 'number'], ['object', 'null'], ['integer', 'string', 'boolean'], ['array', 'string'], ['number', 'null']]) }
      if (schema.type.includes('object')) schema.properties = { p: { type: 'string' } }
      if (schema.type.includes('array')) schema.items = { type: 'integer' }
      break
    case 'anyOf':
    case 'oneOf':
      // one object branch at most: which of two object branches wins is ajv's call, not modeled here
      schema = { [kind]: [{ type: 'string' }, { type: 'number' }, { type: 'boolean' }, { type: 'object', properties: { k: { type: 'integer' } }, required: ['k'] }].slice(0, int(rng, 2, 4)) }
      break
    case 'ref':
      schema = { $ref: `#/definitions/${pick(rng, Object.keys(DEFINITIONS))}` }
      break
    case 'array':
      schema = { type: 'array', items: drawSchema(rng, depth + 1) }
      break
    case 'object': {
      const properties = {}
      const required = []
      for (let i = int(rng, 0, 5); i > 0; i--) {
        const name = pick(rng, NAMES)
        if (name in properties) continue
        properties[name] = drawSchema(rng, depth + 1)
        if (chance(rng, 0.4)) required.push(name)
        if (chance(rng, 0.2) && !('$ref' in properties[name]) && properties[name].type !== 'null' && !('const' in properties[name])) {
          properties[name].default = withoutRefKeys(drawValue(rng, properties[name], 0))
        }
      }
      schema = { type: 'object', properties }
      if (required.length) schema.required = required
      const extra = pick(rng, ['none', 'none', 'false', 'true', 'schema', 'pattern'])
      if (extra === 'false') schema.additionalProperties = false
      if (extra === 'true') schema.additionalProperties = true
      if (extra === 'schema') schema.additionalProperties = drawSchema(rng, depth + 1)
      if (extra === 'pattern') schema.patternProperties = { '^x': drawSchema(rng, depth + 1) }
      break
    }
  }
  if (chance(rng, 0.15) && schema.type && schema.type !== 'null') schema.nullable = true
  return schema
}

// json-schema-ref-resolver reads a $ref or an $id inside a default as a reference, until
// fastify/json-schema-ref-resolver#54 lands: a default carries neither
function withoutRefKeys (value) {
  if (Array.isArray(value)) return value.map(withoutRefKeys)
  if (value && typeof value === 'object' && !(value instanceof Date)) {
    return Object.fromEntries(Object.entries(value).filter(([k]) => k !== '$ref' && k !== '$id').map(([k, v]) => [k, withoutRefKeys(v)]))
  }
  return value
}

const resolve = (schema, root) => ('$ref' in schema ? root.definitions[schema.$ref.split('/').pop()] : schema)

function drawValue (rng, schema, depth, root = { definitions: DEFINITIONS }) {
  schema = resolve(schema, root)
  if (schema.nullable && chance(rng, 0.2)) return null
  if ('const' in schema) return schema.const
  if (schema.enum) return pick(rng, schema.enum)
  if (schema.anyOf || schema.oneOf) {
    // ajv picks the branch, and to ajv Infinity is no number: JSON has none
    const value = drawValue(rng, pick(rng, schema.anyOf || schema.oneOf), depth, root)
    return typeof value === 'number' && !Number.isFinite(value) ? 1.5 : value
  }
  const type = Array.isArray(schema.type) ? pick(rng, schema.type) : schema.type
  switch (type) {
    case 'string':
      if (['date-time', 'date', 'time'].includes(schema.format) && chance(rng, 0.6)) return date(rng)
      return text(rng)
    case 'number': return number(rng)
    case 'integer': return integer(rng)
    case 'boolean': return chance(rng, 0.5)
    case 'null': return null
    case 'array': {
      const length = depth > 3 ? 0 : chance(rng, 0.1) ? int(rng, 30, 60) : int(rng, 0, 4)
      return Array.from({ length }, () => drawValue(rng, schema.items, depth + 1, root))
    }
    case 'object': {
      const value = {}
      const required = schema.required || []
      for (const name of Object.keys(schema.properties || {})) {
        // a missing optional property is part of what a real object looks like
        if (required.includes(name) || chance(rng, 0.7)) value[name] = drawValue(rng, schema.properties[name], depth + 1, root)
      }
      // extra properties, whatever the schema says about them
      for (let i = chance(rng, 0.4) ? int(rng, 1, 3) : 0; i > 0; i--) {
        const name = chance(rng, 0.5) ? 'x' + pick(rng, NAMES) : 'extra' + i
        if (!(name in (schema.properties || {}))) {
          const extraSchema = schema.patternProperties?.['^x'] && name.startsWith('x')
            ? schema.patternProperties['^x']
            : typeof schema.additionalProperties === 'object' ? schema.additionalProperties : { type: 'string' }
          value[name] = drawValue(rng, extraSchema, depth + 1, root)
        }
      }
      return value
    }
  }
  throw new Error(`no value for ${JSON.stringify(schema)}`)
}

// how the serializer writes a Date for each format, as the README promises
const local = (d) => new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString()
const FORMATS = {
  'date-time': (d) => d.toISOString(),
  date: (d) => local(d).slice(0, 10),
  time: (d) => local(d).slice(11, 19)
}

const typeOf = (value) => value === null ? 'null' : Array.isArray(value) ? 'array' : typeof value === 'number' ? (Number.isInteger(value) ? 'integer' : 'number') : typeof value
const accepts = (schema, value, root) => {
  schema = resolve(schema, root)
  if (value === null) return schema.nullable || schema.type === 'null' || (Array.isArray(schema.type) && schema.type.includes('null'))
  const types = [].concat(schema.type || [])
  const actual = typeOf(value)
  return types.includes(actual) || (actual === 'integer' && types.includes('number'))
}

// an object of the expectation keeps its pairs in order: JSON.stringify would move a key like
// "1" to the front, and the serializer writes it where the schema has it
class Pairs {
  constructor () { this.pairs = [] }
  set (key, value) { this.pairs.push([key, value]) }
}
// a value JSON.stringify writes as it is, which is what the json-stringify mechanism does
class Raw {
  constructor (value) { this.value = value }
}

// the text of an expectation
function render (value) {
  if (value instanceof Pairs) return `{${value.pairs.map(([k, v]) => `${JSON.stringify(k)}:${render(v)}`).join(',')}}`
  if (value instanceof Raw) return JSON.stringify(value.value)
  if (Array.isArray(value)) return `[${value.map(render).join(',')}]`
  return JSON.stringify(value)
}

// `largeArraySize` says from how many items an array is handed to JSON.stringify whole, which
// is what the json-stringify mechanism does: the item schema, formats included, plays no part
function expected (schema, value, root = { definitions: DEFINITIONS }, largeArraySize = Infinity) {
  schema = resolve(schema, root)
  if (value === null) return null
  if (Array.isArray(value) && value.length >= largeArraySize) return new Raw(value)
  if ('const' in schema) return new Raw(schema.const)
  if (schema.anyOf || schema.oneOf) {
    const branch = (schema.anyOf || schema.oneOf).find((b) => accepts(b, value, root))
    return expected(branch, value, root, largeArraySize)
  }
  const type = Array.isArray(schema.type) ? typeOf(value) : schema.type
  switch (type === 'integer' && !Array.isArray(schema.type) ? 'integer' : type === 'integer' ? (schema.type.includes('integer') ? 'integer' : 'number') : type) {
    case 'string': return value instanceof Date ? FORMATS[schema.format](value) : value
    case 'number':
    case 'integer':
    case 'boolean':
    case 'null': return value
    case 'array': return value.map((item) => expected(schema.items, item, root, largeArraySize))
    case 'object': {
      const out = new Pairs()
      const properties = schema.properties || {}
      const required = schema.required || []
      const keys = Object.keys(properties)
      for (const name of [...keys.filter((k) => required.includes(k)), ...keys.filter((k) => !required.includes(k))]) {
        const property = resolve(properties[name], root)
        if (value[name] !== undefined) out.set(name, expected(property, value[name], root, largeArraySize))
        else if (property.default !== undefined) out.set(name, new Raw(property.default))
      }
      for (const name of Object.keys(value)) {
        if (name in properties) continue
        const pattern = schema.patternProperties?.['^x']
        if (pattern && /^x/.test(name)) out.set(name, expected(pattern, value[name], root, largeArraySize))
        else if (schema.additionalProperties === true) out.set(name, new Raw(value[name]))
        else if (typeof schema.additionalProperties === 'object') out.set(name, expected(schema.additionalProperties, value[name], root, largeArraySize))
      }
      return out
    }
  }
  throw new Error(`no expectation for ${JSON.stringify(schema)}`)
}

// a plan: a root schema carrying the definitions, and a value for it
function draw (rng) {
  const schema = { ...drawSchema(rng), definitions: DEFINITIONS }
  return { schema, value: drawValue(rng, schema, 0, schema) }
}

const clone = (value) => value instanceof Date ? new Date(value.getTime()) : Array.isArray(value) ? value.map(clone) : value && typeof value === 'object' ? Object.fromEntries(Object.entries(value).map(([k, v]) => [k, clone(v)])) : value

// smaller plans: each property of each object dropped from both the schema and the value, each
// array item dropped from the value. A $ref is not entered, its definition is shared
function variants (plan) {
  const out = []
  // steps into the value and into the schema for the same place
  const walk = (schema, value, valuePath, schemaPath) => {
    if ('$ref' in schema || value === null || typeof value !== 'object' || value instanceof Date) return
    if (Array.isArray(value)) {
      value.forEach((item, i) => {
        out.push(without(plan, [...valuePath, i], null))
        if (schema.items) walk(schema.items, item, [...valuePath, i], [...schemaPath, 'items'])
      })
      return
    }
    for (const name of Object.keys(value)) {
      out.push(without(plan, [...valuePath, name], name in (schema.properties || {}) ? [...schemaPath] : null))
      if (schema.properties?.[name]) walk(schema.properties[name], value[name], [...valuePath, name], [...schemaPath, 'properties', name])
    }
  }
  walk(plan.schema, plan.value, [], [])
  return out
}

// the plan with one thing removed: the value at valuePath, and the property named by its last
// step from the object schema at schemaPath, when it is a schema property
function without (plan, valuePath, schemaPath) {
  const value = clone(plan.value)
  const schema = clone(plan.schema)
  const name = valuePath[valuePath.length - 1]
  let at = { v: value }
  let key = 'v'
  for (const step of valuePath.slice(0, -1)) {
    at = at[key]
    key = step
  }
  if (Array.isArray(at[key])) at[key].splice(name, 1)
  else delete at[key][name]
  if (schemaPath) {
    let target = schema
    for (const step of schemaPath) target = target[step]
    delete target.properties[name]
    if (target.required) {
      target.required = target.required.filter((r) => r !== name)
      if (!target.required.length) delete target.required
    }
  }
  return { schema, value }
}

const show = (value) => JSON.stringify(showable(value))
const showable = (v) => v instanceof Date ? `new Date(${v.getTime()})` : Array.isArray(v) ? v.map(showable) : v && typeof v === 'object' ? Object.fromEntries(Object.entries(v).map(([k, x]) => [k, showable(x)])) : v
function source (plan) {
  const { definitions, ...schema } = plan.schema
  return `schema: ${JSON.stringify(schema)}
value:  ${show(plan.value)}`
}

module.exports = { draw, expected, render, variants, source, DEFINITIONS }
