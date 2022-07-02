'use strict'

const Ajv = require('ajv')
const fastUri = require('fast-uri')
const ajvFormats = require('ajv-formats')

module.exports = buildAjv

function buildAjv (options) {
  const ajvInstance = new Ajv({
    ...options,
    strictSchema: false,
    validateSchema: false,
    allowUnionTypes: true,
    uriResolver: fastUri
  })

  ajvFormats(ajvInstance)

  ajvInstance.addKeyword({
    keyword: 'fjs_type',
    type: 'object',
    errors: false,
    validate: (type, date) => {
      return date instanceof Date
    }
  })

  return ajvInstance
}
