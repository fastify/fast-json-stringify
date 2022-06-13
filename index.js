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
let stringSimilarity = null
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

function mergeLocation (source, dest) {
  return {
    schema: dest.schema || source.schema,
    root: dest.root || source.root,
    externalSchema: dest.externalSchema || source.externalSchema
  }
}

const arrayItemsReferenceSerializersMap = new Map()
const objectReferenceSerializersMap = new Map()
const schemaReferenceMap = new Map()

let ajvInstance = null
let contextFunctions = null

function build (schema, options) {
  arrayItemsReferenceSerializersMap.clear()
  objectReferenceSerializersMap.clear()
  schemaReferenceMap.clear()

  contextFunctions = []
  options = options || {}

  ajvInstance = buildAjv(options.ajv)

  isValidSchema(schema)
  if (options.schema) {
    // eslint-disable-next-line
    for (var key of Object.keys(options.schema)) {
      isValidSchema(options.schema[key], key)
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

  let location = {
    schema,
    root: schema,
    externalSchema: options.schema
  }

  if (schema.$ref) {
    location = refFinder(schema.$ref, location)
    schema = location.schema
  }

  if (schema.type === undefined) {
    schema.type = inferTypeByKeyword(schema)
  }

  const code = buildValue('main', 'input', location)

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
  contextFunctions = null
  arrayItemsReferenceSerializersMap.clear()
  objectReferenceSerializersMap.clear()
  schemaReferenceMap.clear()

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

  Object.keys(pp).forEach((regex, index) => {
    let ppLocation = mergeLocation(location, { schema: pp[regex] })
    if (pp[regex].$ref) {
      ppLocation = refFinder(pp[regex].$ref, location)
      pp[regex] = ppLocation.schema
    }

    try {
      RegExp(regex)
    } catch (err) {
      throw new Error(`${err.message}. Found at ${regex} matching ${JSON.stringify(pp[regex])}`)
    }

    const valueCode = buildValue('', 'obj[keys[i]]', ppLocation)
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
  let ap = location.schema.additionalProperties
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
  let apLocation = mergeLocation(location, { schema: ap })
  if (ap.$ref) {
    apLocation = refFinder(ap.$ref, location)
    ap = apLocation.schema
  }

  const valueCode = buildValue('', 'obj[keys[i]]', apLocation)

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

function idFinder (schema, searchedId) {
  let objSchema
  const explore = (schema, searchedId) => {
    Object.keys(schema || {}).forEach((key, i, a) => {
      if (key === '$id' && schema[key] === searchedId) {
        objSchema = schema
      } else if (objSchema === undefined && typeof schema[key] === 'object') {
        explore(schema[key], searchedId)
      }
    })
  }
  explore(schema, searchedId)
  return objSchema
}

function refFinder (ref, location) {
  const externalSchema = location.externalSchema
  let root = location.root
  let schema = location.schema

  if (externalSchema && externalSchema[ref]) {
    return {
      schema: externalSchema[ref],
      root: externalSchema[ref],
      externalSchema
    }
  }

  // Split file from walk
  ref = ref.split('#')

  // Check schemaReferenceMap for $id entry
  if (ref[0] && schemaReferenceMap.has(ref[0])) {
    schema = schemaReferenceMap.get(ref[0])
    root = schemaReferenceMap.get(ref[0])
    if (schema.$ref) {
      return refFinder(schema.$ref, {
        schema,
        root,
        externalSchema
      })
    }
  } else if (ref[0]) { // If external file
    schema = externalSchema[ref[0]]
    root = externalSchema[ref[0]]

    if (schema === undefined) {
      findBadKey(externalSchema, [ref[0]])
    }

    if (schema.$ref) {
      return refFinder(schema.$ref, {
        schema,
        root,
        externalSchema
      })
    }
  }

  let code = 'return schema'
  // If it has a path
  if (ref[1]) {
    // ref[1] could contain a JSON pointer - ex: /definitions/num
    // or plain name fragment id without suffix # - ex: customId
    const walk = ref[1].split('/')
    if (walk.length === 1) {
      const targetId = `#${ref[1]}`
      let dereferenced = idFinder(schema, targetId)
      if (dereferenced === undefined && !ref[0]) {
        // eslint-disable-next-line
        for (var key of Object.keys(externalSchema)) {
          dereferenced = idFinder(externalSchema[key], targetId)
          if (dereferenced !== undefined) {
            root = externalSchema[key]
            break
          }
        }
      }

      return {
        schema: dereferenced,
        root,
        externalSchema
      }
    } else {
      // eslint-disable-next-line
      for (var i = 1; i < walk.length; i++) {
        code += `[${JSON.stringify(walk[i])}]`
      }
    }
  }
  let result
  try {
    result = (new Function('schema', code))(root)
  } catch (err) {}

  if (result === undefined && ref[1]) {
    const walk = ref[1].split('/')
    findBadKey(schema, walk.slice(1))
  }

  if (result.$ref) {
    return refFinder(result.$ref, {
      schema,
      root,
      externalSchema
    })
  }

  return {
    schema: result,
    root,
    externalSchema
  }

  function findBadKey (obj, keys) {
    if (keys.length === 0) return null
    const key = keys.shift()
    if (obj[key] === undefined) {
      stringSimilarity = stringSimilarity || require('string-similarity')
      const { bestMatch } = stringSimilarity.findBestMatch(key, Object.keys(obj))
      if (bestMatch.rating >= 0.5) {
        throw new Error(`Cannot find reference ${JSON.stringify(key)}, did you mean ${JSON.stringify(bestMatch.target)}?`)
      } else {
        throw new Error(`Cannot find reference ${JSON.stringify(key)}`)
      }
    }
    return findBadKey(obj[key], keys)
  }
}

function buildCode (location, locationPath) {
  if (location.schema.$ref) {
    location = refFinder(location.schema.$ref, location)
  }

  const schema = location.schema
  const required = schema.required || []

  let code = ''

  Object.keys(schema.properties || {}).forEach((key) => {
    let propertyLocation = mergeLocation(location, { schema: schema.properties[key] })
    if (schema.properties[key].$ref) {
      propertyLocation = refFinder(schema.properties[key].$ref, location)
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

    code += buildValue(locationPath + key, `obj[${JSON.stringify(key)}]`, mergeLocation(propertyLocation, { schema: schema.properties[key] }))

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
  for (let allOfSchema of schema.allOf) {
    if (allOfSchema.$ref) {
      allOfSchema = refFinder(allOfSchema.$ref, mergeLocation(location, { schema: allOfSchema })).schema
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
}

function buildInnerObject (location, locationPath) {
  const schema = location.schema
  let code = buildCode(location, locationPath)
  if (schema.patternProperties) {
    code += addPatternProperties(location)
  } else if (schema.additionalProperties && !schema.patternProperties) {
    code += addAdditionalProperties(location)
  }
  return code
}

function addIfThenElse (location, locationPath) {
  let code = ''

  const schema = location.schema
  const copy = merge({}, schema)
  const i = copy.if
  const then = copy.then
  const e = copy.else ? copy.else : { additionalProperties: true }
  delete copy.if
  delete copy.then
  delete copy.else
  let merged = merge(copy, then)
  let mergedLocation = mergeLocation(location, { schema: merged })

  const schemaKey = i.$id || randomUUID()
  ajvInstance.addSchema(i, schemaKey)

  code += `
    valid = ajv.validate("${schemaKey}", obj)
    if (valid) {
  `
  if (merged.if && merged.then) {
    code += addIfThenElse(mergedLocation, locationPath + 'Then')
  }

  code += buildInnerObject(mergedLocation, locationPath + 'Then')

  code += `
    }
  `
  merged = merge(copy, e)
  mergedLocation = mergeLocation(mergedLocation, { schema: merged })

  code += `
      else {
    `

  if (merged.if && merged.then) {
    code += addIfThenElse(mergedLocation, locationPath + 'Else')
  }

  code += buildInnerObject(mergedLocation, locationPath + 'Else')

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

function buildObject (location, locationPath) {
  const schema = location.schema
  if (schema.$id !== undefined) {
    schemaReferenceMap.set(schema.$id, schema)
  }

  if (objectReferenceSerializersMap.has(schema)) {
    return objectReferenceSerializersMap.get(schema)
  }

  const functionName = generateFuncName()
  objectReferenceSerializersMap.set(schema, functionName)

  let functionCode = `
    function ${functionName} (input) {
      // ${locationPath}
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

  let rCode
  if (schema.if && schema.then) {
    functionCode += `
      var valid
    `
    rCode = addIfThenElse(location, locationPath)
  } else {
    rCode = buildInnerObject(location, locationPath)
  }

  // Removes the comma if is the last element of the string (in case there are not properties)
  functionCode += `${rCode}
      json += '}'
      return json
    }
  `

  contextFunctions.push(functionCode)
  return functionName
}

function buildArray (location, locationPath) {
  let schema = location.schema
  if (schema.$id !== undefined) {
    schemaReferenceMap.set(schema.$id, schema)
  }

  // default to any items type
  if (!schema.items) {
    schema.items = {}
  }

  if (schema.items.$ref) {
    if (!schema[fjsCloned]) {
      location.schema = clone(location.schema)
      schema = location.schema
      schema[fjsCloned] = true
    }

    location = refFinder(schema.items.$ref, location)
    schema.items = location.schema
  }

  if (arrayItemsReferenceSerializersMap.has(schema.items)) {
    return arrayItemsReferenceSerializersMap.get(schema.items)
  }

  const functionName = generateFuncName()
  arrayItemsReferenceSerializersMap.set(schema.items, functionName)

  let functionCode = `
    function ${functionName} (obj) {
      // ${locationPath}
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

  const accessor = '[i]'
  if (Array.isArray(schema.items)) {
    for (let i = 0; i < schema.items.length; i++) {
      const item = schema.items[i]
      const tmpRes = buildValue(locationPath + accessor + i, `obj[${i}]`, mergeLocation(location, { schema: item }))
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
    const code = buildValue(locationPath + accessor, 'obj[i]', mergeLocation(location, { schema: schema.items }))
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

function dereferenceOfRefs (location, type) {
  if (!location.schema[fjsCloned]) {
    const schemaClone = clone(location.schema)
    schemaClone[fjsCloned] = true
    location.schema = schemaClone
  }

  const schema = location.schema
  const locations = []

  schema[type].forEach((s, index) => {
    // follow the refs
    let sLocation = mergeLocation(location, { schema: s })
    while (s.$ref) {
      sLocation = refFinder(s.$ref, sLocation)
      schema[type][index] = sLocation.schema
      s = schema[type][index]
    }
    locations[index] = sLocation
  })

  return locations
}

let genFuncNameCounter = 0
function generateFuncName () {
  return 'anonymous' + genFuncNameCounter++
}

function buildValue (locationPath, input, location) {
  let schema = location.schema

  if (schema.$ref) {
    schema = refFinder(schema.$ref, location)
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
      funcName = buildObject(location, locationPath)
      code += `json += ${funcName}(${input})`
      break
    case 'array':
      funcName = buildArray(location, locationPath)
      code += `json += ${funcName}(${input})`
      break
    case undefined:
      if (schema.anyOf || schema.oneOf) {
        // beware: dereferenceOfRefs has side effects and changes schema.anyOf
        const locations = dereferenceOfRefs(location, schema.anyOf ? 'anyOf' : 'oneOf')
        locations.forEach((location, index) => {
          const nestedResult = buildValue(locationPath + 'i' + index, input, location)
          // Since we are only passing the relevant schema to ajv.validate, it needs to be full dereferenced
          // otherwise any $ref pointing to an external schema would result in an error.
          // Full dereference of the schema happens as side effect of two functions:
          // 1. `dereferenceOfRefs` loops through the `schema.anyOf`` array and replaces any top level reference
          // with the actual schema
          // 2. `buildValue`, through `buildCode`, replaces any reference in object properties with the actual schema
          // (see https://github.com/fastify/fast-json-stringify/blob/6da3b3e8ac24b1ca5578223adedb4083b7adf8db/index.js#L631)

          // Ajv does not support js date format. In order to properly validate objects containing a date,
          // it needs to replace all occurrences of the string date format with a custom keyword fjs_date_type.
          // (see https://github.com/fastify/fast-json-stringify/pull/441)
          const extendedSchema = clone(location.schema)
          extendDateTimeType(extendedSchema)

          const schemaKey = location.schema.$id || randomUUID()
          ajvInstance.addSchema(extendedSchema, schemaKey)

          code += `
            ${index === 0 ? 'if' : 'else if'}(ajv.validate("${schemaKey}", ${input}))
              ${nestedResult}
          `
        })

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

        sortedTypes.forEach((type, index) => {
          const statement = index === 0 ? 'if' : 'else if'
          const tempSchema = Object.assign({}, schema, { type })
          const nestedResult = buildValue(locationPath, input, mergeLocation(location, { schema: tempSchema }))
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

function extendDateTimeType (schema) {
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
