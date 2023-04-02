'use strict'

function buildStandaloneCode (contextFunc, context, serializer, validator) {
  let ajvDependencyCode = ''
  if (context.validatorSchemasIds.size > 0) {
    ajvDependencyCode += `const validatorState = ${JSON.stringify(validator.getState())}\n`
    ajvDependencyCode += 'const validator = Validator.restoreFromState(validatorState)\n'
  } else {
    ajvDependencyCode += 'const validator = null\n'
  }

  return `
  'use strict'
  const { dependencies } = require('fast-json-stringify/lib/standalone')

  const { Serializer, Validator } = dependencies

  const serializerState = ${JSON.stringify(serializer.getState())}
  const serializer = Serializer.restoreFromState(serializerState)

  ${ajvDependencyCode}

  module.exports = ${contextFunc.toString()}(validator, serializer)`
}

module.exports = buildStandaloneCode

module.exports.dependencies = {
  Serializer: require('./serializer'),
  Validator: require('./validator')
}
