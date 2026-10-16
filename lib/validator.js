'use strict'

const Ajv = require('ajv')
const { _ } = Ajv
const fastUri = require('fast-uri')
const ajvFormats = require('ajv-formats')
const clone = require('rfdc')({ proto: true })

const schemaKeywords = new Set([
  'additionalItems', 'items', 'contains', 'additionalProperties',
  'propertyNames', 'not', 'if', 'then', 'else'
])
const schemaArrayKeywords = new Set(['items', 'allOf', 'anyOf', 'oneOf'])
const schemaMapKeywords = new Set([
  '$defs', 'definitions', 'properties', 'patternProperties', 'dependencies'
])

class Validator {
  constructor (ajvOptions, inlineValidators) {
    const codeOptions = inlineValidators
      ? { code: { ...ajvOptions?.code, source: true, esm: false } }
      : {}

    this.ajv = new Ajv({
      ...ajvOptions,
      ...codeOptions,
      strictSchema: false,
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

  addSchema (schema, schemaName) {
    let schemaKey = schema.$id || schemaName
    if (schema.$id !== undefined && schema.$id[0] === '#') {
      schemaKey = schemaName + schema.$id // relative URI
    }

    if (
      this.ajv.refs[schemaKey] === undefined &&
      this.ajv.schemas[schemaKey] === undefined
    ) {
      const ajvSchema = clone(schema)
      this.convertSchemaToAjvFormat(ajvSchema)
      this.ajv.addSchema(ajvSchema, schemaKey)
      this._ajvSchemas[schemaKey] = schema
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
  convertSchemaToAjvFormat (schema) {
    if (schema === null || typeof schema !== 'object' || Array.isArray(schema)) return

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
      const value = schema[property]
      // Only traverse subschemas. Objects in const, enum, default, etc. are
      // data, even when they contain a property called "type".
      if (schemaArrayKeywords.has(property) && Array.isArray(value)) {
        for (const item of value) this.convertSchemaToAjvFormat(item)
      } else if (schemaMapKeywords.has(property)) {
        if (value !== null && typeof value === 'object') {
          for (const key in value) this.convertSchemaToAjvFormat(value[key])
        }
      } else if (schemaKeywords.has(property)) {
        this.convertSchemaToAjvFormat(value)
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
