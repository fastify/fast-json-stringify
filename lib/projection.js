'use strict'

// Projection strategy (objectMechanism: 'native').
//
// Instead of building the JSON string in generated JS, project the input into
// preallocated "scratch" objects whose keys are exactly the schema properties,
// in schema order, and hand the scratch to the native JSON.stringify. The
// scratch is clean by construction (no extra properties, no Date, no toJSON,
// standard prototypes), so V8's side-effect-free fast path (V8 13.8+) is
// always taken, even when the user's input would have bailed out of it.
//
// Projectable schemas (every node must be one of these):
//   - object with `properties` only: no additionalProperties, patternProperties,
//     nullable, combinators, $ref, dependencies; at least one property;
//   - string / number / integer / boolean without nullable, const, enum,
//     combinators, $ref; string may have format date-time / date / time;
//   - the two-element forms ['string'|'number'|'boolean', 'null'] (any order),
//     with the strict no-coercion dispatch of the multi-type codegen;
//     ['integer', 'null'] is left to the codegen (its null handling depends
//     on the type order);
//   - array whose `items` is a single projectable schema (not a tuple); array
//     elements get their own scratch tree from a per-element slot pool.
// Anything else makes buildProjection return null and the caller falls back to
// the string codegen, so the option never changes output for unsupported
// schemas.
//
// Semantics match the string codegen byte for byte: input.toJSON() honoured,
// `required` missing throws, `undefined` omitted, `default` applied, null
// string -> "", null number -> 0, null object -> {}, Date in a string -> ISO,
// numbers via the asNumber/asInteger rules, booleans via truthiness.

const PRIMITIVES = new Set(['string', 'number', 'integer', 'boolean'])
const STRING_FORMATS = new Set([undefined, 'date-time', 'date', 'time'])

// ['string'|'number'|'boolean', 'null'] in either order -> the non-null type;
// anything else -> null. Also requires the format rules of the base type.
function nullableMultiType (schema) {
  const t = schema.type
  if (!Array.isArray(t) || t.length !== 2 || !t.includes('null')) return null
  const base = t[0] === 'null' ? t[1] : t[0]
  if (base !== 'string' && base !== 'number' && base !== 'boolean') return null
  if (base === 'string' ? !STRING_FORMATS.has(schema.format) : schema.format !== undefined) return null
  return base
}

function hasDispatchKeyword (s) {
  return s.nullable === true || s.const !== undefined || s.enum !== undefined ||
    s.allOf !== undefined || s.anyOf !== undefined || s.oneOf !== undefined ||
    s.if !== undefined || s.$ref !== undefined
}

function isProjectable (schema, depth = 0) {
  if (typeof schema !== 'object' || schema === null || depth > 32) return false
  if (hasDispatchKeyword(schema)) return false
  if (Array.isArray(schema.type)) return nullableMultiType(schema) !== null

  if (schema.type === 'object') {
    if (schema.additionalProperties !== undefined || schema.patternProperties !== undefined ||
        schema.dependencies !== undefined ||
        typeof schema.properties !== 'object' || schema.properties === null) {
      return false
    }
    const keys = Object.keys(schema.properties)
    if (keys.length === 0) return false
    for (const key of keys) {
      if (!isProjectable(schema.properties[key], depth + 1)) return false
    }
    return true
  }

  if (schema.type === 'array') {
    if (schema.items === undefined || Array.isArray(schema.items) || schema.additionalItems !== undefined) return false
    return isProjectable(schema.items, depth + 1)
  }

  if (!PRIMITIVES.has(schema.type)) return false
  if (schema.type === 'string') return STRING_FORMATS.has(schema.format)
  return schema.format === undefined
}

function primitiveExpr (schema, src, pointerIdx) {
  const base = nullableMultiType(schema)
  if (base !== null) {
    // Same acceptance rules as the multi-type codegen (buildMultiTypeSerializer):
    // null passes through; a matching primitive goes through the single-type
    // conversion; anything else is a TypeError. No coercion across types.
    const err = `typeMismatch(${pointerIdx})`
    const single = primitiveExpr({ ...schema, type: base }, src, pointerIdx)
    if (base === 'string') {
      return `(${src} === null ? null : (typeof ${src} === 'string' || ${src} instanceof Date || ${src} instanceof RegExp || (typeof ${src} === 'object' && typeof ${src}.toString === 'function' && ${src}.toString !== Object.prototype.toString)) ? ${single} : ${err})`
    }
    if (base === 'number') {
      return `(${src} === null ? null : typeof ${src} === 'number' ? ${single} : ${err})`
    }
    return `(${src} === null ? null : typeof ${src} === 'boolean' ? ${src} : ${err})`
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
    this.decls = []
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

  scratchLiteral (schema) {
    return '{ ' + orderedKeys(schema).map((k) => `${JSON.stringify(k)}: undefined`).join(', ') + ' }'
  }

  // Scratch storage for a schema node. Nodes reachable without crossing an
  // array are module-level constants (one per serializer). Nodes inside array
  // items live in a per-slot holder object created by a generated factory, so
  // that each array element has its own scratch tree.
  //
  // `holder` is null at the top level (declare constants) or the expression of
  // the current slot holder; `slotFields` collects the holder's fields.
  allocScratch (schema, holder, slotFields) {
    if (holder === null) {
      const name = this.id('scratch')
      this.decls.push(`const ${name} = ${this.scratchLiteral(schema)}`)
      return name
    }
    const field = this.id('s')
    slotFields.push([field, this.scratchLiteral(schema)])
    return `${holder}.${field}`
  }

  allocArray (holder, slotFields) {
    if (holder === null) {
      const name = this.id('arr')
      this.decls.push(`const ${name} = []`)
      return name
    }
    const field = this.id('a')
    slotFields.push([field, '[]'])
    return `${holder}.${field}`
  }

  fillObject (schema, src, dst, out, indent, pointer, holder, slotFields) {
    const props = schema.properties
    const requiredList = schema.required || []
    const required = new Set(requiredList)
    const keys = orderedKeys(schema)
    const o = this.id('o')
    out.push(`${indent}const ${o} = (${src} !== null && typeof ${src} === 'object' && typeof ${src}.toJSON === 'function') ? ${src}.toJSON() : ${src}`)
    out.push(`${indent}if (${o} === null) {`)
    for (const k of keys) out.push(`${indent}  ${dst}[${JSON.stringify(k)}] = undefined`)
    out.push(`${indent}} else {`)
    for (const k of requiredList) {
      if (props[k] === undefined) {
        out.push(`${indent}  if (${o}[${JSON.stringify(k)}] === undefined) requiredMissing(${this.keyIndex(k)})`)
      }
    }
    for (const k of keys) {
      const p = props[k]
      const ks = JSON.stringify(k)
      const v = this.id('v')
      out.push(`${indent}  const ${v} = ${o}[${ks}]`)
      out.push(`${indent}  if (${v} === undefined) {`)
      if (required.has(k)) {
        out.push(`${indent}    requiredMissing(${this.keyIndex(k)})`)
      } else if (p.default !== undefined) {
        out.push(`${indent}    ${dst}[${ks}] = ${JSON.stringify(p.default)}`)
      } else {
        out.push(`${indent}    ${dst}[${ks}] = undefined`)
      }
      out.push(`${indent}  } else {`)
      out.push(`${indent}    ${dst}[${ks}] = ${this.valueExpr(p, v, out, indent + '    ', `${pointer}/properties/${k}`, holder, slotFields)}`)
      out.push(`${indent}  }`)
    }
    out.push(`${indent}}`)
  }

  // Returns an expression for the projected value of `src`; may push
  // preparatory statements to `out` (filling a nested scratch) first.
  valueExpr (schema, src, out, indent, pointer, holder, slotFields) {
    if (schema.type === 'object') {
      const scratch = this.allocScratch(schema, holder, slotFields)
      this.fillObject(schema, src, scratch, out, indent, pointer, holder, slotFields)
      return scratch
    }
    if (schema.type === 'array') {
      const pool = this.allocArray(holder, slotFields)
      this.fillArray(schema, src, pool, out, indent, pointer, holder, slotFields)
      return pool
    }
    return primitiveExpr(schema, src, this.pointerIndex(pointer))
  }

  fillArray (schema, src, pool, out, indent, pointer, holder, slotFields) {
    const items = schema.items
    const n = this.id('n')
    const i = this.id('i')
    out.push(`${indent}if (${src} === null) {`)
    out.push(`${indent}  ${pool}.length = 0`)
    out.push(`${indent}} else {`)
    out.push(`${indent}  if (!Array.isArray(${src})) typeMismatch(${this.pointerIndex(pointer)})`)
    out.push(`${indent}  const ${n} = ${src}.length`)
    out.push(`${indent}  ${pool}.length = ${n}`)
    if (items.type === 'object' || items.type === 'array') {
      // Pool of per-element slot holders; each holder owns the scratch tree of
      // one element (nested objects and arrays included). Grows to the longest
      // array seen, never shrinks. When this array is itself inside an array
      // element, its slot pool lives in the enclosing holder, so sibling
      // elements never share scratch objects.
      const slots = this.allocArray(holder, slotFields)
      const factory = this.id('makeSlot')
      const el = this.id('el')
      const innerHolder = this.id('slot')
      const innerFields = []
      const inner = []
      const expr = this.valueExpr(items, el, inner, indent + '    ', `${pointer}/items`, innerHolder, innerFields)
      this.decls.push(`function ${factory} () { return { ${innerFields.map(([f, lit]) => `${f}: ${lit}`).join(', ')} } }`)
      out.push(`${indent}  for (let ${i} = ${slots}.length; ${i} < ${n}; ${i}++) ${slots}[${i}] = ${factory}()`)
      out.push(`${indent}  for (let ${i} = 0; ${i} < ${n}; ${i}++) {`)
      out.push(`${indent}    const ${el} = ${src}[${i}]`)
      out.push(`${indent}    const ${innerHolder} = ${slots}[${i}]`)
      out.push(...inner)
      out.push(`${indent}    ${pool}[${i}] = ${expr}`)
      out.push(`${indent}  }`)
    } else {
      out.push(`${indent}  for (let ${i} = 0; ${i} < ${n}; ${i}++) {`)
      out.push(`${indent}    ${pool}[${i}] = ${primitiveExpr(items, `${src}[${i}]`, this.pointerIndex(`${pointer}/items`))}`)
      out.push(`${indent}  }`)
    }
    out.push(`${indent}}`)
  }
}

// Returns the full body of the context function (declarations + main) or null
// when the schema is not projectable.
function buildProjection (schema) {
  if (!isProjectable(schema)) return null
  if (schema.type !== 'object' && schema.type !== 'array') return null // primitive roots gain nothing
  const em = new Emitter()
  const body = []
  const rootExpr = em.valueExpr(schema, 'input', body, '      ', '#', null, null)
  // root object: a null input serializes as {} (same as the codegen)
  body.push(`      return JSON.stringify(${rootExpr})`)
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
    ${em.decls.join('\n    ')}
    function main (input) {
${body.join('\n')}
    }
    return main
  `
}

// Runtime helpers mirroring lib/serializer.js, returning values (not JSON text)
// to be placed into the scratch.
const projectionHelpers = `
  const asStringValue = (v) => {
    if (typeof v === 'string') return v
    if (v === null) return ''
    if (v instanceof Date) return v.toISOString()
    if (v instanceof RegExp) return v.source
    return v.toString()
  }
  const asDateTimeValue = (v) => {
    if (v === null) return ''
    if (v instanceof Date) return v.toISOString()
    if (typeof v === 'string') return v
    return v.toString()
  }
  const asDateValue = (v) => { const s = serializer.asDate(v); return s.slice(1, -1) }
  const asTimeValue = (v) => { const s = serializer.asTime(v); return s.slice(1, -1) }
  const asNumberValue = (v) => {
    const num = typeof v === 'number' ? v : Number(v)
    if (num !== num) throw new Error('The value "' + v + '" cannot be converted to a number.')
    return (num === Infinity || num === -Infinity) ? null : num
  }
  const asIntegerValue = (v) => {
    if (Number.isInteger(v)) return v
    if (typeof v === 'bigint') return Number(v)
    return Number(serializer.asInteger(v))
  }
`

module.exports = { buildProjection, isProjectable }
