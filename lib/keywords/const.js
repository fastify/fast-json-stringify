'use strict'

function validator (input, accessPath = 'value', mode = 'function') {
  if (mode === 'integration') {
    return `${_const(input, accessPath)} true\n`
  } else {
    return new Function('value', `return (\n${_const(input, accessPath)} true\n)`) // eslint-disable-line no-new-func
  }
}

function _const (input, accessPath) {
  let functionCode = ''
  switch (typeof input) {
    case 'undefined':
      functionCode += _constUndefined(input, accessPath)
      break
    case 'bigint':
      functionCode += _constBigInt(input, accessPath)
      break
    case 'boolean':
      functionCode += _constBoolean(input, accessPath)
      break
    case 'number':
      functionCode += _constNumber(input, accessPath)
      break
    case 'string':
      functionCode += _constString(input, accessPath)
      break
    case 'object':
      functionCode += _constObject(input, accessPath)
      break
  }
  return functionCode
}

function _constUndefined (input, accessPath) {
  return `typeof ${accessPath} === 'undefined' &&\n`
}

function _constBigInt (input, accessPath) {
  return `typeof ${accessPath} === 'bigint' && ${accessPath} === ${input.toString()}n &&\n`
}

function _constNumber (input, accessPath) {
  if (input !== input) { // eslint-disable-line no-self-compare
    return `typeof ${accessPath} === 'number' && ${accessPath} !== ${accessPath} &&\n`
  } else {
    return `typeof ${accessPath} === 'number' && ${accessPath} === ${input.toString()} &&\n`
  }
}

function _constBoolean (input, accessPath) {
  return `typeof ${accessPath} === 'boolean' && ${accessPath} === ${input ? 'true' : 'false'} &&\n`
}

function _constString (input, accessPath) {
  return `typeof ${accessPath} === 'string' && ${accessPath} === ${JSON.stringify(input)} &&\n`
}

function _constNull (input, accessPath) {
  return `typeof ${accessPath} === 'object' && ${accessPath} === null &&\n`
}

function _constArray (input, accessPath) {
  let functionCode = `Array.isArray(${accessPath}) && ${accessPath}.length === ${input.length} &&\n`
  for (let i = 0; i < input.length; ++i) {
    functionCode += _const(input[i], `${accessPath}[${i}]`)
  }
  return functionCode
}

function _constPOJO (input, accessPath) {
  const keys = Object.keys(input)

  let functionCode = `typeof ${accessPath} === 'object' && ${accessPath} !== null &&\n`

  functionCode += `Object.keys(${accessPath}).length === ${keys.length} &&\n`

  if (typeof input.valueOf === 'function') {
    functionCode += `(${accessPath}.valueOf === Object.prototype.valueOf || ${accessPath}.valueOf() === ${JSON.stringify(input.valueOf())}) &&\n`
  }

  if (typeof input.toString === 'function') {
    functionCode += `(${accessPath}.toString === Object.prototype.toString || ${accessPath}.toString() === ${JSON.stringify(input.toString())}) &&\n`
  }
  // check keys
  for (const key of keys) {
    functionCode += `${JSON.stringify(key)} in ${accessPath} &&\n`
  }
  // check values
  for (const key of keys) {
    functionCode += `${_const(input[key], `${accessPath}[${JSON.stringify(key)}]`)}`
  }

  return functionCode
}

function _constRegExp (input, accessPath) {
  return `typeof ${accessPath} === 'object' && ${accessPath} !== null && ${accessPath}.constructor === RegExp && ${accessPath}.source === ${JSON.stringify(input.source)} && ${accessPath}.flags === ${JSON.stringify(input.flags)} &&\n`
}

function _constDate (input, accessPath) {
  return `typeof ${accessPath} === 'object' && ${accessPath} !== null && ${accessPath}.constructor === Date && ${accessPath}.getTime() === ${input.getTime()} &&\n`
}

function _constObject (input, accessPath) {
  if (input === null) {
    return _constNull(input, accessPath)
  } else if (Array.isArray(input)) {
    return _constArray(input, accessPath)
  } else if (input.constructor === RegExp) {
    return _constRegExp(input, accessPath)
  } else if (input.constructor === Date) {
    return _constDate(input, accessPath)
  } else {
    return _constPOJO(input, accessPath)
  }
}

function keyword (context, location, input) {
  const schema = location.schema
  let schemaRef = location.getSchemaRef()
  if (schemaRef.startsWith(context.rootSchemaId)) {
    schemaRef = schemaRef.replace(context.rootSchemaId, '')
  }
  let code = `
  if (${validator(schema.const, input, 'integration')}) {
    json += ${JSON.stringify(JSON.stringify(schema.const))}
  }`
  if (context.strict) {
    code += ` else {
      throw new Error(\`The value of '${schemaRef}' does not match schema definition.\`)
    }
    `
  } else {
    code += ` else {
      json += JSON.stringify(${input})
    }
    `
  }
  return code
}

module.exports.validator = validator
module.exports.keyword = keyword
