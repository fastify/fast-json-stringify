const fs = require('fs')
const path = require('path')

function buildStandaloneCode (options, ajvInstance, contextFunctionCode) {
  const serializerCode = fs.readFileSync(path.join(__dirname, 'serializer.js')).toString()
  const buildAjvCode = fs.readFileSync(path.join(__dirname, 'ajv.js')).toString()
  let defaultAjvSchema = ''
  const defaultMeta = ajvInstance.defaultMeta()
  if (typeof defaultMeta === 'string') {
    defaultAjvSchema = defaultMeta
  } else {
    defaultAjvSchema = defaultMeta.$id || defaultMeta.id
  }
  // we need to export the custom json schema
  let ajvSchemasCode = ''
  for (const [id, schema] of Object.entries(ajvInstance.schemas)) {
    // should skip ajv default schema
    if (id === defaultAjvSchema) continue
    ajvSchemasCode += `ajv.addSchema(${JSON.stringify(schema.schema)}, "${id}")\n`
  }
  return `
  'use strict'

  ${serializerCode.replace("'use strict'", '').replace('module.exports = ', '')}
  ${buildAjvCode.replace("'use strict'", '').replace('module.exports = buildAjv', '')}

  const serializer = new Serializer(${JSON.stringify(options || {})})
  const ajv = buildAjv(${JSON.stringify(options.ajv || {})})
  ${ajvSchemasCode}

  ${contextFunctionCode.replace('return main', '')}

  module.exports = main
      `
}

module.exports = buildStandaloneCode
