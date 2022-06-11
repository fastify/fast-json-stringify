const fs = require('fs')
const path = require('path')

function buildStandaloneCode (options, ajvInstance, contextFunctionCode) {
  const serializerCode = fs.readFileSync(path.join(__dirname, 'serializer.js')).toString()
  let buildAjvCode = ''
  let defaultAjvSchema = ''
  const defaultMeta = ajvInstance.defaultMeta()
  if (typeof defaultMeta === 'string') {
    defaultAjvSchema = defaultMeta
  } else {
    defaultAjvSchema = defaultMeta.$id || defaultMeta.id
  }
  const shouldUseAjv = contextFunctionCode.indexOf('ajv') !== -1
  // we need to export the custom json schema
  let ajvSchemasCode = ''
  if (shouldUseAjv) {
    ajvSchemasCode += `const ajv = buildAjv(${JSON.stringify(options.ajv || {})})\n`
    for (const [id, schema] of Object.entries(ajvInstance.schemas)) {
      // should skip ajv default schema
      if (id === defaultAjvSchema) continue
      ajvSchemasCode += `ajv.addSchema(${JSON.stringify(schema.schema)}, "${id}")\n`
    }
    buildAjvCode = fs.readFileSync(path.join(__dirname, 'ajv.js')).toString()
    buildAjvCode = buildAjvCode.replace("'use strict'", '').replace('module.exports = buildAjv', '')
  }
  return `
  'use strict'

  ${serializerCode.replace("'use strict'", '').replace('module.exports = ', '')}
  ${buildAjvCode}

  const serializer = new Serializer(${JSON.stringify(options || {})})
  ${ajvSchemasCode}

  ${contextFunctionCode.replace('return main', '')}

  module.exports = main
      `
}

module.exports = buildStandaloneCode
