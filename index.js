'use strict'

/* eslint no-prototype-builtins: 0 */

const merge = require('@fastify/deepmerge')()
const clone = require('rfdc')({ proto: true })
const { randomUUID } = require('crypto')

const validate = require('./lib/schema-validator')
const Serializer = require('./lib/serializer')
const Validator = require('./lib/validator')
const RefResolver = require('./lib/ref-resolver')
const Location = require('./lib/location')

let largeArraySize = 2e4
let largeArrayMechanism = 'default'

const validRoundingMethods = [
  'floor',
  'ceil',
  'round',
  'trunc'
]

const validLargeArrayMechanisms = [
  'default',
  'json-stringify'
]

const addComma = '!addComma && (addComma = true) || (json += \',\')'

function isValidSchema (schema, name) {
  if (!validate(schema)) {
    if (name) {
      name = `"${name}" `
    } else {
      name = ''
    }
    const first = validate.errors[0]
    const err = new Error(`${name}schema is invalid: data${first.instancePath} ${first.message}`)
    err.errors = isValidSchema.errors
    throw err
  }
}

function resolveRef (context, location, ref) {
  let hashIndex = ref.indexOf('#')
  if (hashIndex === -1) {
    hashIndex = ref.length
  }

  const schemaId = ref.slice(0, hashIndex) || location.getOriginSchemaId()
  const jsonPointer = ref.slice(hashIndex) || '#'

  const schema = context.refResolver.getSchema(schemaId, jsonPointer)

  if (schema === undefined) {
    throw new Error(`Cannot find reference "${ref}"`)
  }

  const newLocation = new Location(schema, schemaId, jsonPointer)
  if (schema.$ref !== undefined) {
    return resolveRef(context, newLocation, schema.$ref)
  }

  return newLocation
}

function build (schema, options) {
  isValidSchema(schema)

  options = options || {}

  const context = {
    functions: [],
    functionsCounter: 0,
    functionsNamesBySchema: new Map(),
    options,
    wrapObjects: true,
    refResolver: new RefResolver(),
    rootSchemaId: schema.$id || randomUUID(),
    validatorSchemasIds: new Set()
  }

  context.refResolver.addSchema(schema, context.rootSchemaId)

  if (options.schema) {
    for (const key of Object.keys(options.schema)) {
      isValidSchema(options.schema[key], key)
      context.refResolver.addSchema(options.schema[key], key)
    }
  }

  if (options.rounding) {
    if (!validRoundingMethods.includes(options.rounding)) {
      throw new Error(`Unsupported integer rounding method ${options.rounding}`)
    }
  }

  if (options.largeArrayMechanism) {
    if (validLargeArrayMechanisms.includes(options.largeArrayMechanism)) {
      largeArrayMechanism = options.largeArrayMechanism
    } else {
      throw new Error(`Unsupported large array mechanism ${options.largeArrayMechanism}`)
    }
  }

  if (options.largeArraySize) {
    if (typeof options.largeArraySize === 'string' && Number.isFinite(Number.parseInt(options.largeArraySize, 10))) {
      largeArraySize = Number.parseInt(options.largeArraySize, 10)
    } else if (typeof options.largeArraySize === 'number' && Number.isInteger(options.largeArraySize)) {
      largeArraySize = options.largeArraySize
    } else if (typeof options.largeArraySize === 'bigint') {
      largeArraySize = Number(options.largeArraySize)
    } else {
      throw new Error(`Unsupported large array size. Expected integer-like, got ${typeof options.largeArraySize} with value ${options.largeArraySize}`)
    }
  }

  const location = new Location(schema, context.rootSchemaId)
  const code = buildValue(context, location, 'input')

  let contextFunctionCode

  // If we have only the invocation of the 'anonymous0' function, we would
  // basically just wrap the 'anonymous0' function in the 'main' function and
  // and the overhead of the intermediate variable 'json'. We can avoid the
  // wrapping and the unnecessary memory allocation by aliasing 'anonymous0' to
  // 'main'
  if (code === 'json += anonymous0(input)') {
    contextFunctionCode = `
    ${context.functions.join('\n')}
    const main = anonymous0
    return main
    `
  } else {
    contextFunctionCode = `
    function main (input) {
      let json = ''
      ${code}
      return json
    }
    ${context.functions.join('\n')}
    return main
    `
  }

  const serializer = new Serializer(options)
  const validator = new Validator(options.ajv)

  for (const schemaId of context.validatorSchemasIds) {
    const schema = context.refResolver.getSchema(schemaId)
    validator.addSchema(schema, schemaId)

    const dependencies = context.refResolver.getSchemaDependencies(schemaId)
    for (const [schemaId, schema] of Object.entries(dependencies)) {
      validator.addSchema(schema, schemaId)
    }
  }

  if (options.debugMode) {
    options.mode = 'debug'
  }

  if (options.mode === 'debug') {
    return {
      validator,
      serializer,
      code: `validator\nserializer\n${contextFunctionCode}`,
      ajv: validator.ajv
    }
  }

  /* eslint no-new-func: "off" */
  const contextFunc = new Function('validator', 'serializer', contextFunctionCode)

  if (options.mode === 'standalone') {
    const buildStandaloneCode = require('./lib/standalone')
    return buildStandaloneCode(contextFunc, context, serializer, validator)
  }

  return contextFunc(validator, serializer)
}

const objectKeywords = [
  'properties',
  'required',
  'additionalProperties',
  'patternProperties',
  'maxProperties',
  'minProperties',
  'dependencies'
]

const arrayKeywords = [
  'items',
  'additionalItems',
  'maxItems',
  'minItems',
  'uniqueItems',
  'contains'
]

const stringKeywords = [
  'maxLength',
  'minLength',
  'pattern'
]

const numberKeywords = [
  'multipleOf',
  'maximum',
  'exclusiveMaximum',
  'minimum',
  'exclusiveMinimum'
]

/**
 * Infer type based on keyword in order to generate optimized code
 * https://datatracker.ietf.org/doc/html/draft-handrews-json-schema-validation-01#section-6
 */
function inferTypeByKeyword (schema) {
  // eslint-disable-next-line
  for (var keyword of objectKeywords) {
    if (keyword in schema) return 'object'
  }
  // eslint-disable-next-line
  for (var keyword of arrayKeywords) {
    if (keyword in schema) return 'array'
  }
  // eslint-disable-next-line
  for (var keyword of stringKeywords) {
    if (keyword in schema) return 'string'
  }
  // eslint-disable-next-line
  for (var keyword of numberKeywords) {
    if (keyword in schema) return 'number'
  }
  return schema.type
}

function buildExtraObjectPropertiesSerializer (context, location) {
  const schema = location.schema
  const propertiesKeys = Object.keys(schema.properties || {})

  let code = `
    const propertiesKeys = ${JSON.stringify(propertiesKeys)}
    for (const [key, value] of Object.entries(obj)) {
      if (
        propertiesKeys.includes(key) ||
        value === undefined ||
        typeof value === 'function' ||
        typeof value === 'symbol'
      ) continue
  `

  const patternPropertiesLocation = location.getPropertyLocation('patternProperties')
  const patternPropertiesSchema = patternPropertiesLocation.schema

  if (patternPropertiesSchema !== undefined) {
    for (const propertyKey in patternPropertiesSchema) {
      const propertyLocation = patternPropertiesLocation.getPropertyLocation(propertyKey)

      code += `
        if (/${propertyKey.replace(/\\*\//g, '\\/')}/.test(key)) {
          ${addComma}
          json += serializer.asString(key) + ':'
          ${buildValue(context, propertyLocation, 'value')}
          continue
        }
      `
    }
  }

  const additionalPropertiesLocation = location.getPropertyLocation('additionalProperties')
  const additionalPropertiesSchema = additionalPropertiesLocation.schema

  if (additionalPropertiesSchema !== undefined) {
    if (additionalPropertiesSchema === true) {
      code += `
        ${addComma}
        json += serializer.asString(key) + ':' + JSON.stringify(value)
      `
    } else {
      const propertyLocation = location.getPropertyLocation('additionalProperties')
      code += `
        ${addComma}
        json += serializer.asString(key) + ':'
        ${buildValue(context, propertyLocation, 'value')}
      `
    }
  }

  code += `
    }
  `
  return code
}

function buildInnerObject (context, location) {
  let code = ''
  const schema = location.schema
  const required = schema.required || []

  const propertiesLocation = location.getPropertyLocation('properties')

  const requiredWithDefault = []
  const requiredWithoutDefault = []
  if (schema.properties) {
    for (const key of Object.keys(schema.properties)) {
      if (required.indexOf(key) === -1) {
        continue
      }
      let propertyLocation = propertiesLocation.getPropertyLocation(key)
      if (propertyLocation.schema.$ref) {
        propertyLocation = resolveRef(context, location, propertyLocation.schema.$ref)
      }

      const sanitizedKey = JSON.stringify(key)

      // Using obj['key'] !== undefined instead of obj.hasOwnProperty(prop) for perf reasons,
      // see https://github.com/mcollina/fast-json-stringify/pull/3 for discussion.
      const defaultValue = propertyLocation.schema.default
      if (defaultValue === undefined) {
        code += `if (obj[${sanitizedKey}] === undefined) throw new Error('${sanitizedKey} is required!')\n`
        requiredWithoutDefault.push(key)
      }
      requiredWithDefault.push(key)
    }
  }

  // handle extraneous required fields
  for (const requiredProperty of required) {
    if (requiredWithDefault.indexOf(requiredProperty) !== -1) continue
    code += `if (obj['${requiredProperty}'] === undefined) throw new Error('"${requiredProperty}" is required!')\n`
  }

  code += `
    let addComma = false
    let json = '${context.wrapObjects ? '{' : ''}'
  `
  const wrapObjects = context.wrapObjects
  context.wrapObjects = true

  if (schema.properties) {
    for (const key of Object.keys(schema.properties)) {
      let propertyLocation = propertiesLocation.getPropertyLocation(key)
      if (propertyLocation.schema.$ref) {
        propertyLocation = resolveRef(context, location, propertyLocation.schema.$ref)
      }

      const sanitizedKey = JSON.stringify(key)

      if (requiredWithoutDefault.indexOf(key) !== -1) {
        code += `
        ${addComma}
        json += ${JSON.stringify(sanitizedKey + ':')}
        ${buildValue(context, propertyLocation, `obj[${sanitizedKey}]`)}
      `
      } else {
        // Using obj['key'] !== undefined instead of obj.hasOwnProperty(prop) for perf reasons,
        // see https://github.com/mcollina/fast-json-stringify/pull/3 for discussion.
        code += `
        if (obj[${sanitizedKey}] !== undefined) {
          ${addComma}
          json += ${JSON.stringify(sanitizedKey + ':')}
          ${buildValue(context, propertyLocation, `obj[${sanitizedKey}]`)}
        }
        `
        const defaultValue = propertyLocation.schema.default
        if (defaultValue !== undefined) {
          code += `
        else {
          ${addComma}
          json += ${JSON.stringify(sanitizedKey + ':' + JSON.stringify(defaultValue))}
        }
        `
        }
      }
    }
  }

  if (schema.patternProperties || schema.additionalProperties) {
    code += buildExtraObjectPropertiesSerializer(context, location)
  }

  context.wrapObjects = wrapObjects
  code += `
  return json${context.wrapObjects ? ' + \'}\'' : ''}
  `
  return code
}

function mergeAllOfSchema (context, location, schema, mergedSchema) {
  const allOfLocation = location.getPropertyLocation('allOf')

  for (let i = 0; i < schema.allOf.length; i++) {
    let allOfSchema = schema.allOf[i]

    if (allOfSchema.$ref) {
      const allOfSchemaLocation = allOfLocation.getPropertyLocation(i)
      allOfSchema = resolveRef(context, allOfSchemaLocation, allOfSchema.$ref).schema
    }

    let allOfSchemaType = allOfSchema.type
    if (allOfSchemaType === undefined) {
      allOfSchemaType = inferTypeByKeyword(allOfSchema)
    }

    if (allOfSchemaType !== undefined) {
      if (
        mergedSchema.type !== undefined &&
        mergedSchema.type !== allOfSchemaType
      ) {
        throw new Error('allOf schemas have different type values')
      }
      mergedSchema.type = allOfSchemaType
    }

    if (allOfSchema.format !== undefined) {
      if (
        mergedSchema.format !== undefined &&
        mergedSchema.format !== allOfSchema.format
      ) {
        throw new Error('allOf schemas have different format values')
      }
      mergedSchema.format = allOfSchema.format
    }

    if (allOfSchema.nullable !== undefined) {
      if (
        mergedSchema.nullable !== undefined &&
        mergedSchema.nullable !== allOfSchema.nullable
      ) {
        throw new Error('allOf schemas have different nullable values')
      }
      mergedSchema.nullable = allOfSchema.nullable
    }

    if (allOfSchema.properties !== undefined) {
      if (mergedSchema.properties === undefined) {
        mergedSchema.properties = {}
      }
      Object.assign(mergedSchema.properties, allOfSchema.properties)
    }

    if (allOfSchema.additionalProperties !== undefined) {
      if (mergedSchema.additionalProperties === undefined) {
        mergedSchema.additionalProperties = {}
      }
      Object.assign(mergedSchema.additionalProperties, allOfSchema.additionalProperties)
    }

    if (allOfSchema.patternProperties !== undefined) {
      if (mergedSchema.patternProperties === undefined) {
        mergedSchema.patternProperties = {}
      }
      Object.assign(mergedSchema.patternProperties, allOfSchema.patternProperties)
    }

    if (allOfSchema.required !== undefined) {
      if (mergedSchema.required === undefined) {
        mergedSchema.required = []
      }
      mergedSchema.required.push(...allOfSchema.required)
    }

    if (allOfSchema.oneOf !== undefined) {
      if (mergedSchema.oneOf === undefined) {
        mergedSchema.oneOf = []
      }
      mergedSchema.oneOf.push(...allOfSchema.oneOf)
    }

    if (allOfSchema.anyOf !== undefined) {
      if (mergedSchema.anyOf === undefined) {
        mergedSchema.anyOf = []
      }
      mergedSchema.anyOf.push(...allOfSchema.anyOf)
    }

    if (allOfSchema.allOf !== undefined) {
      mergeAllOfSchema(context, location, allOfSchema, mergedSchema)
    }
  }
  delete mergedSchema.allOf

  mergedSchema.$id = `merged_${randomUUID()}`
  context.refResolver.addSchema(mergedSchema)
  location.addMergedSchema(mergedSchema, mergedSchema.$id)
}

function addIfThenElse (context, location, input) {
  context.validatorSchemasIds.add(location.getSchemaId())

  const schema = merge({}, location.schema)
  const thenSchema = schema.then
  const elseSchema = schema.else || { additionalProperties: true }

  delete schema.if
  delete schema.then
  delete schema.else

  const ifLocation = location.getPropertyLocation('if')
  const ifSchemaRef = ifLocation.getSchemaRef()

  const thenLocation = location.getPropertyLocation('then')
  thenLocation.schema = merge(schema, thenSchema)

  const elseLocation = location.getPropertyLocation('else')
  elseLocation.schema = merge(schema, elseSchema)

  return `
    if (validator.validate("${ifSchemaRef}", ${input})) {
      ${buildValue(context, thenLocation, input)}
    } else {
      ${buildValue(context, elseLocation, input)}
    }
  `
}

function toJSON (variableName) {
  return `(${variableName} && typeof ${variableName}.toJSON === 'function')
    ? ${variableName}.toJSON()
    : ${variableName}
  `
}

function buildObject (context, location) {
  const schema = location.schema

  if (context.functionsNamesBySchema.has(schema)) {
    return context.functionsNamesBySchema.get(schema)
  }

  const functionName = generateFuncName(context)
  context.functionsNamesBySchema.set(schema, functionName)

  let schemaRef = location.getSchemaRef()
  if (schemaRef.startsWith(context.rootSchemaId)) {
    schemaRef = schemaRef.replace(context.rootSchemaId, '')
  }

  let functionCode = `
  `

  functionCode += `
    // ${schemaRef}
    function ${functionName} (input) {
      const obj = ${toJSON('input')}
      ${buildInnerObject(context, location)}
    }
  `

  context.functions.push(functionCode)
  return functionName
}

function buildArray (context, location) {
  const schema = location.schema

  let itemsLocation = location.getPropertyLocation('items')
  itemsLocation.schema = itemsLocation.schema || {}

  if (itemsLocation.schema.$ref) {
    itemsLocation = resolveRef(context, itemsLocation, itemsLocation.schema.$ref)
  }

  const itemsSchema = itemsLocation.schema

  if (context.functionsNamesBySchema.has(schema)) {
    return context.functionsNamesBySchema.get(schema)
  }

  const functionName = generateFuncName(context)
  context.functionsNamesBySchema.set(schema, functionName)

  let schemaRef = location.getSchemaRef()
  if (schemaRef.startsWith(context.rootSchemaId)) {
    schemaRef = schemaRef.replace(context.rootSchemaId, '')
  }

  let functionCode = `
    function ${functionName} (obj) {
      // ${schemaRef}
  `

  functionCode += `
    if (!Array.isArray(obj)) {
      throw new TypeError(\`The value of '${schemaRef}' does not match schema definition.\`)
    }
    const arrayLength = obj.length
  `

  if (!schema.additionalItems && Array.isArray(itemsSchema)) {
    functionCode += `
      if (arrayLength > ${itemsSchema.length}) {
        throw new Error(\`Item at ${itemsSchema.length} does not match schema definition.\`)
      }
    `
  }

  if (largeArrayMechanism === 'json-stringify') {
    functionCode += `if (arrayLength && arrayLength >= ${largeArraySize}) return JSON.stringify(obj)\n`
  }

  functionCode += `
    let jsonOutput = ''
  `

  if (Array.isArray(itemsSchema)) {
    for (let i = 0; i < itemsSchema.length; i++) {
      const item = itemsSchema[i]
      const tmpRes = buildValue(context, itemsLocation.getPropertyLocation(i), `obj[${i}]`)
      functionCode += `
        if (${i} < arrayLength) {
          if (${buildArrayTypeCondition(item.type, `[${i}]`)}) {
            let json = ''
            ${tmpRes}
            jsonOutput += json
            if (${i} < arrayLength - 1) {
              jsonOutput += ','
            }
          } else {
            throw new Error(\`Item at ${i} does not match schema definition.\`)
          }
        }
        `
    }

    if (schema.additionalItems) {
      functionCode += `
        for (let i = ${itemsSchema.length}; i < arrayLength; i++) {
          jsonOutput += JSON.stringify(obj[i])
          if (i < arrayLength - 1) {
            jsonOutput += ','
          }
        }`
    }
  } else {
    const code = buildValue(context, itemsLocation, 'obj[i]')
    functionCode += `
      for (let i = 0; i < arrayLength; i++) {
        let json = ''
        ${code}
        jsonOutput += json
        if (i < arrayLength - 1) {
          jsonOutput += ','
        }
      }`
  }

  functionCode += `
    return \`[\${jsonOutput}]\`
  }`

  context.functions.push(functionCode)
  return functionName
}

function buildArrayTypeCondition (type, accessor) {
  let condition
  switch (type) {
    case 'null':
      condition = `obj${accessor} === null`
      break
    case 'string':
      condition = `typeof obj${accessor} === 'string'`
      break
    case 'integer':
      condition = `Number.isInteger(obj${accessor})`
      break
    case 'number':
      condition = `Number.isFinite(obj${accessor})`
      break
    case 'boolean':
      condition = `typeof obj${accessor} === 'boolean'`
      break
    case 'object':
      condition = `obj${accessor} && typeof obj${accessor} === 'object' && obj${accessor}.constructor === Object`
      break
    case 'array':
      condition = `Array.isArray(obj${accessor})`
      break
    default:
      if (Array.isArray(type)) {
        const conditions = type.map((subType) => {
          return buildArrayTypeCondition(subType, accessor)
        })
        condition = `(${conditions.join(' || ')})`
      }
  }
  return condition
}

function generateFuncName (context) {
  return 'anonymous' + context.functionsCounter++
}

function buildMultiTypeSerializer (context, location, input) {
  const schema = location.schema
  const types = schema.type.sort(t1 => t1 === 'null' ? -1 : 1)

  let code = ''

  types.forEach((type, index) => {
    location.schema = { ...location.schema, type }
    const nestedResult = buildSingleTypeSerializer(context, location, input)

    const statement = index === 0 ? 'if' : 'else if'
    switch (type) {
      case 'null':
        code += `
          ${statement} (${input} === null)
            ${nestedResult}
          `
        break
      case 'string': {
        code += `
          ${statement}(
            typeof ${input} === "string" ||
            ${input} === null ||
            ${input} instanceof Date ||
            ${input} instanceof RegExp ||
            (
              typeof ${input} === "object" &&
              typeof ${input}.toString === "function" &&
              ${input}.toString !== Object.prototype.toString &&
              !(${input} instanceof Date)
            )
          )
            ${nestedResult}
        `
        break
      }
      case 'array': {
        code += `
          ${statement}(Array.isArray(${input}))
            ${nestedResult}
        `
        break
      }
      case 'integer': {
        code += `
          ${statement}(Number.isInteger(${input}) || ${input} === null)
            ${nestedResult}
        `
        break
      }
      default: {
        code += `
          ${statement}(typeof ${input} === "${type}" || ${input} === null)
            ${nestedResult}
        `
        break
      }
    }
  })
  let schemaRef = location.getSchemaRef()
  if (schemaRef.startsWith(context.rootSchemaId)) {
    schemaRef = schemaRef.replace(context.rootSchemaId, '')
  }
  code += `
    else throw new TypeError(\`The value of '${schemaRef}' does not match schema definition.\`)
  `

  return code
}

function buildSingleTypeSerializer (context, location, input) {
  const schema = location.schema

  switch (schema.type) {
    case 'null':
      return 'json += \'null\''
    case 'string': {
      if (schema.format === 'date-time') {
        return `json += serializer.asDateTime(${input})`
      } else if (schema.format === 'date') {
        return `json += serializer.asDate(${input})`
      } else if (schema.format === 'time') {
        return `json += serializer.asTime(${input})`
      } else {
        return `json += serializer.asString(${input})`
      }
    }
    case 'integer':
      return `json += serializer.asInteger(${input})`
    case 'number':
      return `json += serializer.asNumber(${input})`
    case 'boolean':
      return `json += serializer.asBoolean(${input})`
    case 'object': {
      const funcName = buildObject(context, location)
      return `json += ${funcName}(${input})`
    }
    case 'array': {
      const funcName = buildArray(context, location)
      return `json += ${funcName}(${input})`
    }
    case undefined:
      return `json += JSON.stringify(${input})`
    default:
      throw new Error(`${schema.type} unsupported`)
  }
}

function buildConstSerializer (location, input) {
  const schema = location.schema
  const type = schema.type

  const hasNullType = Array.isArray(type) && type.includes('null')

  let code = ''

  if (hasNullType) {
    code += `
      if (${input} === null) {
        json += 'null'
      } else {
    `
  }

  code += `json += '${JSON.stringify(schema.const)}'`

  if (hasNullType) {
    code += `
      }
    `
  }

  return code
}

function buildValue (context, location, input) {
  let schema = location.schema

  if (typeof schema === 'boolean') {
    return `json += JSON.stringify(${input})`
  }

  if (schema.$ref) {
    location = resolveRef(context, location, schema.$ref)
    schema = location.schema
  }

  if (schema.type === undefined) {
    const inferredType = inferTypeByKeyword(schema)
    if (inferredType) {
      schema.type = inferredType
    }
  }

  if (schema.if && schema.then) {
    return addIfThenElse(context, location, input)
  }

  if (schema.allOf) {
    mergeAllOfSchema(context, location, schema, clone(schema))
    schema = location.schema
  }

  const type = schema.type

  let code = ''

  if ((type === undefined || type === 'object') && (schema.anyOf || schema.oneOf)) {
    context.validatorSchemasIds.add(location.getSchemaId())

    if (schema.type === 'object') {
      context.wrapObjects = false
      const funcName = buildObject(context, location)
      code += `
        json += '{'
        json += ${funcName}(${input})
        json += ','
      `
    }

    const type = schema.anyOf ? 'anyOf' : 'oneOf'
    const anyOfLocation = location.getPropertyLocation(type)

    for (let index = 0; index < location.schema[type].length; index++) {
      const optionLocation = anyOfLocation.getPropertyLocation(index)
      const schemaRef = optionLocation.getSchemaRef()
      const nestedResult = buildValue(context, optionLocation, input)
      code += `
        ${index === 0 ? 'if' : 'else if'}(validator.validate("${schemaRef}", ${input}))
          ${nestedResult}
      `
    }

    let schemaRef = location.getSchemaRef()
    if (schemaRef.startsWith(context.rootSchemaId)) {
      schemaRef = schemaRef.replace(context.rootSchemaId, '')
    }

    code += `
      else throw new TypeError(\`The value of '${schemaRef}' does not match schema definition.\`)
    `
    if (schema.type === 'object') {
      code += `
        json += '}'
      `
      context.wrapObjects = true
    }
    return code
  }

  const nullable = schema.nullable === true
  if (nullable) {
    code += `
      if (${input} === null) {
        json += 'null'
      } else {
    `
  }

  if (schema.const !== undefined) {
    code += buildConstSerializer(location, input)
  } else if (Array.isArray(type)) {
    code += buildMultiTypeSerializer(context, location, input)
  } else {
    code += buildSingleTypeSerializer(context, location, input)
  }

  if (nullable) {
    code += `
      }
    `
  }

  return code
}

module.exports = build
module.exports.default = build
module.exports.build = build

module.exports.validLargeArrayMechanisms = validLargeArrayMechanisms

module.exports.restore = function ({ code, validator, serializer }) {
  // eslint-disable-next-line
  return (Function.apply(null, ['validator', 'serializer', code])
    .apply(null, [validator, serializer]))
}
