'use strict'

const { mergeSchemas: _mergeSchemas } = require('merge-json-schemas')

function mergeSchemas (schemas) {
  return _mergeSchemas(schemas, { onConflict: 'skip' })
}

module.exports = mergeSchemas
