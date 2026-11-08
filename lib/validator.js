'use strict'

const Ajv = require('ajv')
const { _ } = Ajv
const fastUri = require('fast-uri')
const ajvFormats = require('ajv-formats')
const clone = require('rfdc')({ proto: true })

// Ajv resolves a $ref's JSON pointer by url-decoding each segment, so a
// definition whose key is itself percent-encoded (e.g. `Some%3Cloremipsum%3E`)
// can no longer be found: the pointer `#/definitions/Some%3Cloremipsum%3E`
// decodes to `Some<loremipsum>`, which does not match the literal key.
// Re-encoding the `%` in the fragment makes Ajv's single decode round-trip
// back to the original key. See https://github.com/fastify/fast-json-stringify/issues/740
function escapeRefForAjv (ref) {
  const hashIndex = ref.indexOf('#')
  if (hashIndex === -1) return ref
  return ref.slice(0, hashIndex) + ref.slice(hashIndex).replace(/%/g, '%25')
}

// A user-written $ref is ambiguous: `#/definitions/a%20b` may point at the
// literal key `a%20b` (how fast-json-stringify's own resolver reads it) or, per
// RFC 6901, at the key `a b` (how Ajv reads it). Escape it for Ajv only when a
// literal target exists, so refs that FJS itself can resolve keep FJS semantics
// while spec-encoded refs that only Ajv sees (if/then/else, nested anyOf) keep
// resolving as before.
// Every schema id reachable from the build is already registered in the
// resolver (unknown ids are rejected while traversing the schema), so
// getSchema() can only return a schema or null here, never throw.
function hasLiteralRefTarget (ref, schemaId, refResolver) {
  const hashIndex = ref.indexOf('#')
  if (hashIndex === -1) return false
  const targetSchemaId = ref.slice(0, hashIndex) || schemaId
  return refResolver.getSchema(targetSchemaId, ref.slice(hashIndex)) !== null
}

// Keywords whose value is a map of <name> -> schema rather than a schema.
// Their keys are user-defined, so an entry named "propertyNames" is a
// regular schema and must still be converted.
const SCHEMA_MAP_KEYWORDS = new Set([
  'properties',
  'patternProperties',
  'definitions',
  '$defs',
  'dependentSchemas',
  'dependencies'
])

class Validator {
  constructor (ajvOptions, inlineValidators) {
    const codeOptions = inlineValidators
      ? { code: { ...ajvOptions?.code, source: true, esm: false } }
      : {}

    this.ajv = new Ajv({
      ...ajvOptions,
      ...codeOptions,
      strictSchema: ajvOptions?.strictSchema ?? false,
      validateSchema: false,
      allowUnionTypes: true,
      uriResolver: fastUri
    })

    ajvFormats(this.ajv)

    this.ajv.addKeyword({
      keyword: 'fjs_type',
      type: 'object',
      errors: false,
      code (context) {
        const { data } = context
        context.fail(_`!${data} || typeof ${data}.toJSON !== "function"`)
      }
    })

    this._ajvSchemas = {}
    this._ajvOptions = ajvOptions || {}
  }

  // `refResolver` is the RefResolver that already holds every schema of this
  // build. When given, user-written $refs are escaped for Ajv only if they
  // resolve literally through it; without it every $ref is escaped.
  addSchema (schema, schemaName, refResolver) {
    let schemaKey = schema.$id || schemaName
    if (schema.$id !== undefined && schema.$id[0] === '#') {
      schemaKey = schemaName + schema.$id // relative URI
    }

    if (
      this.ajv.refs[schemaKey] === undefined &&
      this.ajv.schemas[schemaKey] === undefined
    ) {
      const ajvSchema = clone(schema)
      const shouldEscapeRef = refResolver &&
        ((ref) => hasLiteralRefTarget(ref, schemaName, refResolver))
      this.convertSchemaToAjvFormat(ajvSchema, shouldEscapeRef)
      this.ajv.addSchema(ajvSchema, schemaKey)
      this._ajvSchemas[schemaKey] = ajvSchema
    }
  }

  // Ajv compiles a schema lazily, on the first `validate` call for a given ref.
  // That cost would otherwise be paid at serialization time, on the first
  // document that exercises the union/if-then-else branch. Eagerly resolving
  // every ref the generated code can validate against moves it to build time.
  // It must run after every `addSchema` call: compiling resolves $refs, so
  // doing it earlier breaks on forward references.
  compileSchemas (schemaRefs) {
    for (const schemaRef of schemaRefs) {
      this.ajv.getSchema(schemaRef)
    }
  }

  validate (schemaRef, data) {
    return this.ajv.validate(schemaRef, data)
  }

  // Ajv does not natively support JavaScript objects like Date or other types
  // that rely on a custom .toJSON() representation. To properly validate schemas
  // that may contain such objects (e.g. Date, ObjectId, etc.), we replace all
  // occurrences of the string type with a custom keyword fjs_type
  // (see https://github.com/fastify/fast-json-stringify/pull/441)
  // `shouldEscapeRef(ref)` decides whether a $ref is re-encoded for Ajv (see
  // escapeRefForAjv); when omitted every $ref is.
  convertSchemaToAjvFormat (schema, shouldEscapeRef) {
    if (schema === null) return

    if (
      typeof schema.$ref === 'string' &&
      (shouldEscapeRef === undefined || shouldEscapeRef(schema.$ref))
    ) {
      schema.$ref = escapeRefForAjv(schema.$ref)
    }

    if (schema.type === 'string') {
      schema.fjs_type = 'string'
      schema.type = ['string', 'object']
    } else if (
      Array.isArray(schema.type) &&
      schema.type.includes('string') &&
      !schema.type.includes('object')
    ) {
      schema.fjs_type = 'string'
      schema.type.push('object')
    }
    for (const property in schema) {
      if (typeof schema[property] !== 'object') continue
      // propertyNames validates object keys, which are always strings:
      // adding "object" + fjs_type there only triggers Ajv strictTypes warnings
      if (property === 'propertyNames') continue

      if (SCHEMA_MAP_KEYWORDS.has(property)) {
        for (const key in schema[property]) {
          this.convertSchemaToAjvFormat(schema[property][key], shouldEscapeRef)
        }
      } else {
        this.convertSchemaToAjvFormat(schema[property], shouldEscapeRef)
      }
    }
  }

  getState () {
    return {
      ajvOptions: this._ajvOptions,
      ajvSchemas: this._ajvSchemas
    }
  }

  static restoreFromState (state) {
    const validator = new Validator(state.ajvOptions)
    for (const [id, ajvSchema] of Object.entries(state.ajvSchemas)) {
      validator.ajv.addSchema(ajvSchema, id)
    }
    return validator
  }
}

module.exports = Validator
module.exports.escapeRefForAjv = escapeRefForAjv
