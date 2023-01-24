const fs = require('fs')
const path = require('path')

function buildStandaloneCode (options, validator, isValidatorUsed, contextFunctionCode) {
  const serializerCode = fs.readFileSync(path.join(__dirname, 'serializer.js')).toString()
  let buildAjvCode = ''
  let ajvSchemasCode = ''

  if (isValidatorUsed) {
    let defaultAjvSchema = ''
    // we need to export the custom json schema
    const defaultMeta = validator.ajv.defaultMeta()
    if (typeof defaultMeta === 'string') {
      defaultAjvSchema = defaultMeta
    } else {
      defaultAjvSchema = defaultMeta.$id || defaultMeta.id
    }

    ajvSchemasCode += `const validator = new Validator(${JSON.stringify(options.ajv || {})})\n`
    for (const [id, schema] of Object.entries(validator.ajv.schemas)) {
      // should skip ajv default schema
      if (id === defaultAjvSchema) continue
      ajvSchemasCode += `validator.ajv.addSchema(${JSON.stringify(schema.schema)}, "${id}")\n`
    }
    buildAjvCode = fs.readFileSync(path.join(__dirname, 'validator.js')).toString()
    buildAjvCode = buildAjvCode.replace("'use strict'", '').replace('module.exports = SchemaValidator', '')
  }

  const serializerOptions = options && options.rounding ? JSON.stringify({ options: options.rounding }) : ''
  return `
  'use strict'
  ${serializerCode.replace("'use strict'", '').replace('module.exports = ', '')}
  ${buildAjvCode}
  const serializer = new Serializer(${serializerOptions})
  ${ajvSchemasCode}

  ${contextFunctionCode.replace('return main', '')}

  module.exports = main`
}

module.exports = buildStandaloneCode
