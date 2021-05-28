'use strict'

/* eslint no-prototype-builtins: 0 */

const Ajv = require('ajv')
const merge = require('deepmerge')
const clone = require('rfdc')({ proto: true })
const fjsCloned = Symbol('fast-json-stringify.cloned')

const validate = require('./schema-validator')
let stringSimilarity = null

let isLong
try {
  isLong = require('long').isLong
} catch (e) {
  isLong = null
}

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
    const err = new Error(`${name}schema is invalid: data${first.dataPath} ${first.message}`)
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

function build (schema, options) {
  options = options || {}
  isValidSchema(schema)
  if (options.schema) {
    // eslint-disable-next-line
    for (var key of Object.keys(options.schema)) {
      isValidSchema(options.schema[key], key)
    }
  }

  let intParseFunctionName = 'trunc'
  if (options.rounding) {
    if (['floor', 'ceil', 'round'].includes(options.rounding)) {
      intParseFunctionName = options.rounding
    } else {
      throw new Error(`Unsupported integer rounding method ${options.rounding}`)
    }
  }

  /* eslint no-new-func: "off" */
  let code = `
    'use strict'
  `

  code += `
    ${$pad2Zeros.toString()}
    ${$asAny.toString()}
    ${$asString.toString()}
    ${$asStringNullable.toString()}
    ${$asStringSmall.toString()}
    ${$asDatetime.toString()}
    ${$asDate.toString()}
    ${$asTime.toString()}
    ${$asNumber.toString()}
    ${$asNumberNullable.toString()}
    ${$asInteger.toString()}
    ${$asIntegerNullable.toString()}
    ${$asNull.toString()}
    ${$asBoolean.toString()}
    ${$asBooleanNullable.toString()}

    var isLong = ${isLong ? isLong.toString() : false}

    function parseInteger(int) { return Math.${intParseFunctionName}(int) }
    `

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

  let main

  switch (schema.type) {
    case 'object':
      main = '$main'
      code = buildObject(location, code, main)
      break
    case 'string':
      main = schema.nullable ? $asStringNullable.name : getStringSerializer(schema.format)
      break
    case 'integer':
      main = schema.nullable ? $asIntegerNullable.name : $asInteger.name
      break
    case 'number':
      main = schema.nullable ? $asNumberNullable.name : $asNumber.name
      break
    case 'boolean':
      main = schema.nullable ? $asBooleanNullable.name : $asBoolean.name
      break
    case 'null':
      main = $asNull.name
      break
    case 'array':
      main = '$main'
      code = buildArray(location, code, main)
      schema = location.schema
      break
    case undefined:
      main = '$asAny'
      break
    default:
      throw new Error(`${schema.type} unsupported`)
  }

  code += `
    ;
     return ${main}
  `

  const dependencies = [new Ajv(options.ajv)]
  const dependenciesName = ['ajv']
  dependenciesName.push(code)

  if (options.debugMode) {
    dependenciesName.toString = function () {
      return dependenciesName.join('\n')
    }
    return dependenciesName
  }

  return (Function.apply(null, dependenciesName).apply(null, dependencies))
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
 * https://json-schema.org/latest/json-schema-validation.html#rfc.section.6
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

const stringSerializerMap = {
  'date-time': '$asDatetime',
  date: '$asDate',
  time: '$asTime'
}

function getStringSerializer (format) {
  return stringSerializerMap[format] ||
  '$asString'
}

function getTestSerializer (format) {
  return stringSerializerMap[format]
}

function $pad2Zeros (num) {
  const s = '00' + num
  return s[s.length - 2] + s[s.length - 1]
}

function $asAny (i) {
  return JSON.stringify(i)
}

function $asNull () {
  return 'null'
}

function $asInteger (i) {
  if (isLong && isLong(i)) {
    return i.toString()
  } else if (typeof i === 'bigint') {
    return i.toString()
  } else if (Number.isInteger(i)) {
    return $asNumber(i)
  } else {
    /* eslint no-undef: "off" */
    return $asNumber(parseInteger(i))
  }
}

function $asIntegerNullable (i) {
  return i === null ? null : $asInteger(i)
}

function $asNumber (i) {
  const num = Number(i)
  if (isNaN(num)) {
    return 'null'
  } else {
    return '' + num
  }
}

function $asNumberNullable (i) {
  return i === null ? null : $asNumber(i)
}

function $asBoolean (bool) {
  return bool && 'true' || 'false' // eslint-disable-line
}

function $asBooleanNullable (bool) {
  return bool === null ? null : $asBoolean(bool)
}

function $asDatetime (date, skipQuotes) {
  const quotes = skipQuotes === true ? '' : '"'
  if (date instanceof Date) {
    return quotes + date.toISOString() + quotes
  } else if (date && typeof date.toISOString === 'function') {
    return quotes + date.toISOString() + quotes
  } else {
    return $asString(date, skipQuotes)
  }
}

function $asDate (date, skipQuotes) {
  const quotes = skipQuotes === true ? '' : '"'
  if (date instanceof Date) {
    const year = new Intl.DateTimeFormat('en', { year: 'numeric' }).format(date)
    const month = new Intl.DateTimeFormat('en', { month: '2-digit' }).format(date)
    const day = new Intl.DateTimeFormat('en', { day: '2-digit' }).format(date)
    return quotes + year + '-' + month + '-' + day + quotes
  } else if (date && typeof date.format === 'function') {
    return quotes + date.format('YYYY-MM-DD') + quotes
  } else {
    return $asString(date, skipQuotes)
  }
}

function $asTime (date, skipQuotes) {
  const quotes = skipQuotes === true ? '' : '"'
  if (date instanceof Date) {
    const hour = new Intl.DateTimeFormat('en', { hour: 'numeric', hour12: false }).format(date)
    const minute = new Intl.DateTimeFormat('en', { minute: 'numeric' }).format(date)
    const second = new Intl.DateTimeFormat('en', { second: 'numeric' }).format(date)
    return quotes + $pad2Zeros(hour) + ':' + $pad2Zeros(minute) + ':' + $pad2Zeros(second) + quotes
  } else if (date && typeof date.format === 'function') {
    return quotes + date.format('HH:mm:ss') + quotes
  } else {
    return $asString(date, skipQuotes)
  }
}

function $asString (str, skipQuotes) {
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
    return $asStringSmall(str)
  } else {
    return JSON.stringify(str)
  }
}

function $asStringNullable (str) {
  return str === null ? null : $asString(str)
}

// magically escape strings for json
// relying on their charCodeAt
// everything below 32 needs JSON.stringify()
// every string that contain surrogate needs JSON.stringify()
// 34 and 92 happens all the time, so we
// have a fast case for them
function $asStringSmall (str) {
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
    const type = pp[regex].type
    const format = pp[regex].format
    const stringSerializer = getStringSerializer(format)
    try {
      RegExp(regex)
    } catch (err) {
      throw new Error(`${err.message}. Found at ${regex} matching ${JSON.stringify(pp[regex])}`)
    }
    code += `
        if (/${regex.replace(/\\*\//g, '\\/')}/.test(keys[i])) {
    `
    if (type === 'object') {
      code += `${buildObject(ppLocation, '', 'buildObjectPP' + index)}
          ${addComma}
          json += $asString(keys[i]) + ':' + buildObjectPP${index}(obj[keys[i]])
      `
    } else if (type === 'array') {
      code += `${buildArray(ppLocation, '', 'buildArrayPP' + index)}
          ${addComma}
          json += $asString(keys[i]) + ':' + buildArrayPP${index}(obj[keys[i]])
      `
    } else if (type === 'null') {
      code += `
          ${addComma}
          json += $asString(keys[i]) +':null'
      `
    } else if (type === 'string') {
      code += `
          ${addComma}
          json += $asString(keys[i]) + ':' + ${stringSerializer}(obj[keys[i]])
      `
    } else if (type === 'integer') {
      code += `
          ${addComma}
          json += $asString(keys[i]) + ':' + $asInteger(obj[keys[i]])
      `
    } else if (type === 'number') {
      code += `
          ${addComma}
          json += $asString(keys[i]) + ':' + $asNumber(obj[keys[i]])
      `
    } else if (type === 'boolean') {
      code += `
          ${addComma}
          json += $asString(keys[i]) + ':' + $asBoolean(obj[keys[i]])
      `
    } else if (type === undefined) {
      code += `
          ${addComma}
          json += $asString(keys[i]) + ':' + $asAny(obj[keys[i]])
      `
    } else {
      code += `
        throw new Error('Cannot coerce ' + obj[keys[i]] + ' to ' + ${JSON.stringify(type)})
      `
    }

    code += `
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
    return `
        if (obj[keys[i]] !== undefined && typeof obj[keys[i]] !== 'function' && typeof obj[keys[i]] !== 'symbol') {
          ${addComma}
          json += $asString(keys[i]) + ':' + JSON.stringify(obj[keys[i]])
        }
    `
  }
  let apLocation = mergeLocation(location, { schema: ap })
  if (ap.$ref) {
    apLocation = refFinder(ap.$ref, location)
    ap = apLocation.schema
  }

  const type = ap.type
  const format = ap.format
  const stringSerializer = getStringSerializer(format)
  if (type === 'object') {
    code += `${buildObject(apLocation, '', 'buildObjectAP')}
        ${addComma}
        json += $asString(keys[i]) + ':' + buildObjectAP(obj[keys[i]])
    `
  } else if (type === 'array') {
    code += `${buildArray(apLocation, '', 'buildArrayAP')}
        ${addComma}
        json += $asString(keys[i]) + ':' + buildArrayAP(obj[keys[i]])
    `
  } else if (type === 'null') {
    code += `
        ${addComma}
        json += $asString(keys[i]) +':null'
    `
  } else if (type === 'string') {
    code += `
        ${addComma}
        json += $asString(keys[i]) + ':' + ${stringSerializer}(obj[keys[i]])
    `
  } else if (type === 'integer') {
    code += `
        var t = Number(obj[keys[i]])
    `
    if (isLong) {
      code += `
          if (isLong(obj[keys[i]]) || !isNaN(t)) {
            ${addComma}
            json += $asString(keys[i]) + ':' + $asInteger(obj[keys[i]])
          }
      `
    } else {
      code += `
          if (!isNaN(t)) {
            ${addComma}
            json += $asString(keys[i]) + ':' + t
          }
      `
    }
  } else if (type === 'number') {
    code += `
        var t = Number(obj[keys[i]])
        if (!isNaN(t)) {
          ${addComma}
          json += $asString(keys[i]) + ':' + t
        }
    `
  } else if (type === 'boolean') {
    code += `
        ${addComma}
        json += $asString(keys[i]) + ':' + $asBoolean(obj[keys[i]])
    `
  } else if (type === undefined) {
    code += `
        ${addComma}
        json += $asString(keys[i]) + ':' + $asAny(obj[keys[i]])
    `
  } else {
    code += `
        throw new Error('Cannot coerce ' + obj[keys[i]] + ' to ' + ${JSON.stringify(type)})
    `
  }
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
      externalSchema: externalSchema
    }
  }

  // Split file from walk
  ref = ref.split('#')

  // If external file
  if (ref[0]) {
    schema = externalSchema[ref[0]]
    root = externalSchema[ref[0]]

    if (schema === undefined) {
      findBadKey(externalSchema, [ref[0]])
    }

    if (schema.$ref) {
      return refFinder(schema.$ref, {
        schema: schema,
        root: root,
        externalSchema: externalSchema
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
        root: root,
        externalSchema: externalSchema
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
      schema: schema,
      root: root,
      externalSchema: externalSchema
    })
  }

  return {
    schema: result,
    root: root,
    externalSchema: externalSchema
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

function buildCode (location, code, laterCode, name) {
  if (location.schema.$ref) {
    location = refFinder(location.schema.$ref, location)
  }

  const schema = location.schema
  let required = schema.required

  Object.keys(schema.properties || {}).forEach((key, i, a) => {
    let propertyLocation = mergeLocation(location, { schema: schema.properties[key] })
    if (schema.properties[key].$ref) {
      propertyLocation = refFinder(schema.properties[key].$ref, location)
      schema.properties[key] = propertyLocation.schema
    }

    // Using obj['key'] !== undefined instead of obj.hasOwnProperty(prop) for perf reasons,
    // see https://github.com/mcollina/fast-json-stringify/pull/3 for discussion.

    const type = schema.properties[key].type
    const nullable = schema.properties[key].nullable
    const sanitized = JSON.stringify(key)
    const asString = JSON.stringify(sanitized)

    if (nullable) {
      code += `
        if (obj[${sanitized}] === null) {
          ${addComma}
          json += ${asString} + ':null'
          var rendered = true
        } else {
      `
    }

    if (type === 'number') {
      code += `
          var t = Number(obj[${sanitized}])
          if (!isNaN(t)) {
            ${addComma}
            json += ${asString} + ':' + t
      `
    } else if (type === 'integer') {
      code += `
          var rendered = false
      `
      if (isLong) {
        code += `
            if (isLong(obj[${sanitized}])) {
              ${addComma}
              json += ${asString} + ':' + obj[${sanitized}].toString()
              rendered = true
            } else {
              var t = Number(obj[${sanitized}])
              if (!isNaN(t)) {
                ${addComma}
                json += ${asString} + ':' + t
                rendered = true
              }
            }
        `
      } else {
        code += `
            var t = $asInteger(obj[${sanitized}])
            if (!isNaN(t)) {
              ${addComma}
              json += ${asString} + ':' + t
              rendered = true
            }
        `
      }
      code += `
          if (rendered) {
      `
    } else {
      code += `
        if (obj[${sanitized}] !== undefined) {
          ${addComma}
          json += ${asString} + ':'
        `

      const result = nested(laterCode, name, key, mergeLocation(propertyLocation, { schema: schema.properties[key] }), undefined, false)
      code += result.code
      laterCode = result.laterCode
    }

    const defaultValue = schema.properties[key].default
    if (defaultValue !== undefined) {
      required = filterRequired(required, key)
      code += `
      } else {
        ${addComma}
        json += ${asString} + ':' + ${JSON.stringify(JSON.stringify(defaultValue))}
      `
    } else if (required && required.indexOf(key) !== -1) {
      required = filterRequired(required, key)
      code += `
      } else {
        throw new Error('${sanitized} is required!')
      `
    }

    code += `
      }
    `

    if (nullable) {
      code += `
        }
      `
    }
  })

  if (required && required.length > 0) {
    code += 'var required = ['
    // eslint-disable-next-line
    for (var i = 0; i < required.length; i++) {
      if (i > 0) {
        code += ','
      }
      code += `${JSON.stringify(required[i])}`
    }
    code += `]
      for (var i = 0; i < required.length; i++) {
        if (obj[required[i]] === undefined) throw new Error('"' + required[i] + '" is required!')
      }
    `
  }

  return { code: code, laterCode: laterCode }
}

function filterRequired (required, key) {
  if (!required) {
    return required
  }
  return required.filter(k => k !== key)
}

function buildCodeWithAllOfs (location, code, laterCode, name) {
  if (location.schema.allOf) {
    location.schema.allOf.forEach((ss) => {
      const builtCode = buildCodeWithAllOfs(mergeLocation(location, { schema: ss }), code, laterCode, name)
      code = builtCode.code
      laterCode = builtCode.laterCode
    })
  } else {
    const builtCode = buildCode(location, code, laterCode, name)

    code = builtCode.code
    laterCode = builtCode.laterCode
  }

  return { code: code, laterCode: laterCode }
}

function buildInnerObject (location, name) {
  const schema = location.schema
  const result = buildCodeWithAllOfs(location, '', '', name)
  if (schema.patternProperties) {
    result.code += addPatternProperties(location)
  } else if (schema.additionalProperties && !schema.patternProperties) {
    result.code += addAdditionalProperties(location)
  }
  return result
}

function addIfThenElse (location, name) {
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

  code += `
    valid = ajv.validate(${JSON.stringify(i)}, obj)
    if (valid) {
  `
  if (merged.if && merged.then) {
    innerR = addIfThenElse(mergedLocation, name + 'Then')
    code += innerR.code
    laterCode = innerR.laterCode
  }

  r = buildInnerObject(mergedLocation, name + 'Then')
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
    innerR = addIfThenElse(mergedLocation, name + 'Else')
    code += innerR.code
    laterCode += innerR.laterCode
  }

  r = buildInnerObject(mergedLocation, name + 'Else')
  code += r.code
  laterCode += r.laterCode

  code += `
      }
    `
  return { code: code, laterCode: laterCode }
}

function toJSON (variableName) {
  return `(${variableName} && typeof ${variableName}.toJSON === 'function')
    ? ${variableName}.toJSON()
    : ${variableName}
  `
}

function buildObject (location, code, name) {
  const schema = location.schema

  code += `
    function ${name} (input) {
  `
  if (schema.nullable) {
    code += `
      if(input === null) {
        return '${$asNull()}';
      }
  `
  }
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
    r = addIfThenElse(location, name)
  } else {
    r = buildInnerObject(location, name)
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

function buildArray (location, code, name, key = null) {
  let schema = location.schema
  code += `
    function ${name} (obj) {
  `
  if (schema.nullable) {
    code += `
      if(obj === null) {
        return '${$asNull()}';
      }
    `
  }
  code += `
      var json = '['
  `
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
  }

  let result = { code: '', laterCode: '' }
  const accessor = '[i]'
  if (Array.isArray(schema.items)) {
    result = schema.items.reduce((res, item, i) => {
      const tmpRes = nested(laterCode, name, accessor, mergeLocation(location, { schema: item }), i, true)
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
      const tmpRes = nested(laterCode, name, accessor, mergeLocation(location, { schema: schema.items }), undefined, true)
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
    result = nested(laterCode, name, accessor, mergeLocation(location, { schema: schema.items }), undefined, true)
  }

  if (key) {
    code += `
    if(!Array.isArray(obj)) {
      throw new TypeError(\`Property '${key}' should be of type array, received '$\{obj}' instead.\`)
    }
    `
  }

  code += `
    var l = obj.length
    var w = l - 1
    for (var i = 0; i < l; i++) {
      if (i > 0) {
        json += ','
      }
      ${result.code}
    }
    json += ']'
    return json
  }
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

let strNameCounter = 0
function asFuncName (str) {
  // only allow chars that can work
  let rep = str.replace(/[^a-zA-Z0-9$_]/g, '')

  if (rep.length === 0) {
    return 'anan' + strNameCounter++
  } else if (rep !== str) {
    rep += strNameCounter++
  }

  return rep
}

function nested (laterCode, name, key, location, subKey, isArray) {
  let code = ''
  let funcName

  subKey = subKey || ''

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

  const type = schema.type
  const nullable = schema.nullable === true

  const accessor = isArray ? key : `[${JSON.stringify(key)}]`

  switch (type) {
    case 'null':
      code += `
        json += $asNull()
      `
      break
    case 'string': {
      const stringSerializer = getStringSerializer(schema.format)
      code += nullable ? `json += obj${accessor} === null ? null : ${stringSerializer}(obj${accessor})` : `json += ${stringSerializer}(obj${accessor})`
      break
    }
    case 'integer':
      code += nullable ? `json += obj${accessor} === null ? null : $asInteger(obj${accessor})` : `json += $asInteger(obj${accessor})`
      break
    case 'number':
      code += nullable ? `json += obj${accessor} === null ? null : $asNumber(obj${accessor})` : `json += $asNumber(obj${accessor})`
      break
    case 'boolean':
      code += nullable ? `json += obj${accessor} === null ? null : $asBoolean(obj${accessor})` : `json += $asBoolean(obj${accessor})`
      break
    case 'object':
      funcName = asFuncName(name + key + subKey)
      laterCode = buildObject(location, laterCode, funcName)
      code += `
        json += ${funcName}(obj${accessor})
      `
      break
    case 'array':
      funcName = asFuncName('$arr' + name + key + subKey) // eslint-disable-line
      laterCode = buildArray(location, laterCode, funcName, key)
      code += `
        json += ${funcName}(obj${accessor})
      `
      break
    case undefined:
      if ('anyOf' in schema) {
        // beware: dereferenceOfRefs has side effects and changes schema.anyOf
        const anyOfLocations = dereferenceOfRefs(location, 'anyOf')
        anyOfLocations.forEach((location, index) => {
          const nestedResult = nested(laterCode, name, key, location, subKey !== '' ? subKey : 'i' + index, isArray)
          // We need a test serializer as the String serializer will not work with
          // date/time ajv validations
          // see: https://github.com/fastify/fast-json-stringify/issues/325
          const testSerializer = getTestSerializer(location.schema.format)
          const testValue = testSerializer !== undefined ? `${testSerializer}(obj${accessor}, true)` : `obj${accessor}`

          // Since we are only passing the relevant schema to ajv.validate, it needs to be full dereferenced
          // otherwise any $ref pointing to an external schema would result in an error.
          // Full dereference of the schema happens as side effect of two functions:
          // 1. `dereferenceOfRefs` loops through the `schema.anyOf`` array and replaces any top level reference
          // with the actual schema
          // 2. `nested`, through `buildCode`, replaces any reference in object properties with the actual schema
          // (see https://github.com/fastify/fast-json-stringify/blob/6da3b3e8ac24b1ca5578223adedb4083b7adf8db/index.js#L631)
          code += `
            ${index === 0 ? 'if' : 'else if'}(ajv.validate(${JSON.stringify(location.schema)}, ${testValue}))
              ${nestedResult.code}
          `
          laterCode = nestedResult.laterCode
        })
        code += `
          else json+= null
        `
      } else if ('oneOf' in schema) {
        // beware: dereferenceOfRefs has side effects and changes schema.oneOf
        const oneOfLocations = dereferenceOfRefs(location, 'oneOf')
        oneOfLocations.forEach((location, index) => {
          const nestedResult = nested(laterCode, name, key, location, subKey !== '' ? subKey : 'i' + index, isArray)
          const testSerializer = getTestSerializer(location.schema.format)
          const testValue = testSerializer !== undefined ? `${testSerializer}(obj${accessor}, true)` : `obj${accessor}`
          // see comment on anyOf about dereferencing the schema before calling ajv.validate
          code += `
            ${index === 0 ? 'if' : 'else if'}(ajv.validate(${JSON.stringify(location.schema)}, ${testValue}))
              ${nestedResult.code}
          `
          laterCode = nestedResult.laterCode
        })
        code += `
          else json+= null
        `
      } else if (isEmpty(schema)) {
        code += `
          json += JSON.stringify(obj${accessor})
        `
      } else if ('const' in schema) {
        code += `
          if(ajv.validate(${JSON.stringify(schema)}, obj${accessor}))
            json += '${JSON.stringify(schema.const)}'
          else
            throw new Error(\`Item $\{JSON.stringify(obj${accessor})} does not match schema definition.\`)
        `
      } else if (schema.type === undefined) {
        code += `
          json += JSON.stringify(obj${accessor})
        `
      } else {
        throw new Error(`${schema.type} unsupported`)
      }
      break
    default:
      if (Array.isArray(type)) {
        const nullIndex = type.indexOf('null')
        const sortedTypes = nullIndex !== -1 ? [type[nullIndex]].concat(type.slice(0, nullIndex)).concat(type.slice(nullIndex + 1)) : type
        sortedTypes.forEach((type, index) => {
          const statement = index === 0 ? 'if' : 'else if'
          const tempSchema = Object.assign({}, schema, { type })
          const nestedResult = nested(laterCode, name, key, mergeLocation(location, { schema: tempSchema }), subKey, isArray)
          switch (type) {
            case 'string': {
              code += `
                ${statement}(obj${accessor} === null || typeof obj${accessor} === "${type}" || obj${accessor} instanceof Date || typeof obj${accessor}.toISOString === "function" || obj${accessor} instanceof RegExp || (typeof obj${accessor} === "object" && Object.hasOwnProperty.call(obj${accessor}, "toString")))
                  ${nestedResult.code}
              `
              break
            }
            case 'null': {
              code += `
                ${statement}(obj${accessor} == null)
                  ${nestedResult.code}
              `
              break
            }
            case 'array': {
              code += `
                ${statement}(Array.isArray(obj${accessor}))
                  ${nestedResult.code}
              `
              break
            }
            case 'integer': {
              code += `
                ${statement}(Number.isInteger(obj${accessor}) || obj${accessor} === null)
                  ${nestedResult.code}
              `
              break
            }
            case 'number': {
              code += `
                ${statement}(isNaN(obj${accessor}) === false)
                  ${nestedResult.code}
              `
              break
            }
            default: {
              code += `
                ${statement}(typeof obj${accessor} === "${type}")
                  ${nestedResult.code}
              `
              break
            }
          }
          laterCode = nestedResult.laterCode
        })
        code += `
          else json+= null
        `
      } else {
        throw new Error(`${type} unsupported`)
      }
  }

  return {
    code,
    laterCode
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

module.exports.restore = function (debugModeStr, options = {}) {
  const dependencies = [debugModeStr]
  const args = []
  if (debugModeStr.startsWith('ajv')) {
    dependencies.unshift('ajv')
    args.push(new Ajv(options.ajv))
  }

  // eslint-disable-next-line
  return (Function.apply(null, ['ajv', debugModeStr])
    .apply(null, args))
}
