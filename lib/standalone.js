'use strict'

function buildStandaloneCode (contextFunc, context, serializer, validator) {
  // Mirror AJV's standalone `code.esm` option so ESM consumers can import the generated
  // serializer directly instead of wrapping the CJS output in an interop layer.
  const esm = context.options?.ajv?.code?.esm === true

  // ESM resolution requires the explicit file extension, whereas CommonJS `require` does not.
  const requireOrImport = (name, path) => esm
    ? `import ${name} from '${path}.js'\n`
    : `const ${name} = require('${path}')\n`

  let ajvDependencyCode = ''
  if (context.validatorSchemasIds.size > 0) {
    ajvDependencyCode += requireOrImport('Validator', 'fast-json-stringify/lib/validator')
    ajvDependencyCode += `const validatorState = ${JSON.stringify(validator.getState())}\n`
    ajvDependencyCode += 'const validator = Validator.restoreFromState(validatorState)\n'
  } else {
    ajvDependencyCode += 'const validator = null\n'
  }

  // Don't need to keep external schemas once compiled
  // validatorState will hold external schemas if it needs them
  const { schema, ...serializerState } = serializer.getState()

  // `export default fn(...)` parses `fn` as a function declaration, so the immediate invocation
  // is lost. Wrap it in parentheses to keep it an expression, unlike the `module.exports =` form.
  const exportStatement = esm
    ? `export default (${contextFunc.toString()})(validator, serializer)`
    : `module.exports = ${contextFunc.toString()}(validator, serializer)`

  return `
  'use strict'

  ${requireOrImport('Serializer', 'fast-json-stringify/lib/serializer')}
  const serializerState = ${JSON.stringify(serializerState)}
  const serializer = Serializer.restoreFromState(serializerState)

  ${ajvDependencyCode}

  ${exportStatement}`
}

module.exports = buildStandaloneCode

module.exports.dependencies = {
  Serializer: require('./serializer'),
  Validator: require('./validator')
}
