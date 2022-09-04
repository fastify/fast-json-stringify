'use strict'

const Ajv = require('ajv')
const ajvFormats = require('ajv-formats')

function validate (data, schema, externalSchemas) {
  const ajv = new Ajv({
    strictSchema: false,
    validateSchema: true,
    allowUnionTypes: true
  })

  ajvFormats(ajv)

  if (externalSchemas !== undefined) {
    for (const externalSchema of externalSchemas) {
      ajv.addSchema(externalSchema)
    }
  }

  return ajv.validate(schema, data)
}

module.exports = { validate }
