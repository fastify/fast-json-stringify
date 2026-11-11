'use strict'

const Ajv = require('ajv')
const ajvFormats = require('ajv-formats')

// Compiles a JSON Schema into a `validate(data) => boolean` function with
// ajv, the validator the library itself uses, so tests check serialized
// output against the same rules. A fresh instance is created per schema so
// tests that reuse an `$id` do not collide.
module.exports = function validator (schema) {
  const ajv = new Ajv({ strictSchema: false, allowUnionTypes: true })
  ajvFormats(ajv)
  // `unsafe` is a fast-json-stringify format that only disables escaping.
  ajv.addFormat('unsafe', true)
  // The serializer renders `format: time` as `HH:mm:ss` with no timezone
  // (see `asTime` in lib/serializer.js), which ajv-formats rejects because
  // RFC 3339 requires one. Validate the shape the library documents.
  ajv.addFormat('time', /^(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d$/)
  return ajv.compile(schema)
}
