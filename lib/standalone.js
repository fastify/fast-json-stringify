'use strict'

function buildStandaloneCode (contextFunc, context, serializer, validator) {
  let ajvDependencyCode = ''
  if (context.validatorSchemasIds.size > 0) {
    ajvDependencyCode += 'const Validator = require(\'fast-json-stringify/lib/validator\')\n'
    ajvDependencyCode += `const validatorState = ${JSON.stringify(validator.getState())}\n`
    ajvDependencyCode += 'const validator = Validator.restoreFromState(validatorState)\n'
  } else {
    ajvDependencyCode += 'const validator = null\n'
  }

  // Don't need to keep external schemas once compiled
  // validatorState will hold external schemas if it needs them
  // eslint-disable-next-line no-unused-vars
  const { schema, ...serializerState } = serializer.getState()

  return `
  'use strict'

  ${ajvDependencyCode}

  module.exports = ${contextFunc.toString()}(validator, null)`
}

module.exports = buildStandaloneCode

module.exports.dependencies = {
  Validator: require('./validator')
}
