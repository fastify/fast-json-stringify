'use strict'

/* eslint no-prototype-builtins: 0 */

const merge = require('deepmerge')
const clone = require('rfdc')({ proto: true })
const fjsCloned = Symbol('fast-json-stringify.cloned')
const { randomUUID } = require('crypto')

const validate = require('./schema-validator')
const Serializer = require('./serializer')
const buildAjv = require('./ajv')

let largeArraySize = 2e4
let largeArrayMechanism = 'default'
const validLargeArrayMechanisms = [
  'default',
  'json-stringify'
]

const addComma = `
  if (addComma) {
    json += ','
  } else {
    addComma = true
  }
`

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

function mergeLocation (location, key) {
  return {
    schema: location.schema[key],
    schemaId: location.schemaId,
    jsonPointer: location.jsonPointer + '/' + key
  }
}

function resolveRef (location, ref) {
  let hashIndex = ref.indexOf('#')
  if (hashIndex === -1) {
    hashIndex = ref.length
  }

  const schemaId = ref.slice(0, hashIndex) || location.schemaId
  const jsonPointer = ref.slice(hashIndex)

  const schemaRef = schemaId + jsonPointer

  let ajvSchema
  try {
    ajvSchema = ajvInstance.getSchema(schemaRef)
  } catch (error) {
    throw new Error(`Cannot find reference "${ref}"`)
  }

  if (ajvSchema === undefined) {
    throw new Error(`Cannot find reference "${ref}"`)
  }

  const schema = ajvSchema.schema
  if (schema.$ref !== undefined) {
    return resolveRef({ schema, schemaId, jsonPointer }, schema.$ref)
  }

  return { schema, schemaId, jsonPointer }
}

const arrayItemsReferenceSerializersMap = new Map()
const objectReferenceSerializersMap = new Map()

let rootSchemaId = null
let ajvInstance = null
let contextFunctions = null

function build (schema, options) {
  schema = clone(schema)

  arrayItemsReferenceSerializersMap.clear()
  objectReferenceSerializersMap.clear()

  contextFunctions = []
  options = options || {}

  ajvInstance = buildAjv(options.ajv)
  rootSchemaId = schema.$id || randomUUID()

  isValidSchema(schema)
  extendDateTimeType(schema)
  ajvInstance.addSchema(schema, rootSchemaId)

  if (options.schema) {
    const externalSchemas = clone(options.schema)

    for (const key of Object.keys(externalSchemas)) {
      const externalSchema = externalSchemas[key]
      isValidSchema(externalSchema, key)
      extendDateTimeType(externalSchema)

      let schemaKey = externalSchema.$id || key
      if (externalSchema.$id !== undefined && externalSchema.$id[0] === '#') {
        schemaKey = key + externalSchema.$id // relative URI
      }

      if (ajvInstance.getSchema(schemaKey) === undefined) {
        ajvInstance.addSchema(externalSchema, schemaKey)
      }
    }
  }

  if (options.rounding) {
    if (!['floor', 'ceil', 'round'].includes(options.rounding)) {
      throw new Error(`Unsupported integer rounding method ${options.rounding}`)
    }
  }

  if (options.largeArrayMechanism) {
    if (validLargeArrayMechanisms.includes(options.largeArrayMechanism)) {
      largeArrayMechanism = options.largeArrayMechanism
    } else {
      throw new Error(`Unsupported large array mechanism ${options.rounding}`)
    }
  }

  if (options.largeArraySize) {
    if (!Number.isNaN(Number.parseInt(options.largeArraySize, 10))) {
      largeArraySize = options.largeArraySize
    } else {
      throw new Error(`Unsupported large array size. Expected integer-like, got ${options.largeArraySize}`)
    }
  }

  const serializer = new Serializer(options)

  const location = { schema, schemaId: rootSchemaId, jsonPointer: '#' }
  const code = buildValue(location, 'input')

  const contextFunctionCode = `
    function main (input) {
      let json = ''
      ${code}
      return json
    }
    ${contextFunctions.join('\n')}
    return main
    `

  const dependenciesName = ['ajv', 'serializer', contextFunctionCode]

  if (options.debugMode) {
    options.mode = 'debug'
  }

  if (options.mode === 'debug') {
    return { code: dependenciesName.join('\n'), ajv: ajvInstance }
  }

  if (options.mode === 'standalone') {
    // lazy load
    const buildStandaloneCode = require('./standalone')
    return buildStandaloneCode(options, ajvInstance, contextFunctionCode)
  }

  /* eslint no-new-func: "off" */
  const contextFunc = new Function('ajv', 'serializer', contextFunctionCode)
  const stringifyFunc = contextFunc(ajvInstance, serializer)

  ajvInstance = null
  rootSchemaId = null
  contextFunctions = null
  arrayItemsReferenceSerializersMap.clear()
  objectReferenceSerializersMap.clear()

  return stringifyFunc
}

const objectKeywords = [
  'maxProperties',
  'minProperties',
  'required',
  'properties',
  'patternProperties',
  'additionalProperties',
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

function getStringSerializer (format, nullable) {
  switch (format) {
    case 'date-time': return nullable ? 'serializer.asDatetimeNullable.bind(serializer)' : 'serializer.asDatetime.bind(serializer)'
    case 'date': return nullable ? 'serializer.asDateNullable.bind(serializer)' : 'serializer.asDate.bind(serializer)'
    case 'time': return nullable ? 'serializer.asTimeNullable.bind(serializer)' : 'serializer.asTime.bind(serializer)'
    default: return nullable ? 'serializer.asStringNullable.bind(serializer)' : 'serializer.asString.bind(serializer)'
  }
}

function addPatternProperties (location) {
  const schema = location.schema
  const pp = schema.patternProperties
  let code = `
      var properties = ${JSON.stringify(schema.properties)} || {}
      var keys = Object.keys(obj)
      for (var i = 0; i < keys.length; i++) {
        if (properties[keys[i]]) continue
  `

  const patternPropertiesLocation = mergeLocation(location, 'patternProperties')
  Object.keys(pp).forEach((regex) => {
    let ppLocation = mergeLocation(patternPropertiesLocation, regex)
    if (pp[regex].$ref) {
      ppLocation = resolveRef(ppLocation, pp[regex].$ref)
      pp[regex] = ppLocation.schema
    }

    try {
      RegExp(regex)
    } catch (err) {
      throw new Error(`${err.message}. Found at ${regex} matching ${JSON.stringify(pp[regex])}`)
    }

    const valueCode = buildValue(ppLocation, 'obj[keys[i]]')
    code += `
      if (/${regex.replace(/\\*\//g, '\\/')}/.test(keys[i])) {
        ${addComma}
        json += serializer.asString(keys[i]) + ':'
        ${valueCode}
        continue
      }
    `
  })
  if (schema.additionalProperties) {
    code += additionalProperty(location)
  }

  code += `
      }
  `
  return code
}

function additionalProperty (location) {
  const ap = location.schema.additionalProperties
  let code = ''
  if (ap === true) {
    code += `
        if (obj[keys[i]] !== undefined && typeof obj[keys[i]] !== 'function' && typeof obj[keys[i]] !== 'symbol') {
          ${addComma}
          json += serializer.asString(keys[i]) + ':' + JSON.stringify(obj[keys[i]])
        }
    `

    return code
  }

  let apLocation = mergeLocation(location, 'additionalProperties')
  if (apLocation.schema.$ref) {
    apLocation = resolveRef(apLocation, apLocation.schema.$ref)
  }

  const valueCode = buildValue(apLocation, 'obj[keys[i]]')

  code += `
    ${addComma}
    json += serializer.asString(keys[i]) + ':'
    ${valueCode}
  `

  return code
}

function addAdditionalProperties (location) {
  return `
      var properties = ${JSON.stringify(location.schema.properties)} || {}
      var keys = Object.keys(obj)
      for (var i = 0; i < keys.length; i++) {
        if (properties[keys[i]]) continue
        ${additionalProperty(location)}
      }
  `
}

function buildCode (location) {
  if (location.schema.$ref) {
    location = resolveRef(location, location.schema.$ref)
  }

  const schema = location.schema
  const required = schema.required || []

  let code = ''

  const propertiesLocation = mergeLocation(location, 'properties')
  Object.keys(schema.properties || {}).forEach((key) => {
    let propertyLocation = mergeLocation(propertiesLocation, key)
    if (schema.properties[key].$ref) {
      propertyLocation = resolveRef(location, schema.properties[key].$ref)
      schema.properties[key] = propertyLocation.schema
    }

    // Using obj['key'] !== undefined instead of obj.hasOwnProperty(prop) for perf reasons,
    // see https://github.com/mcollina/fast-json-stringify/pull/3 for discussion.

    const sanitized = JSON.stringify(key)
    const asString = JSON.stringify(sanitized)

    code += `
      if (obj[${sanitized}] !== undefined) {
        ${addComma}
        json += ${asString} + ':'
      `

    code += buildValue(propertyLocation, `obj[${JSON.stringify(key)}]`)

    const defaultValue = schema.properties[key].default
    if (defaultValue !== undefined) {
      code += `
      } else {
        ${addComma}
        json += ${asString} + ':' + ${JSON.stringify(JSON.stringify(defaultValue))}
      `
    } else if (required.includes(key)) {
      code += `
      } else {
        throw new Error('${sanitized} is required!')
      `
    }

    code += `
      }
    `
  })

  for (const requiredProperty of required) {
    if (schema.properties && schema.properties[requiredProperty] !== undefined) continue
    code += `if (obj['${requiredProperty}'] === undefined) throw new Error('"${requiredProperty}" is required!')\n`
  }

  return code
}

function mergeAllOfSchema (location, schema, mergedSchema) {
  const allOfLocation = mergeLocation(location, 'allOf')

  for (let i = 0; i < schema.allOf.length; i++) {
    let allOfSchema = schema.allOf[i]

    if (allOfSchema.$ref) {
      const allOfSchemaLocation = mergeLocation(allOfLocation, i)
      allOfSchema = resolveRef(allOfSchemaLocation, allOfSchema.$ref).schema
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
      mergeAllOfSchema(location, allOfSchema, mergedSchema)
    }
  }
  delete mergedSchema.allOf

  mergedSchema.$id = `merged_${randomUUID()}`
  ajvInstance.addSchema(mergedSchema)
  location.schemaId = mergedSchema.$id
}

function buildInnerObject (location) {
  const schema = location.schema
  let code = buildCode(location)
  if (schema.patternProperties) {
    code += addPatternProperties(location)
  } else if (schema.additionalProperties && !schema.patternProperties) {
    code += addAdditionalProperties(location)
  }
  return code
}

function addIfThenElse (location) {
  const schema = merge({}, location.schema)
  const thenSchema = schema.then
  const elseSchema = schema.else || { additionalProperties: true }

  delete schema.if
  delete schema.then
  delete schema.else

  const ifLocation = mergeLocation(location, 'if')
  const ifSchemaRef = ifLocation.schemaId + ifLocation.jsonPointer

  let code = `
    if (ajv.validate("${ifSchemaRef}", obj)) {
  `

  const thenLocation = mergeLocation(location, 'then')
  thenLocation.schema = merge(schema, thenSchema)

  if (thenSchema.if && thenSchema.then) {
    code += addIfThenElse(thenLocation)
  } else {
    code += buildInnerObject(thenLocation)
  }
  code += `
    }
  `

  const elseLocation = mergeLocation(location, 'else')
  elseLocation.schema = merge(schema, elseSchema)

  code += `
      else {
    `

  if (elseSchema.if && elseSchema.then) {
    code += addIfThenElse(elseLocation)
  } else {
    code += buildInnerObject(elseLocation)
  }
  code += `
      }
    `
  return code
}

function toJSON (variableName) {
  return `(${variableName} && typeof ${variableName}.toJSON === 'function')
    ? ${variableName}.toJSON()
    : ${variableName}
  `
}

function buildObject (location) {
  const schema = location.schema

  if (objectReferenceSerializersMap.has(schema)) {
    return objectReferenceSerializersMap.get(schema)
  }

  const functionName = generateFuncName()
  objectReferenceSerializersMap.set(schema, functionName)

  const schemaId = location.schemaId === rootSchemaId ? '' : location.schemaId
  let functionCode = `
    function ${functionName} (input) {
      // ${schemaId + location.jsonPointer}
  `
  if (schema.nullable) {
    functionCode += `
      if (input === null) {
        return 'null';
      }
  `
  }

  functionCode += `
      var obj = ${toJSON('input')}
      var json = '{'
      var addComma = false
  `

  if (schema.if && schema.then) {
    functionCode += addIfThenElse(location)
  } else {
    functionCode += buildInnerObject(location)
  }

  functionCode += `
      json += '}'
      return json
    }
  `

  contextFunctions.push(functionCode)
  return functionName
}

function buildArray (location) {
  let schema = location.schema

  // default to any items type
  if (!schema.items) {
    schema.items = {}
  }

  let itemsLocation = mergeLocation(location, 'items')

  if (schema.items.$ref) {
    if (!schema[fjsCloned]) {
      location.schema = clone(location.schema)
      schema = location.schema
      schema[fjsCloned] = true
    }

    location = resolveRef(location, schema.items.$ref)
    itemsLocation = location
    schema.items = location.schema
  }

  if (arrayItemsReferenceSerializersMap.has(schema.items)) {
    return arrayItemsReferenceSerializersMap.get(schema.items)
  }

  const functionName = generateFuncName()
  arrayItemsReferenceSerializersMap.set(schema.items, functionName)

  const schemaId = location.schemaId === rootSchemaId ? '' : location.schemaId
  let functionCode = `
    function ${functionName} (obj) {
      // ${schemaId + location.jsonPointer}
  `

  if (schema.nullable) {
    functionCode += `
      if (obj === null) {
        return 'null';
      }
    `
  }

  functionCode += `
    if (!Array.isArray(obj)) {
      throw new TypeError(\`The value '$\{obj}' does not match schema definition.\`)
    }
    const arrayLength = obj.length
  `

  if (!schema.additionalItems) {
    functionCode += `
      if (arrayLength > ${schema.items.length}) {
        throw new Error(\`Item at ${schema.items.length} does not match schema definition.\`)
      }
    `
  }

  if (largeArrayMechanism !== 'default') {
    if (largeArrayMechanism === 'json-stringify') {
      functionCode += `if (arrayLength && arrayLength >= ${largeArraySize}) return JSON.stringify(obj)\n`
    } else {
      throw new Error(`Unsupported large array mechanism ${largeArrayMechanism}`)
    }
  }

  functionCode += `
    let jsonOutput = ''
  `

  if (Array.isArray(schema.items)) {
    for (let i = 0; i < schema.items.length; i++) {
      const item = schema.items[i]
      const tmpRes = buildValue(mergeLocation(itemsLocation, i), `obj[${i}]`)
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
        for (let i = ${schema.items.length}; i < arrayLength; i++) {
          let json = JSON.stringify(obj[i])
          jsonOutput += json
          if (i < arrayLength - 1) {
            jsonOutput += ','
          }
        }`
    }
  } else {
    const code = buildValue(itemsLocation, 'obj[i]')
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

  contextFunctions.push(functionCode)
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
      } else {
        throw new Error(`${type} unsupported`)
      }
  }
  return condition
}

let genFuncNameCounter = 0
function generateFuncName () {
  return 'anonymous' + genFuncNameCounter++
}

function buildValue (location, input) {
  let schema = location.schema

  if (schema.$ref) {
    location = resolveRef(location, schema.$ref)
    schema = location.schema
  }

  if (schema.type === undefined) {
    const inferredType = inferTypeByKeyword(schema)
    if (inferredType) {
      schema.type = inferredType
    }
  }

  if (schema.allOf) {
    const mergedSchema = clone(schema)
    mergeAllOfSchema(location, schema, mergedSchema)
    schema = mergedSchema
    location.schema = mergedSchema
  }

  const type = schema.type
  const nullable = schema.nullable === true

  let code = ''
  let funcName

  switch (type) {
    case 'null':
      code += `
        json += serializer.asNull()
      `
      break
    case 'string': {
      funcName = getStringSerializer(schema.format, nullable)
      code += `json += ${funcName}(${input})`
      break
    }
    case 'integer':
      funcName = nullable ? 'serializer.asIntegerNullable.bind(serializer)' : 'serializer.asInteger.bind(serializer)'
      code += `json += ${funcName}(${input})`
      break
    case 'number':
      funcName = nullable ? 'serializer.asNumberNullable.bind(serializer)' : 'serializer.asNumber.bind(serializer)'
      code += `json += ${funcName}(${input})`
      break
    case 'boolean':
      funcName = nullable ? 'serializer.asBooleanNullable.bind(serializer)' : 'serializer.asBoolean.bind(serializer)'
      code += `json += ${funcName}(${input})`
      break
    case 'object':
      funcName = buildObject(location)
      code += `json += ${funcName}(${input})`
      break
    case 'array':
      funcName = buildArray(location)
      code += `json += ${funcName}(${input})`
      break
    case undefined:
      if (schema.fjs_date_type) {
        funcName = getStringSerializer(schema.fjs_date_type, nullable)
        code += `json += ${funcName}(${input})`
        break
      } else if (schema.anyOf || schema.oneOf) {
        // beware: dereferenceOfRefs has side effects and changes schema.anyOf
        const type = schema.anyOf ? 'anyOf' : 'oneOf'
        const anyOfLocation = mergeLocation(location, type)

        for (let index = 0; index < location.schema[type].length; index++) {
          const optionLocation = mergeLocation(anyOfLocation, index)
          const schemaRef = optionLocation.schemaId + optionLocation.jsonPointer
          const nestedResult = buildValue(optionLocation, input)
          code += `
            ${index === 0 ? 'if' : 'else if'}(ajv.validate("${schemaRef}", ${input}))
              ${nestedResult}
          `
        }

        code += `
          else throw new Error(\`The value $\{JSON.stringify(${input})} does not match schema definition.\`)
        `
      } else if (isEmpty(schema)) {
        code += `
          json += JSON.stringify(${input})
        `
      } else if ('const' in schema) {
        code += `
          if(ajv.validate(${JSON.stringify(schema)}, ${input}))
            json += '${JSON.stringify(schema.const)}'
          else
            throw new Error(\`Item $\{JSON.stringify(${input})} does not match schema definition.\`)
        `
      } else if (schema.type === undefined) {
        code += `
          json += JSON.stringify(${input})
        `
      } else {
        throw new Error(`${schema.type} unsupported`)
      }
      break
    default:
      if (Array.isArray(type)) {
        let sortedTypes = type
        const nullable = schema.nullable === true || type.includes('null')

        if (nullable) {
          sortedTypes = sortedTypes.filter(type => type !== 'null')
          code += `
            if (${input} === null) {
              json += null
            } else {`
        }

        const locationClone = clone(location)
        sortedTypes.forEach((type, index) => {
          const statement = index === 0 ? 'if' : 'else if'
          locationClone.schema.type = type
          const nestedResult = buildValue(locationClone, input)
          switch (type) {
            case 'string': {
              code += `
                ${statement}(${input} === null || typeof ${input} === "${type}" || ${input} instanceof Date || ${input} instanceof RegExp || (typeof ${input} === "object" && Object.hasOwnProperty.call(${input}, "toString")))
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
        code += `
          else throw new Error(\`The value $\{JSON.stringify(${input})} does not match schema definition.\`)
        `

        if (nullable) {
          code += `
            }
          `
        }
      } else {
        throw new Error(`${type} unsupported`)
      }
  }

  return code
}

// Ajv does not support js date format. In order to properly validate objects containing a date,
// it needs to replace all occurrences of the string date format with a custom keyword fjs_date_type.
// (see https://github.com/fastify/fast-json-stringify/pull/441)
function extendDateTimeType (schema) {
  if (schema === null) return

  if (schema.type === 'string' && ['date-time', 'date', 'time'].includes(schema.format)) {
    schema.fjs_date_type = schema.format
    delete schema.type
    delete schema.format
  }
  for (const property in schema) {
    if (typeof schema[property] === 'object') {
      extendDateTimeType(schema[property])
    }
  }
}

function isEmpty (schema) {
  // eslint-disable-next-line
  for (var key in schema) {
    if (schema.hasOwnProperty(key) && schema[key] !== undefined) {
      return false
    }
  }
  return true
}

module.exports = build

module.exports.validLargeArrayMechanisms = validLargeArrayMechanisms

module.exports.restore = function ({ code, ajv }) {
  const serializer = new Serializer()
  // eslint-disable-next-line
  return (Function.apply(null, ['ajv', 'serializer', code])
    .apply(null, [ajv, serializer]))
}
