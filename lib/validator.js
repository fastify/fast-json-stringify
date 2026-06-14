'use strict'

const Ajv = require('ajv')
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

class Validator {
  constructor (ajvOptions) {
    this.ajv = new Ajv({
      ...ajvOptions,
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
      validate: (_type, data) => {
        return data && typeof data.toJSON === 'function'
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

  validate (schemaRef, data) {
    return this.ajv.validate(escapeRefForAjv(schemaRef), data)
  }

  // Ajv does not natively support JavaScript objects like Date or other types
  // that rely on a custom .toJSON() representation. To properly validate schemas
  // that may contain such objects (e.g. Date, ObjectId, etc.), we replace all
  // occurrences of the string type with a custom keyword fjs_type
  // (see https://github.com/fastify/fast-json-stringify/pull/441)
  convertSchemaToAjvFormat (schema) {
    if (schema === null) return

    if (typeof schema.$ref === 'string') {
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
      if (typeof schema[property] === 'object') {
        this.convertSchemaToAjvFormat(schema[property])
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
