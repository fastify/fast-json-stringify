'use strict'

// Projection strategy (objectMechanism: 'native').
//
// Instead of building the JSON string in generated JS, project the input into
// new objects whose keys are exactly the schema properties, in schema order,
// and hand them to the native JSON.stringify. The projected objects are clean
// by construction (no extra properties, no Date, no toJSON, standard
// prototypes), so V8's side-effect-free fast path (V8 13.8+) is always taken,
// even when the user's input would have bailed out of it.
//
// The projected objects are created by each call and dropped when it returns:
// a serializer keeps no data between calls, and a call that starts while
// another one is running (a getter or a toJSON() of the input serializing with
// the same function) shares nothing with it.
//
// Projectable schemas (every node must be one of these):
//   - object with `properties` only: no patternProperties, combinators,
//     dependencies, and additionalProperties absent or false; at least one
//     property;
//   - string / number / integer / boolean without const or combinators;
//     a string may have any format but 'unsafe', which is written unescaped;
//   - the two-element forms ['string'|'number'|'boolean', 'null'] (any order),
//     with the strict no-coercion dispatch of the multi-type codegen;
//     ['integer', 'null'] is left to the codegen (its null handling depends
//     on the type order);
//   - array whose `items` is a single projectable schema (not a tuple).
// Any of them may be `nullable: true` (null is then written as null) and may
// carry an `enum`, which the codegen does not use once the type is known.
// Any of them may be reached through a $ref, to the same schema or to an
// external one, as long as the $ref has no keyword next to it that the codegen
// would merge and the target is not recursive.
// Anything else makes buildProjection return null and the caller falls back to
// the string codegen, so the option never changes output for unsupported
// schemas.
//
// Semantics match the string codegen byte for byte: input.toJSON() honoured,
// `required` missing throws, `undefined` omitted, `default` applied, null
// string -> "", null number -> 0, null object -> {}, Date in a string -> ISO,
// numbers via the asNumber/asInteger rules, booleans via truthiness.

const PRIMITIVES = new Set(['string', 'number', 'integer', 'boolean'])

// ['string'|'number'|'boolean', 'null'] in either order -> the non-null type;
// anything else -> null. A format only matters for a string.
function nullableMultiType (schema) {
  const t = schema.type
  if (!Array.isArray(t) || t.length !== 2 || !t.includes('null')) return null
  const base = t[0] === 'null' ? t[1] : t[0]
  if (base !== 'string' && base !== 'number' && base !== 'boolean') return null
  if (base === 'string' && schema.format === 'unsafe') return null
  return base
}

function hasDispatchKeyword (s) {
  return s.const !== undefined || s.allOf !== undefined || s.anyOf !== undefined ||
    s.oneOf !== undefined || s.if !== undefined
}

// The JSON.stringify fast path of V8 handles objects with up to 127
// properties. From 128 the projected object is serialized on the slow path,
// and the projection is slower than the codegen instead of faster, so an
// object with more properties than this is left to the codegen.
const MAX_PROPERTIES = 127

// The JSON pointer of a projected node, as the codegen writes it in its errors.
const POINTER = Symbol('pointer')

// A $ref is projected by expanding its target in place, so a schema that is
// used many times is also copied many times. Past this number of expanded
// nodes the schema is left to the codegen, which shares one function per schema.
const MAX_REF_NODES = 1000

// Returns a copy of the schema at `location`, with every $ref replaced by its
// target and every node tagged with its JSON pointer, or null when the schema
// is not projectable.
function resolveProjectable (location, refs, state, depth) {
  const schema = location.schema
  if (typeof schema !== 'object' || schema === null || depth > 32) return null

  // truthiness, as in the codegen: an empty $ref is not a reference
  if (!schema.$ref) return resolveNode(location, refs, state, depth)

  // the codegen merges the keywords next to a $ref with its target
  for (const key in schema) {
    if (!refs.ignoredSiblings.has(key)) return null
  }
  location = refs.resolve(location)

  // a target that is already being expanded is a recursive schema
  const target = location.getSchemaRef()
  if (state.open.has(target)) return null
  state.open.add(target)
  const node = resolveNode(location, refs, state, depth)
  state.open.delete(target)
  return node
}

function resolveNode (location, refs, state, depth) {
  const schema = location.schema
  if (state.open.size !== 0 && ++state.refNodes > MAX_REF_NODES) return null
  if (hasDispatchKeyword(schema)) return null

  const node = { ...schema, [POINTER]: refs.pointer(location) }
  if (Array.isArray(schema.type)) return nullableMultiType(schema) !== null ? node : null

  if (schema.type === 'object') {
    if ((schema.additionalProperties !== undefined && schema.additionalProperties !== false) ||
        schema.patternProperties !== undefined ||
        schema.dependencies !== undefined ||
        typeof schema.properties !== 'object' || schema.properties === null) {
      return null
    }
    const keys = Object.keys(schema.properties)
    if (keys.length === 0 || keys.length > MAX_PROPERTIES) return null
    const propertiesLocation = location.getPropertyLocation('properties')
    node.properties = Object.create(null)
    for (const key of keys) {
      const property = resolveProjectable(propertiesLocation.getPropertyLocation(key), refs, state, depth + 1)
      if (property === null) return null
      node.properties[key] = property
    }
    return node
  }

  if (schema.type === 'array') {
    if (schema.items === undefined || Array.isArray(schema.items) || schema.additionalItems !== undefined) return null
    node.items = resolveProjectable(location.getPropertyLocation('items'), refs, state, depth + 1)
    return node.items !== null ? node : null
  }

  if (!PRIMITIVES.has(schema.type)) return null
  // the codegen reads `format` only for a string
  return schema.type !== 'string' || schema.format !== 'unsafe' ? node : null
}

function primitiveExpr (schema, src, pointerIdx) {
  const base = nullableMultiType(schema)
  if (base !== null) {
    // Same acceptance rules as the multi-type codegen (buildMultiTypeSerializer):
    // null passes through; a matching primitive goes through the single-type
    // conversion; anything else is a TypeError. No coercion across types.
    const err = `typeMismatch(${pointerIdx})`
    const single = primitiveExpr({ ...schema, type: base, nullable: false }, src, pointerIdx)
    if (base === 'string') {
      return `(${src} === null ? null : (typeof ${src} === 'string' || ${src} instanceof Date || ${src} instanceof RegExp || (typeof ${src} === 'object' && typeof ${src}.toString === 'function' && ${src}.toString !== Object.prototype.toString)) ? ${single} : ${err})`
    }
    if (base === 'number') {
      return `(${src} === null ? null : typeof ${src} === 'number' ? ${single} : ${err})`
    }
    return `(${src} === null ? null : typeof ${src} === 'boolean' ? ${src} : ${err})`
  }
  if (schema.nullable === true) {
    return `(${src} === null ? null : ${primitiveExpr({ ...schema, nullable: false }, src, pointerIdx)})`
  }
  switch (schema.type) {
    case 'string':
      if (schema.format === 'date-time') return `asDateTimeValue(${src})`
      if (schema.format === 'date') return `asDateValue(${src})`
      if (schema.format === 'time') return `asTimeValue(${src})`
      return `asStringValue(${src})`
    case 'number': return `asNumberValue(${src})`
    case 'integer': return `asIntegerValue(${src})`
    case 'boolean': return `(${src} ? true : false)`
  }
}

// Same order as the string codegen: required properties first (stable sort).
function orderedKeys (schema) {
  const required = schema.required || []
  return Object.keys(schema.properties).sort((a, b) => {
    const ra = required.includes(a); const rb = required.includes(b)
    return ra === rb ? 0 : ra ? -1 : 1
  })
}

class Emitter {
  constructor () {
    this.uid = 0
    // JSON pointers for error messages. The generated code only ever refers
    // to them by index into this table (emitted as a JSON literal), so no
    // schema-derived text is interpolated into the code itself.
    this.pointers = []
    this.keys = []
  }

  id (prefix) { return `${prefix}_${this.uid++}` }

  pointerIndex (pointer) {
    let i = this.pointers.indexOf(pointer)
    if (i === -1) { i = this.pointers.length; this.pointers.push(pointer) }
    return i
  }

  keyIndex (key) {
    let i = this.keys.indexOf(key)
    if (i === -1) { i = this.keys.length; this.keys.push(key) }
    return i
  }

  // Pushes the statements that project `src` as an object and returns the
  // variable that holds the result: a new object with every property of the
  // schema, in the order of the codegen. A missing property is undefined,
  // which JSON.stringify skips; keeping it gives every projected object of a
  // schema the same shape.
  projectObject (schema, src, out, indent) {
    const props = schema.properties
    const requiredList = schema.required || []
    const required = new Set(requiredList)
    const keys = orderedKeys(schema)
    const o = this.id('o')
    const result = this.id('r')
    out.push(`${indent}const ${o} = (${src} !== null && typeof ${src} === 'object' && typeof ${src}.toJSON === 'function') ? ${src}.toJSON() : ${src}`)
    out.push(`${indent}let ${result}`)
    out.push(`${indent}if (${o} === null) {`)
    // a null input is written as {} (same as the codegen), or as null when nullable
    out.push(`${indent}  ${result} = ${schema.nullable === true ? 'null' : '{}'}`)
    out.push(`${indent}} else {`)
    for (const k of requiredList) {
      if (props[k] === undefined) {
        out.push(`${indent}  if (${o}[${JSON.stringify(k)}] === undefined) requiredMissing(${this.keyIndex(k)})`)
      }
    }
    const entries = []
    for (const k of keys) {
      const p = props[k]
      const ks = JSON.stringify(k)
      const v = this.id('v')
      const value = this.id('p')
      // Same precedence as the codegen: a default satisfies a required key.
      const missing = p.default !== undefined
        ? JSON.stringify(p.default)
        : required.has(k) ? `requiredMissing(${this.keyIndex(k)})` : 'undefined'
      out.push(`${indent}  const ${v} = ${o}[${ks}]`)
      if (p.type === 'object' || p.type === 'array') {
        out.push(`${indent}  let ${value}`)
        out.push(`${indent}  if (${v} === undefined) {`)
        out.push(`${indent}    ${value} = ${missing}`)
        out.push(`${indent}  } else {`)
        out.push(`${indent}    ${value} = ${this.valueExpr(p, v, out, indent + '    ')}`)
        out.push(`${indent}  }`)
      } else {
        out.push(`${indent}  const ${value} = ${v} === undefined ? ${missing} : ${this.valueExpr(p, v, out, indent + '  ')}`)
      }
      // in an object literal "__proto__" sets the prototype: a computed key
      // defines a property with that name instead
      entries.push(k === '__proto__' ? `[${ks}]: ${value}` : `${ks}: ${value}`)
    }
    out.push(`${indent}  ${result} = { ${entries.join(', ')} }`)
    out.push(`${indent}}`)
    return result
  }

  // Returns an expression for the projected value of `src`; may push
  // statements to `out` that must run before the expression is evaluated.
  valueExpr (schema, src, out, indent) {
    if (schema.type === 'object') return this.projectObject(schema, src, out, indent)
    if (schema.type === 'array') return this.projectArray(schema, src, out, indent)
    return primitiveExpr(schema, src, this.pointerIndex(schema[POINTER]))
  }

  // Pushes the statements that project `src` as an array and returns the
  // variable that holds the result: a new array with one projected value per
  // element.
  projectArray (schema, src, out, indent) {
    const items = schema.items
    const n = this.id('n')
    const i = this.id('i')
    const result = this.id('r')
    out.push(`${indent}let ${result}`)
    out.push(`${indent}if (${src} === null) {`)
    // a null input is written as [] (same as the codegen), or as null when nullable
    out.push(`${indent}  ${result} = ${schema.nullable === true ? 'null' : '[]'}`)
    out.push(`${indent}} else {`)
    out.push(`${indent}  if (!Array.isArray(${src})) typeMismatch(${this.pointerIndex(schema[POINTER])})`)
    out.push(`${indent}  const ${n} = ${src}.length`)
    out.push(`${indent}  ${result} = new Array(${n})`)
    out.push(`${indent}  for (let ${i} = 0; ${i} < ${n}; ${i}++) {`)
    if (items.type === 'object' || items.type === 'array') {
      const el = this.id('el')
      out.push(`${indent}    const ${el} = ${src}[${i}]`)
      out.push(`${indent}    ${result}[${i}] = ${this.valueExpr(items, el, out, indent + '    ')}`)
    } else {
      out.push(`${indent}    ${result}[${i}] = ${primitiveExpr(items, `${src}[${i}]`, this.pointerIndex(items[POINTER]))}`)
    }
    out.push(`${indent}  }`)
    out.push(`${indent}}`)
    return result
  }
}

// Returns the full body of the context function (declarations + main) or null
// when the schema at `location` is not projectable. `refs` is how the codegen
// reads a $ref: `resolve(location)` gives the location of its target,
// `pointer(location)` the JSON pointer used in the errors, `ignoredSiblings`
// the keywords that may stand next to a $ref without changing its target.
function buildProjection (location, refs) {
  const schema = resolveProjectable(location, refs, { open: new Set(), refNodes: 0 }, 0)
  if (schema === null) return null
  if (schema.type !== 'object' && schema.type !== 'array') return null // primitive roots gain nothing
  const em = new Emitter()
  const body = []
  const rootExpr = em.valueExpr(schema, 'input', body, '      ')
  // A BigInt outside the safe integer range has no exact Number, so it is
  // kept as a BigInt in the projected value and flagged: that value (never the
  // input, which has already been read once) is then serialized by a small
  // walker that writes the digits, as the codegen does. The flag is shared by
  // the calls of a serializer, so a call that runs inside another one may
  // clear the flag of the outer call: the outer call then finds out because
  // JSON.stringify throws, and falls back to the walker.
  return `
    ${projectionHelpers}
    const POINTERS = ${JSON.stringify(em.pointers)}
    const KEYS = ${JSON.stringify(em.keys)}
    function typeMismatch (i) {
      throw new TypeError("The value of '" + POINTERS[i] + "' does not match schema definition.")
    }
    function requiredMissing (i) {
      throw new Error('"' + KEYS[i] + '" is required!')
    }
    let hasBigInt = false
    const asIntegerValue = (v) => {
      if (Number.isInteger(v)) return v
      if (typeof v !== 'bigint') return Number(serializer.asInteger(v))
      if (v >= MIN_SAFE_BIGINT && v <= MAX_SAFE_BIGINT) return Number(v)
      hasBigInt = true
      return v
    }
    function main (input) {
${body.join('\n')}
      if (hasBigInt) {
        hasBigInt = false
        return stringifyWithBigInt(${rootExpr})
      }
      try {
        return JSON.stringify(${rootExpr})
      } catch {
        return stringifyWithBigInt(${rootExpr})
      }
    }
    return main
  `
}

// Runtime helpers mirroring lib/serializer.js, returning values (not JSON text)
// to be placed into the projected objects.
const projectionHelpers = `
  const asStringValue = (v) => {
    if (typeof v === 'string') return v
    if (v === null) return ''
    if (v instanceof Date) return serializer.asDateTimeValue(v)
    if (v instanceof RegExp) return v.source
    return v.toString()
  }
  const asDateTimeValue = (v) => {
    if (v === null) return ''
    if (v instanceof Date) return serializer.asDateTimeValue(v)
    if (typeof v === 'string') return v
    throw new Error('The value "' + v + '" cannot be converted to a date-time.')
  }
  // serializer.asDate/asTime return JSON text: for a string input that text is
  // already escaped, so the string itself is projected and is escaped
  // once, by JSON.stringify.
  const asDateValue = (v) => typeof v === 'string' ? v : serializer.asDate(v).slice(1, -1)
  const asTimeValue = (v) => typeof v === 'string' ? v : serializer.asTime(v).slice(1, -1)
  const asNumberValue = (v) => {
    const num = typeof v === 'number' ? v : Number(v)
    if (num !== num) throw new Error('The value "' + v + '" cannot be converted to a number.')
    return (num === Infinity || num === -Infinity) ? null : num
  }
  const MAX_SAFE_BIGINT = BigInt(Number.MAX_SAFE_INTEGER)
  const MIN_SAFE_BIGINT = -MAX_SAFE_BIGINT
  // Serializes a projected value that holds a BigInt, the one value the native
  // JSON.stringify rejects. A projected value is made of plain objects, arrays,
  // strings, numbers, booleans, null and undefined, so nothing else needs
  // handling.
  const stringifyWithBigInt = (v) => {
    if (typeof v === 'bigint') return v.toString()
    if (v === null || typeof v !== 'object') return JSON.stringify(v)
    let json = ''
    if (Array.isArray(v)) {
      for (let i = 0; i < v.length; i++) {
        json += (i === 0 ? '[' : ',') + stringifyWithBigInt(v[i])
      }
      return json === '' ? '[]' : json + ']'
    }
    for (const key of Object.keys(v)) {
      const value = v[key]
      if (value !== undefined) {
        json += (json === '' ? '{' : ',') + JSON.stringify(key) + ':' + stringifyWithBigInt(value)
      }
    }
    return json === '' ? '{}' : json + '}'
  }
`

module.exports = { buildProjection }
