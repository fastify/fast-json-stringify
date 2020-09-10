'use strict'

/* eslint no-prototype-builtins: 0 */

var Ajv = require('ajv')
var merge = require('deepmerge')

var util = require('util')
var validate = require('./schema-validator')
var stringSimilarity = null

var isLong
try {
  isLong = require('long').isLong
} catch (e) {
  isLong = null
}

var addComma = `
  if (addComma) {
    json += ','
  }
  addComma = true
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
    for (const key of Object.keys(options.schema)) {
      isValidSchema(options.schema[key], key)
    }
  }

  /* eslint no-new-func: "off" */
  var code = `
    'use strict'
  `

  code += `
    ${$pad2Zeros.toString()}
    ${$asString.toString()}
    ${$asStringNullable.toString()}
    ${$asStringSmall.toString()}
    ${$asDatetime.toString()}
    ${$asDate.toString()}
    ${$asTime.toString()}
    ${$asNumber.toString()}
    ${$asNumberNullable.toString()}
    ${$asIntegerNullable.toString()}
    ${$asNull.toString()}
    ${$asBoolean.toString()}
    ${$asBooleanNullable.toString()}
  `

  // only handle longs if the module is used
  if (isLong) {
    code += `
      var isLong = ${isLong.toString()}
      ${$asInteger.toString()}
    `
  } else {
    code += `
      var $asInteger = $asNumber
    `
  }

  var location = {
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

  var hasSchemaSomeIf = hasIf(schema)

  var main

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
      break
    default:
      throw new Error(`${schema.type} unsupported`)
  }

  code += `
    ;
     return ${main}
  `

  var dependencies = []
  var dependenciesName = []
  if (hasOf(schema) || hasSchemaSomeIf) {
    dependencies.push(new Ajv(options.ajv))
    dependenciesName.push('ajv')
  }

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
  'dependencies',
  'enum'
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
  for (const keyword of objectKeywords) {
    if (keyword in schema) return 'object'
  }
  for (const keyword of arrayKeywords) {
    if (keyword in schema) return 'array'
  }
  for (const keyword of stringKeywords) {
    if (keyword in schema) return 'string'
  }
  for (const keyword of numberKeywords) {
    if (keyword in schema) return 'number'
  }
  return schema.type
}

function hasOf (schema) {
  if (!schema) { return false }
  if ('anyOf' in schema || 'oneOf' in schema) { return true }

  var objectKeys = Object.keys(schema)
  for (var i = 0; i < objectKeys.length; i++) {
    var value = schema[objectKeys[i]]
    if (typeof value === 'object') {
      if (hasOf(value)) { return true }
    }
  }

  return false
}

function hasIf (schema) {
  const str = JSON.stringify(schema)
  return /"if":{/.test(str) && /"then":{/.test(str)
}

const stringSerializerMap = {
  'date-time': '$asDatetime',
  date: '$asDate',
  time: '$asTime'
}

function getStringSerializer (format) {
  return stringSerializerMap[format] || '$asString'
}

function $pad2Zeros (num) {
  var s = '00' + num
  return s[s.length - 2] + s[s.length - 1]
}

function $asNull () {
  return 'null'
}

function $asInteger (i) {
  if (isLong && isLong(i)) {
    return i.toString()
  } else if (typeof i === 'bigint') {
    return i.toString()
  } else {
    return $asNumber(i)
  }
}

function $asIntegerNullable (i) {
  return i === null ? null : $asInteger(i)
}

function $asNumber (i) {
  var num = Number(i)
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

function $asDatetime (date) {
  if (date instanceof Date) {
    return '"' + date.toISOString() + '"'
  } else if (date && typeof date.toISOString === 'function') {
    return '"' + date.toISOString() + '"'
  } else {
    return $asString(date)
  }
}

function $asDate (date) {
  if (date instanceof Date) {
    var year = new Intl.DateTimeFormat('en', { year: 'numeric' }).format(date)
    var month = new Intl.DateTimeFormat('en', { month: '2-digit' }).format(date)
    var day = new Intl.DateTimeFormat('en', { day: '2-digit' }).format(date)
    return '"' + year + '-' + month + '-' + day + '"'
  } else if (date && typeof date.format === 'function') {
    return '"' + date.format('YYYY-MM-DD') + '"'
  } else {
    return $asString(date)
  }
}

function $asTime (date) {
  if (date instanceof Date) {
    var hour = new Intl.DateTimeFormat('en', { hour: 'numeric', hour12: false }).format(date)
    var minute = new Intl.DateTimeFormat('en', { minute: 'numeric' }).format(date)
    var second = new Intl.DateTimeFormat('en', { second: 'numeric' }).format(date)
    return '"' + $pad2Zeros(hour) + ':' + $pad2Zeros(minute) + ':' + $pad2Zeros(second) + '"'
  } else if (date && typeof date.format === 'function') {
    return '"' + date.format('HH:mm:ss') + '"'
  } else {
    return $asString(date)
  }
}

function $asString (str) {
  if (str instanceof Date) {
    return '"' + str.toISOString() + '"'
  } else if (str === null) {
    return '""'
  } else if (str instanceof RegExp) {
    str = str.source
  } else if (typeof str !== 'string') {
    str = str.toString()
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
  var result = ''
  var last = 0
  var found = false
  var surrogateFound = false
  var l = str.length
  var point = 255
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
  var schema = location.schema
  var pp = schema.patternProperties
  var code = `
      var properties = ${JSON.stringify(schema.properties)} || {}
      var keys = Object.keys(obj)
      for (var i = 0; i < keys.length; i++) {
        if (properties[keys[i]]) continue
  `
  Object.keys(pp).forEach((regex, index) => {
    var ppLocation = mergeLocation(location, { schema: pp[regex] })
    if (pp[regex].$ref) {
      ppLocation = refFinder(pp[regex].$ref, location)
      pp[regex] = ppLocation.schema
    }
    var type = pp[regex].type
    var format = pp[regex].format
    var stringSerializer = getStringSerializer(format)
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
  var ap = location.schema.additionalProperties
  var code = ''
  if (ap === true) {
    return `
        if (obj[keys[i]] !== undefined) {
          ${addComma}
          json += $asString(keys[i]) + ':' + JSON.stringify(obj[keys[i]])
        }
    `
  }
  var apLocation = mergeLocation(location, { schema: ap })
  if (ap.$ref) {
    apLocation = refFinder(ap.$ref, location)
    ap = apLocation.schema
  }

  var type = ap.type
  var format = ap.format
  var stringSerializer = getStringSerializer(format)
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
  var externalSchema = location.externalSchema
  var root = location.root
  var schema = location.schema

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

  var code = 'return schema'
  // If it has a path
  if (ref[1]) {
    // ref[1] could contain a JSON pointer - ex: /definitions/num
    // or plain name fragment id without suffix # - ex: customId
    var walk = ref[1].split('/')
    if (walk.length === 1) {
      var targetId = `#${ref[1]}`
      var dereferenced = idFinder(schema, targetId)
      if (dereferenced === undefined && !ref[0]) {
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
      for (var i = 1; i < walk.length; i++) {
        code += `[${JSON.stringify(walk[i])}]`
      }
    }
  }
  var result
  try {
    result = (new Function('schema', code))(root)
  } catch (err) {}

  if (result === undefined) {
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

  var schema = location.schema
  var required = schema.required

  Object.keys(schema.properties || {}).forEach((key, i, a) => {
    var propertyLocation = mergeLocation(location, { schema: schema.properties[key] })
    if (schema.properties[key].$ref) {
      propertyLocation = refFinder(schema.properties[key].$ref, location)
      schema.properties[key] = propertyLocation.schema
    }

    // Using obj['key'] !== undefined instead of obj.hasOwnProperty(prop) for perf reasons,
    // see https://github.com/mcollina/fast-json-stringify/pull/3 for discussion.

    var type = schema.properties[key].type
    var nullable = schema.properties[key].nullable
    var sanitized = JSON.stringify(key)
    var asString = JSON.stringify(sanitized)

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
            var t = Number(obj[${sanitized}])
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

      var result = nested(laterCode, name, key, mergeLocation(propertyLocation, { schema: schema.properties[key] }), undefined, false)
      code += result.code
      laterCode = result.laterCode
    }

    var defaultValue = schema.properties[key].default
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
      var builtCode = buildCodeWithAllOfs(mergeLocation(location, { schema: ss }), code, laterCode, name)
      code = builtCode.code
      laterCode = builtCode.laterCode
    })
  } else {
    var builtCode = buildCode(location, code, laterCode, name)

    code = builtCode.code
    laterCode = builtCode.laterCode
  }

  return { code: code, laterCode: laterCode }
}

function buildInnerObject (location, name) {
  var schema = location.schema
  var result = buildCodeWithAllOfs(location, '', '', name)
  if (schema.patternProperties) {
    result.code += addPatternProperties(location)
  } else if (schema.additionalProperties && !schema.patternProperties) {
    result.code += addAdditionalProperties(location)
  }
  return result
}

function addIfThenElse (location, name) {
  var code = ''
  var r
  var laterCode = ''
  var innerR

  var schema = location.schema
  const copy = merge({}, schema)
  const i = copy.if
  const then = copy.then
  const e = copy.else ? copy.else : { additionalProperties: true }
  delete copy.if
  delete copy.then
  delete copy.else
  var merged = merge(copy, then)
  var mergedLocation = mergeLocation(location, { schema: merged })

  code += `
    valid = ajv.validate(${util.inspect(i, { depth: null })}, obj)
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
  return `typeof ${variableName}.toJSON === 'function'
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

  var laterCode = ''
  var r
  if (schema.if && schema.then) {
    code += `
      var valid
    `
    r = addIfThenElse(location, name)
  } else {
    r = buildInnerObject(location, name)
  }

  laterCode = r.laterCode

  // Removes the comma if is the last element of the string (in case there are not properties)
  code += `${r.code}
      json += '}'
      return json
    }
  `

  code += laterCode
  return code
}

function buildArray (location, code, name) {
  var schema = location.schema
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
  var laterCode = ''

  // default to any items type
  if (!schema.items) {
    schema.items = {}
  }

  if (schema.items.$ref) {
    location = refFinder(schema.items.$ref, location)
    schema.items = location.schema
  }

  var result = { code: '', laterCode: '' }
  if (Array.isArray(schema.items)) {
    result = schema.items.reduce((res, item, i) => {
      var accessor = '[i]'
      const tmpRes = nested(laterCode, name, accessor, mergeLocation(location, { schema: item }), i, true)
      var condition = `i === ${i} && ${buildArrayTypeCondition(item.type, accessor)}`
      return {
        code: `${res.code}
        ${i > 0 ? 'else' : ''} if (${condition}) {
          ${tmpRes.code}
        }`,
        laterCode: `${res.laterCode}
        ${tmpRes.laterCode}`
      }
    }, result)
    result.code += `
    else {
      throw new Error(\`Item at $\{i} does not match schema definition.\`)
    }
    `
  } else {
    result = nested(laterCode, name, '[i]', mergeLocation(location, { schema: schema.items }), undefined, true)
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
  `

  laterCode = result.laterCode

  code += laterCode

  return code
}

function buildArrayTypeCondition (type, accessor) {
  var condition
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
        var conditions = type.map((subType) => {
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
  var schema = location.schema
  var locations = []

  schema[type].forEach((s, index) => {
    // follow the refs
    var sLocation = mergeLocation(location, { schema: s })
    while (s.$ref) {
      sLocation = refFinder(s.$ref, sLocation)
      schema[type][index] = sLocation.schema
      s = schema[type][index]
    }
    locations[index] = sLocation
  })

  return locations
}

var strNameCounter = 0
function asFuncName (str) {
  // only allow chars that can work
  var rep = str.replace(/[^a-zA-Z0-9$_]/g, '')

  if (rep.length === 0) {
    return 'anan' + strNameCounter++
  } else if (rep !== str) {
    rep += strNameCounter++
  }

  return rep
}

function nested (laterCode, name, key, location, subKey, isArray) {
  var code = ''
  var funcName

  subKey = subKey || ''

  var schema = location.schema

  if (schema.$ref) {
    schema = refFinder(schema.$ref, location)
  }

  if (schema.type === undefined) {
    var inferredType = inferTypeByKeyword(schema)
    if (inferredType) {
      schema.type = inferredType

      if (inferredType === 'object' && schema.enum && !Object.hasOwnProperty.call(schema, 'additionalProperties')) {
        schema.additionalProperties = true
      }
    }
  }

  var type = schema.type
  var nullable = schema.nullable === true

  var accessor = isArray ? key : `[${JSON.stringify(key)}]`

  switch (type) {
    case 'null':
      code += `
        json += $asNull()
      `
      break
    case 'string':
      var stringSerializer = getStringSerializer(schema.format)
      code += nullable ? `json += obj${accessor} === null ? null : ${stringSerializer}(obj${accessor})` : `json += ${stringSerializer}(obj${accessor})`
      break
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
      laterCode = buildArray(location, laterCode, funcName)
      code += `
        json += ${funcName}(obj${accessor})
      `
      break
    case undefined:
      if ('anyOf' in schema) {
        // beware: dereferenceOfRefs has side effects and changes schema.anyOf
        var anyOfLocations = dereferenceOfRefs(location, 'anyOf')
        anyOfLocations.forEach((location, index) => {
          var nestedResult = nested(laterCode, name, key, location, subKey !== '' ? subKey : 'i' + index, isArray)

          // Since we are only passing the relevant schema to ajv.validate, it needs to be full dereferenced
          // otherwise any $ref pointing to an external schema would result in an error.
          // Full dereference of the schema happens as side effect of two functions:
          // 1. `dereferenceOfRefs` loops through the `schema.anyOf`` array and replaces any top level reference
          // with the actual schema
          // 2. `nested`, through `buildCode`, replaces any reference in object properties with the actual schema
          // (see https://github.com/fastify/fast-json-stringify/blob/6da3b3e8ac24b1ca5578223adedb4083b7adf8db/index.js#L631)
          code += `
            ${index === 0 ? 'if' : 'else if'}(ajv.validate(${require('util').inspect(location.schema, { depth: null, maxArrayLength: null })}, obj${accessor}))
              ${nestedResult.code}
          `
          laterCode = nestedResult.laterCode
        })
        code += `
          else json+= null
        `
      } else if ('oneOf' in schema) {
        // beware: dereferenceOfRefs has side effects and changes schema.oneOf
        var oneOfLocations = dereferenceOfRefs(location, 'oneOf')
        oneOfLocations.forEach((location, index) => {
          var nestedResult = nested(laterCode, name, key, location, subKey !== '' ? subKey : 'i' + index, isArray)

          // see comment on anyOf about derefencing the schema before calling ajv.validate
          code += `
            ${index === 0 ? 'if' : 'else if'}(ajv.validate(${require('util').inspect(location.schema, { depth: null, maxArrayLength: null })}, obj${accessor}))
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
      } else {
        throw new Error(`${schema.type} unsupported`)
      }
      break
    default:
      if (Array.isArray(type)) {
        const nullIndex = type.indexOf('null')
        const sortedTypes = nullIndex !== -1 ? [type[nullIndex]].concat(type.slice(0, nullIndex)).concat(type.slice(nullIndex + 1)) : type
        sortedTypes.forEach((type, index) => {
          var tempSchema = Object.assign({}, schema, { type })
          var nestedResult = nested(laterCode, name, key, mergeLocation(location, { schema: tempSchema }), subKey, isArray)

          if (type === 'string') {
            code += `
              ${index === 0 ? 'if' : 'else if'}(obj${accessor} === null || typeof obj${accessor} === "${type}" || obj${accessor} instanceof Date || typeof obj${accessor}.toISOString === "function" || obj${accessor} instanceof RegExp)
                ${nestedResult.code}
            `
          } else if (type === 'null') {
            code += `
              ${index === 0 ? 'if' : 'else if'}(obj${accessor} == null)
              ${nestedResult.code}
            `
          } else if (type === 'array') {
            code += `
              ${index === 0 ? 'if' : 'else if'}(Array.isArray(obj${accessor}))
              ${nestedResult.code}
            `
          } else if (type === 'integer') {
            code += `
              ${index === 0 ? 'if' : 'else if'}(Number.isInteger(obj${accessor}) || obj${accessor} === null)
              ${nestedResult.code}
            `
          } else if (type === 'number') {
            code += `
              ${index === 0 ? 'if' : 'else if'}(isNaN(obj${accessor}) === false)
              ${nestedResult.code}
            `
          } else {
            code += `
              ${index === 0 ? 'if' : 'else if'}(typeof obj${accessor} === "${type}")
              ${nestedResult.code}
            `
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
  for (var key in schema) {
    if (schema.hasOwnProperty(key)) return false
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
