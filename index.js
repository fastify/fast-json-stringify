'use strict'

/* eslint no-prototype-builtins: 0 */

const Ajv = require('ajv')
const fastUri = require('fast-uri')
const ajvFormats = require('ajv-formats')
const merge = require('deepmerge')
const clone = require('rfdc')({ proto: true })
const fjsCloned = Symbol('fast-json-stringify.cloned')
const { randomUUID } = require('crypto')

const validate = require('./schema-validator')

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

class Serializer {
  constructor (options = {}) {
    switch (options.rounding) {
      case 'floor':
        this.parseInteger = Math.floor
        break
      case 'ceil':
        this.parseInteger = Math.ceil
        break
      case 'round':
        this.parseInteger = Math.round
        break
      default:
        this.parseInteger = Math.trunc
        break
    }
  }

  asAny (i) {
    return JSON.stringify(i)
  }

  asNull () {
    return 'null'
  }

  asInteger (i) {
    if (typeof i === 'bigint') {
      return i.toString()
    } else if (Number.isInteger(i)) {
      return '' + i
    } else {
      /* eslint no-undef: "off" */
      const integer = this.parseInteger(i)
      if (Number.isNaN(integer)) {
        throw new Error(`The value "${i}" cannot be converted to an integer.`)
      } else {
        return '' + integer
      }
    }
  }

  asIntegerNullable (i) {
    return i === null ? 'null' : this.asInteger(i)
  }

  asNumber (i) {
    const num = Number(i)
    if (Number.isNaN(num)) {
      throw new Error(`The value "${i}" cannot be converted to a number.`)
    } else {
      return '' + num
    }
  }

  asNumberNullable (i) {
    return i === null ? 'null' : this.asNumber(i)
  }

  asBoolean (bool) {
    return bool && 'true' || 'false' // eslint-disable-line
  }

  asBooleanNullable (bool) {
    return bool === null ? 'null' : this.asBoolean(bool)
  }

  asDatetime (date, skipQuotes) {
    const quotes = skipQuotes === true ? '' : '"'
    if (date instanceof Date) {
      return quotes + date.toISOString() + quotes
    }
    return this.asString(date, skipQuotes)
  }

  asDatetimeNullable (date, skipQuotes) {
    return date === null ? 'null' : this.asDatetime(date, skipQuotes)
  }

  asDate (date, skipQuotes) {
    const quotes = skipQuotes === true ? '' : '"'
    if (date instanceof Date) {
      return quotes + new Date(date.getTime() - (date.getTimezoneOffset() * 60000)).toISOString().slice(0, 10) + quotes
    }
    return this.asString(date, skipQuotes)
  }

  asDateNullable (date, skipQuotes) {
    return date === null ? 'null' : this.asDate(date, skipQuotes)
  }

  asTime (date, skipQuotes) {
    const quotes = skipQuotes === true ? '' : '"'
    if (date instanceof Date) {
      return quotes + new Date(date.getTime() - (date.getTimezoneOffset() * 60000)).toISOString().slice(11, 19) + quotes
    }
    return this.asString(date, skipQuotes)
  }

  asTimeNullable (date, skipQuotes) {
    return date === null ? 'null' : this.asTime(date, skipQuotes)
  }

  asString (str, skipQuotes) {
    const quotes = skipQuotes === true ? '' : '"'
    if (str instanceof Date) {
      return quotes + str.toISOString() + quotes
    } else if (str === null) {
      return quotes + quotes
    } else if (str instanceof RegExp) {
      str = str.source
    } else if (typeof str !== 'string') {
      str = str.toString()
    }
    // If we skipQuotes it means that we are using it as test
    // no need to test the string length for the render
    if (skipQuotes) {
      return str
    }

    if (str.length < 42) {
      return this.asStringSmall(str)
    } else {
      return JSON.stringify(str)
    }
  }

  asStringNullable (str) {
    return str === null ? 'null' : this.asString(str)
  }

  // magically escape strings for json
  // relying on their charCodeAt
  // everything below 32 needs JSON.stringify()
  // every string that contain surrogate needs JSON.stringify()
  // 34 and 92 happens all the time, so we
  // have a fast case for them
  asStringSmall (str) {
    const l = str.length
    let result = ''
    let last = 0
    let found = false
    let surrogateFound = false
    let point = 255
    // eslint-disable-next-line
    for (var i = 0; i < l && point >= 32; i++) {
      point = str.charCodeAt(i)
      if (point >= 0xD800 && point <= 0xDFFF) {
        // The current character is a surrogate.
        surrogateFound = true
      }
      if (point === 34 || point === 92) {
        result += str.slice(last, i) + '\\'
        last = i
        found = true
      }
    }

    if (!found) {
      result = str
    } else {
      result += str.slice(last)
    }
    return ((point < 32) || (surrogateFound === true)) ? JSON.stringify(str) : '"' + result + '"'
  }
}

function build (schema, options) {
  arrayItemsReferenceSerializersMap.clear()
  objectReferenceSerializersMap.clear()
  schemaReferenceMap.clear()

  options = options || {}

  ajvInstance = new Ajv({ ...options.ajv, strictSchema: false, uriResolver: fastUri })
  ajvFormats(ajvInstance)

  const validateDateTimeFormat = ajvFormats.get('date-time').validate
  const validateDateFormat = ajvFormats.get('date').validate
  const validateTimeFormat = ajvFormats.get('time').validate

  ajvInstance.addKeyword({
    keyword: 'fjs_date_type',
    validate: (schema, date) => {
      if (date instanceof Date) {
        return true
      }
      if (schema === 'date-time') {
        return validateDateTimeFormat(date)
      }
      if (schema === 'date') {
        return validateDateFormat(date)
      }
      if (schema === 'time') {
        return validateTimeFormat(date)
      }
      return false
    }
  })

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

  const { code, laterCode } = buildValue('', 'main', 'input', location)
  const contextFunctionCode = `
    'use strict'
    function main (input) {
      let json = ''
      ${code}
      return json
    }
    ${laterCode}
    return main
    `

  const dependenciesName = ['ajv', 'serializer', contextFunctionCode]

  if (options.debugMode) {
    return { code: dependenciesName.join('\n'), ajv: ajvInstance }
  }

  /* eslint no-new-func: "off" */
  const contextFunc = new Function('ajv', 'serializer', contextFunctionCode)
  const stringifyFunc = contextFunc(ajvInstance, serializer)

  ajvInstance = null
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
  let laterCode = ''

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

    const valueCode = buildValue('', '', 'obj[keys[i]]', ppLocation)
    laterCode += valueCode.laterCode
    code += `
      if (/${regex.replace(/\\*\//g, '\\/')}/.test(keys[i])) {
        ${addComma}
        json += serializer.asString(keys[i]) + ':'
        ${valueCode.code}
        continue
      }
    `
  })
  if (schema.additionalProperties) {
    const additionalPropertyCode = additionalProperty(location)
    code += additionalPropertyCode.code
    laterCode += additionalPropertyCode.laterCode
  }

  code += `
      }
  `
  return { code, laterCode }
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

    return { code, laterCode: '' }
  }
  let apLocation = mergeLocation(location, { schema: ap })
  if (ap.$ref) {
    apLocation = refFinder(ap.$ref, location)
    ap = apLocation.schema
  }

  const valueCode = buildValue('', '', 'obj[keys[i]]', apLocation)

  code += `
    ${addComma}
    json += serializer.asString(keys[i]) + ':'
    ${valueCode.code}
  `

  return { code, laterCode: valueCode.laterCode }
}

function addAdditionalProperties (location) {
  const additionalPropertyCode = additionalProperty(location)
  const code = `
      var properties = ${JSON.stringify(location.schema.properties)} || {}
      var keys = Object.keys(obj)
      for (var i = 0; i < keys.length; i++) {
        if (properties[keys[i]]) continue
        ${additionalPropertyCode.code}
      }
  `

  return { code, laterCode: additionalPropertyCode.laterCode }
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

function buildCode (location, code, laterCode, locationPath) {
  if (location.schema.$ref) {
    location = refFinder(location.schema.$ref, location)
  }

  const schema = location.schema
  const required = schema.required || []

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

    const result = buildValue(laterCode, locationPath + key, `obj[${JSON.stringify(key)}]`, mergeLocation(propertyLocation, { schema: schema.properties[key] }))
    code += result.code
    laterCode = result.laterCode

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

  return { code, laterCode }
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
  const result = buildCode(location, '', '', locationPath)
  if (schema.patternProperties) {
    const { code, laterCode } = addPatternProperties(location)
    result.code += code
    result.laterCode += laterCode
  } else if (schema.additionalProperties && !schema.patternProperties) {
    const { code, laterCode } = addAdditionalProperties(location)
    result.code += code
    result.laterCode += laterCode
  }
  return result
}

function addIfThenElse (location, locationPath) {
  let code = ''
  let r
  let laterCode = ''
  let innerR

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
    innerR = addIfThenElse(mergedLocation, locationPath + 'Then')
    code += innerR.code
    laterCode = innerR.laterCode
  }

  r = buildInnerObject(mergedLocation, locationPath + 'Then')
  code += r.code
  laterCode += r.laterCode

  code += `
    }
  `
  merged = merge(copy, e)
  mergedLocation = mergeLocation(mergedLocation, { schema: merged })

  code += `
      else {
    `

  if (merged.if && merged.then) {
    innerR = addIfThenElse(mergedLocation, locationPath + 'Else')
    code += innerR.code
    laterCode += innerR.laterCode
  }

  r = buildInnerObject(mergedLocation, locationPath + 'Else')
  code += r.code
  laterCode += r.laterCode

  code += `
      }
    `
  return { code, laterCode }
}

function toJSON (variableName) {
  return `(${variableName} && typeof ${variableName}.toJSON === 'function')
    ? ${variableName}.toJSON()
    : ${variableName}
  `
}

function buildObject (location, code, functionName, locationPath) {
  const schema = location.schema
  if (schema.$id !== undefined) {
    schemaReferenceMap.set(schema.$id, schema)
  }
  code += `
    function ${functionName} (input) {
      // ${locationPath}
  `
  if (schema.nullable) {
    code += `
      if(input === null) {
        return 'null';
      }
  `
  }

  if (objectReferenceSerializersMap.has(schema) && objectReferenceSerializersMap.get(schema) !== functionName) {
    code += `
      return ${objectReferenceSerializersMap.get(schema)}(input)
    }
    `
    return code
  }
  objectReferenceSerializersMap.set(schema, functionName)

  code += `
      var obj = ${toJSON('input')}
      var json = '{'
      var addComma = false
  `

  let r
  if (schema.if && schema.then) {
    code += `
      var valid
    `
    r = addIfThenElse(location, locationPath)
  } else {
    r = buildInnerObject(location, locationPath)
  }

  // Removes the comma if is the last element of the string (in case there are not properties)
  code += `${r.code}
      json += '}'
      return json
    }
    ${r.laterCode}
  `

  return code
}

function buildArray (location, code, functionName, locationPath) {
  let schema = location.schema
  if (schema.$id !== undefined) {
    schemaReferenceMap.set(schema.$id, schema)
  }
  code += `
    function ${functionName} (obj) {
      // ${locationPath}
  `
  if (schema.nullable) {
    code += `
      if(obj === null) {
        return 'null';
      }
    `
  }
  const laterCode = ''

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

    if (arrayItemsReferenceSerializersMap.has(schema.items)) {
      code += `
      return ${arrayItemsReferenceSerializersMap.get(schema.items)}(obj)
      }
      `
      return code
    }
    arrayItemsReferenceSerializersMap.set(schema.items, functionName)
  }

  let result = { code: '', laterCode: '' }
  const accessor = '[i]'
  if (Array.isArray(schema.items)) {
    result = schema.items.reduce((res, item, i) => {
      const tmpRes = buildValue(laterCode, locationPath + accessor + i, 'obj[i]', mergeLocation(location, { schema: item }))
      const condition = `i === ${i} && ${buildArrayTypeCondition(item.type, accessor)}`
      return {
        code: `${res.code}
        ${i > 0 ? 'else' : ''} if (${condition}) {
          ${tmpRes.code}
        }`,
        laterCode: `${res.laterCode}
        ${tmpRes.laterCode}`
      }
    }, result)

    if (schema.additionalItems) {
      const tmpRes = buildValue(laterCode, locationPath + accessor, 'obj[i]', mergeLocation(location, { schema: schema.items }))
      result.code += `
      else if (i >= ${schema.items.length}) {
        ${tmpRes.code}
      }
      `
    }

    result.code += `
    else {
      throw new Error(\`Item at $\{i} does not match schema definition.\`)
    }
    `
  } else {
    result = buildValue(laterCode, locationPath + accessor, 'obj[i]', mergeLocation(location, { schema: schema.items }))
  }

  code += `
    if (!Array.isArray(obj)) {
      throw new TypeError(\`The value '$\{obj}' does not match schema definition.\`)
    }
  `

  code += 'const arrayLength = obj.length\n'
  if (largeArrayMechanism !== 'default') {
    if (largeArrayMechanism === 'json-stringify') {
      code += `if (arrayLength && arrayLength >= ${largeArraySize}) return JSON.stringify(obj)\n`
    } else {
      throw new Error(`Unsupported large array mechanism ${largeArrayMechanism}`)
    }
  }

  code += `
    let jsonOutput= ''
    for (let i = 0; i < arrayLength; i++) {
      let json = ''
      ${result.code}
      jsonOutput += json

      if (json.length > 0 && i < arrayLength - 1) {
        jsonOutput += ','
      }
    }
    return \`[\${jsonOutput}]\`
  }`

  code += `
  ${result.laterCode}
  `

  return code
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

function buildValue (laterCode, locationPath, input, location) {
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
      funcName = generateFuncName()
      laterCode = buildObject(location, laterCode, funcName, locationPath)
      code += `json += ${funcName}(${input})`
      break
    case 'array':
      funcName = generateFuncName()
      laterCode = buildArray(location, laterCode, funcName, locationPath)
      code += `json += ${funcName}(${input})`
      break
    case undefined:
      if (schema.anyOf || schema.oneOf) {
        // beware: dereferenceOfRefs has side effects and changes schema.anyOf
        const locations = dereferenceOfRefs(location, schema.anyOf ? 'anyOf' : 'oneOf')
        locations.forEach((location, index) => {
          const nestedResult = buildValue(laterCode, locationPath + 'i' + index, input, location)
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
              ${nestedResult.code}
          `
          laterCode = nestedResult.laterCode
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
          const nestedResult = buildValue(laterCode, locationPath, input, mergeLocation(location, { schema: tempSchema }))
          switch (type) {
            case 'string': {
              code += `
                ${statement}(${input} === null || typeof ${input} === "${type}" || ${input} instanceof Date || ${input} instanceof RegExp || (typeof ${input} === "object" && Object.hasOwnProperty.call(${input}, "toString")))
                  ${nestedResult.code}
              `
              break
            }
            case 'array': {
              code += `
                ${statement}(Array.isArray(${input}))
                  ${nestedResult.code}
              `
              break
            }
            case 'integer': {
              code += `
                ${statement}(Number.isInteger(${input}) || ${input} === null)
                  ${nestedResult.code}
              `
              break
            }
            default: {
              code += `
                ${statement}(typeof ${input} === "${type}" || ${input} === null)
                  ${nestedResult.code}
              `
              break
            }
          }
          laterCode = nestedResult.laterCode
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

  return { code, laterCode }
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
