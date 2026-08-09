'use strict'

/* eslint no-prototype-builtins: 0 */

const { RefResolver } = require('json-schema-ref-resolver')

const Serializer = require('./lib/serializer')
const Validator = require('./lib/validator')
const Location = require('./lib/location')
const validate = require('./lib/schema-validator')
const mergeSchemas = require('./lib/merge-schemas')

let largeArraySize = 2e4
let largeArrayMechanism = 'default'

const NAMED_FRAGMENT_REF = /^#[a-z_][-\w._]*$/i

const serializerFns = `
const {
  asString,
  asNumber,
  asBoolean,
  asDateTime,
  asDate,
  asTime,
  asUnsafeString
} = serializer

const parseInteger = serializer.parseInteger

// Inlined here instead of calling the serializer method: a plain function
// call is measurably faster than a bound method call in hot paths.
function asInteger (i) {
  if (Number.isInteger(i)) {
    return '' + i
  } else if (typeof i === 'bigint') {
    return i.toString()
  }
  const integer = parseInteger(i)
  // check if number is Infinity or NaN
  if (integer === Infinity || integer === -Infinity || integer !== integer) {
    throw new Error('The value "' + i + '" cannot be converted to an integer.')
  }
  return '' + integer
}

`

const validRoundingMethods = new Set([
  'floor',
  'ceil',
  'round',
  'trunc'
])

const validLargeArrayMechanisms = new Set([
  'default',
  'json-stringify'
])

let schemaIdCounter = 0

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

function resolveRef (context, location) {
  const ref = location.schema.$ref

  let hashIndex = ref.indexOf('#')
  if (hashIndex === -1) {
    hashIndex = ref.length
  }

  const schemaId = ref.slice(0, hashIndex) || location.schemaId
  const jsonPointer = ref.slice(hashIndex) || '#'

  const schema = context.refResolver.getSchema(schemaId, jsonPointer)
  if (schema === null) {
    throw new Error(`Cannot find reference "${ref}"`)
  }

  const newLocation = new Location(schema, schemaId, jsonPointer)
  if (schema.$ref !== undefined) {
    return resolveRef(context, newLocation)
  }

  return newLocation
}

function getMergedLocation (context, mergedSchemaId) {
  const mergedSchema = context.refResolver.getSchema(mergedSchemaId, '#')
  return new Location(mergedSchema, mergedSchemaId, '#')
}

function getSchemaId (schema, rootSchemaId) {
  if (schema.$id && schema.$id.charAt(0) !== '#') {
    return schema.$id
  }
  return rootSchemaId
}

function getSafeSchemaRef (context, location) {
  let schemaRef = location.getSchemaRef() || ''
  if (schemaRef.startsWith(context.rootSchemaId)) {
    schemaRef = schemaRef.replace(context.rootSchemaId, '') || '#'
  }
  return schemaRef
}

function getValidatorSchemaRef (context, location) {
  let schemaRef = location.getSchemaRef()
  const schema = location.schema

  // A schema that is only a registered $ref can validate against that target
  // instead of a JSON-pointer path through the root schema.
  if (
    typeof schema.$ref !== 'string' ||
    Object.keys(schema).length !== 1
  ) {
    return schemaRef
  }

  const ref = schema.$ref
  const hashIndex = ref.indexOf('#')
  const refSchemaId = hashIndex === -1 ? ref : ref.slice(0, hashIndex)
  const refJsonPointer = hashIndex === -1 ? '' : ref.slice(hashIndex)
  const isBareRef = refJsonPointer === '' || refJsonPointer === '#'
  const isNamedFragmentRef = NAMED_FRAGMENT_REF.test(refJsonPointer)
  const isJsonPointerRef = refJsonPointer.startsWith('#/')

  if (
    (isBareRef || isNamedFragmentRef || isJsonPointerRef) &&
    refSchemaId &&
    context.refResolver.hasSchema(refSchemaId)
  ) {
    const refSchema = context.refResolver.getSchema(refSchemaId)
    const refSubSchema = isBareRef
      ? refSchema
      : context.refResolver.getSchema(refSchemaId, refJsonPointer)
    const hasRelativeSchemaId = (
      typeof refSchema.$id === 'string' &&
      refSchema.$id.charAt(0) === '#'
    )
    if (
      refSubSchema !== null &&
      (!hasRelativeSchemaId || refSchema.$id === refJsonPointer)
    ) {
      schemaRef = refSchemaId + (isBareRef ? '#' : refJsonPointer)
    }
  }

  return schemaRef
}

function build (schema, options) {
  isValidSchema(schema)

  options = options || {}

  const context = {
    functions: [],
    functionsCounter: 0,
    functionsNamesBySchema: new Map(),
    options,
    refResolver: new RefResolver(),
    rootSchemaId: schema.$id || `__fjs_root_${schemaIdCounter++}`,
    validatorSchemasIds: new Set(),
    mergedSchemasIds: new Map(),
    recursiveSchemas: new Set(),
    recursivePaths: new Set(),
    buildingSet: new Set(),
    inlinedSchemas: new Set(),
    uid: 0
  }

  const schemaId = getSchemaId(schema, context.rootSchemaId)
  if (!context.refResolver.hasSchema(schemaId)) {
    context.refResolver.addSchema(schema, context.rootSchemaId)
  }

  if (options.schema) {
    for (const key in options.schema) {
      const schema = options.schema[key]
      const schemaId = getSchemaId(schema, key)
      if (!context.refResolver.hasSchema(schemaId)) {
        isValidSchema(schema, key)
        context.refResolver.addSchema(schema, key)
      }
    }
  }

  if (options.rounding) {
    if (!validRoundingMethods.has(options.rounding)) {
      throw new Error(`Unsupported integer rounding method ${options.rounding}`)
    }
  }

  if (options.largeArrayMechanism) {
    if (validLargeArrayMechanisms.has(options.largeArrayMechanism)) {
      largeArrayMechanism = options.largeArrayMechanism
    } else {
      throw new Error(`Unsupported large array mechanism ${options.largeArrayMechanism}`)
    }
  }

  if (options.largeArraySize) {
    const largeArraySizeType = typeof options.largeArraySize
    let parsedNumber

    if (largeArraySizeType === 'string' && Number.isFinite((parsedNumber = Number.parseInt(options.largeArraySize, 10)))) {
      largeArraySize = parsedNumber
    } else if (largeArraySizeType === 'number' && Number.isInteger(options.largeArraySize)) {
      largeArraySize = options.largeArraySize
    } else if (largeArraySizeType === 'bigint') {
      largeArraySize = Number(options.largeArraySize)
    } else {
      throw new Error(`Unsupported large array size. Expected integer-like, got ${typeof options.largeArraySize} with value ${options.largeArraySize}`)
    }
  }

  const location = new Location(schema, context.rootSchemaId)
  detectRecursiveSchemas(context, location)
  const code = buildValue(context, location, 'input')

  let contextFunctionCode = `
    ${serializerFns}
    const JSON_STR_BEGIN_OBJECT = '{'
    const JSON_STR_END_OBJECT = '}'
    const JSON_STR_BEGIN_ARRAY = '['
    const JSON_STR_END_ARRAY = ']'
    const JSON_STR_COMMA = ','
    const JSON_STR_COLONS = ':'
    const JSON_STR_QUOTE = '"'
    const JSON_STR_EMPTY_OBJECT = JSON_STR_BEGIN_OBJECT + JSON_STR_END_OBJECT
    const JSON_STR_EMPTY_ARRAY = JSON_STR_BEGIN_ARRAY + JSON_STR_END_ARRAY
    const JSON_STR_EMPTY_STRING = JSON_STR_QUOTE + JSON_STR_QUOTE
    const JSON_STR_NULL = 'null'
  `

  // If we have only the invocation of the 'anonymous0' function, we would
  // basically just wrap the 'anonymous0' function in the 'main' function and
  // and the overhead of the intermediate variable 'json'. We can avoid the
  // wrapping and the unnecessary memory allocation by aliasing 'anonymous0' to
  // 'main'
  if (code === 'json += anonymous0(input)') {
    contextFunctionCode += `
    ${context.functions.join('\n')}
    const main = anonymous0
    return main
    `
  } else {
    contextFunctionCode += `
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

function buildExtraObjectPropertiesSerializer (context, location, addComma, objVar) {
  const schema = location.schema
  const propertiesKeys = Object.keys(schema.properties || {})

  let code = `
    for (const key of Object.keys(${objVar})) {
      if (
        ${propertiesKeys.length > 0 ? propertiesKeys.map(k => `key === ${JSON.stringify(k)}`).join(' || ') + ' ||' : ''}
        ${objVar}[key] === undefined ||
        typeof ${objVar}[key] === 'function' ||
        typeof ${objVar}[key] === 'symbol'
      ) continue
      const value = ${objVar}[key]
  `

  const patternPropertiesLocation = location.getPropertyLocation('patternProperties')
  const patternPropertiesSchema = patternPropertiesLocation.schema

  if (patternPropertiesSchema !== undefined) {
    for (const propertyKey in patternPropertiesSchema) {
      const propertyLocation = patternPropertiesLocation.getPropertyLocation(propertyKey)

      code += `
        if (/${propertyKey.replace(/\\*\//g, '\\/')}/.test(key)) {
          ${addComma}
          json += asString(key) + JSON_STR_COLONS
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
        json += asString(key) + JSON_STR_COLONS + JSON.stringify(value)
      `
    } else {
      const propertyLocation = location.getPropertyLocation('additionalProperties')
      code += `
        ${addComma}
        json += asString(key) + JSON_STR_COLONS
        ${buildValue(context, propertyLocation, 'value')}
      `
    }
  }

  code += `
    }
  `
  return code
}

function buildInnerObject (context, location, objVar, isReturnForm) {
  const schema = location.schema

  const propertiesLocation = location.getPropertyLocation('properties')
  const requiredProperties = schema.required || []

  // Should serialize required properties first
  const propertiesKeys = Object.keys(schema.properties || {}).sort(
    (key1, key2) => {
      const required1 = requiredProperties.includes(key1)
      const required2 = requiredProperties.includes(key2)
      return required1 === required2 ? 0 : required1 ? -1 : 1
    }
  )

  let code = ''

  for (const key of requiredProperties) {
    if (!propertiesKeys.includes(key)) {
      const sanitizedKey = JSON.stringify(key)
      code += `if (${objVar}[${sanitizedKey}] === undefined) throw new Error('${sanitizedKey.replace(/'/g, '\\\'')} is required!')\n`
    }
  }

  const localUid = context.uid++
  let addComma = ''
  let emptyObjectGuard = null

  // propertiesKeys is sorted required-first; the guard checks [0] is required because
  // otherwise additionalProperties/patternProperties would emit a stray `{ ,"k":v }`.
  if (propertiesKeys.length > 0 && requiredProperties.includes(propertiesKeys[0])) {
    // The first property is required, so it always emits (or throws): the
    // object-open brace is merged into its key prefix. Subsequent properties
    // blindly prepend a comma, also merged into their key prefixes.

    for (let i = 0; i < propertiesKeys.length; i++) {
      const key = propertiesKeys[i]
      const propertyLocation = propertiesLocation.getPropertyLocation(key)

      let resolvedLocation = propertyLocation
      if (propertyLocation.schema.$ref) {
        resolvedLocation = resolveRef(context, propertyLocation)
      }

      const sanitizedKey = JSON.stringify(key)
      const value = `value_${key.replace(/[^a-zA-Z0-9]/g, '_')}_${context.uid++}`
      const defaultValue = resolvedLocation.schema.default
      const isRequired = requiredProperties.includes(key)

      const keyPrefix = (i === 0 ? '{' : ',') + sanitizedKey + ':'

      code += `
      const ${value} = ${objVar}[${sanitizedKey}]
      if (${value} !== undefined) {
        ${buildValueWithPrefix(context, resolvedLocation, `${value}`, JSON.stringify(keyPrefix), propertyLocation.schema.$ref === undefined)}
      }`

      if (defaultValue !== undefined) {
        code += ` else {
        json += ${JSON.stringify(keyPrefix + JSON.stringify(defaultValue))}
      }
      `
      } else if (isRequired) {
        code += ` else {
        throw new Error('${sanitizedKey.replace(/'/g, '\\\'')} is required!')
      }
      `
      } else {
        code += '\n'
      }
    }

    addComma = 'json += JSON_STR_COMMA'
  } else {
    // No property is guaranteed to be emitted, so the object-open brace is
    // merged into whichever property emits first (via the comma flag when
    // more than one might emit) and only added standalone when none does.
    const needsRuntimeComma = propertiesKeys.length > 1 || schema.patternProperties || (schema.additionalProperties !== undefined && schema.additionalProperties !== false)

    if (needsRuntimeComma) {
      code += `let addComma_${localUid} = false\n`
      addComma = `json += addComma_${localUid} ? JSON_STR_COMMA : ((addComma_${localUid} = true), JSON_STR_BEGIN_OBJECT)`
      emptyObjectGuard = `if (!addComma_${localUid}) json += JSON_STR_BEGIN_OBJECT\n`
    } else if (propertiesKeys.length === 0) {
      code += 'json += JSON_STR_BEGIN_OBJECT\n'
    }

    for (const key of propertiesKeys) {
      let propertyLocation = propertiesLocation.getPropertyLocation(key)
      const hadRef = propertyLocation.schema.$ref !== undefined
      if (hadRef) {
        propertyLocation = resolveRef(context, propertyLocation)
      }

      const sanitizedKey = JSON.stringify(key)
      const value = `value_${key.replace(/[^a-zA-Z0-9]/g, '_')}_${context.uid++}`
      const defaultValue = propertyLocation.schema.default
      const isRequired = requiredProperties.includes(key) // Should be false here but good to keep

      const keyColon = sanitizedKey + ':'
      const prefixExpr = needsRuntimeComma
        ? `(addComma_${localUid} ? ${JSON.stringify(',' + keyColon)} : (addComma_${localUid} = true, ${JSON.stringify('{' + keyColon)}))`
        : JSON.stringify('{' + keyColon)

      code += `
          const ${value} = ${objVar}[${sanitizedKey}]
          if (${value} !== undefined) {
            ${buildValueWithPrefix(context, propertyLocation, `${value}`, prefixExpr, !hadRef)}
          }`

      if (defaultValue !== undefined) {
        const defaultLiteral = JSON.stringify(JSON.stringify(defaultValue))
        const folded = foldStringConstants(prefixExpr, defaultLiteral)
        code += ` else {
            json += ${folded !== null ? folded : `${prefixExpr}\n            json += ${defaultLiteral}`}
          }
          `
      } else if (isRequired) {
        // Should not happen if requiredProperties.length === 0 but safety
        code += ` else {
            throw new Error('${sanitizedKey.replace(/'/g, '\\\'')} is required!')
          }
          `
      } else if (!needsRuntimeComma) {
        // Single optional property: the object-open brace is merged into its
        // key, so it must still be emitted when the property is absent.
        code += ` else {
            json += JSON_STR_BEGIN_OBJECT
          }
          `
      } else {
        code += '\n'
      }
    }
  }

  if (schema.patternProperties || schema.additionalProperties) {
    code += buildExtraObjectPropertiesSerializer(context, location, addComma, objVar)
  }

  if (emptyObjectGuard !== null) {
    code += emptyObjectGuard
  }

  code += isReturnForm
    ? '\nreturn json + JSON_STR_END_OBJECT\n'
    : '\njson += JSON_STR_END_OBJECT\n'
  return code
}

function mergeLocations (context, mergedSchemaId, mergedLocations) {
  for (let i = 0, mergedLocationsLength = mergedLocations.length; i < mergedLocationsLength; i++) {
    const location = mergedLocations[i]
    const schema = location.schema
    if (schema.$ref) {
      mergedLocations[i] = resolveRef(context, location)
    }
  }

  const mergedSchemas = []
  for (const location of mergedLocations) {
    const schema = cloneOriginSchema(context, location.schema, location.schemaId)
    delete schema.$id

    mergedSchemas.push(schema)
  }

  const mergedSchema = mergeSchemas(mergedSchemas)
  const mergedLocation = new Location(mergedSchema, mergedSchemaId)

  context.refResolver.addSchema(mergedSchema, mergedSchemaId)
  return mergedLocation
}

function cloneOriginSchema (context, schema, schemaId) {
  const clonedSchema = Array.isArray(schema) ? [] : {}

  if (
    schema.$id !== undefined &&
    schema.$id.charAt(0) !== '#'
  ) {
    schemaId = schema.$id
  }

  const mergedSchemaRef = context.mergedSchemasIds.get(schema)
  if (mergedSchemaRef) {
    context.mergedSchemasIds.set(clonedSchema, mergedSchemaRef)
  }

  for (const key in schema) {
    let value = schema[key]

    if (key === '$ref' && typeof value === 'string' && value.charAt(0) === '#') {
      value = schemaId + value
    }

    if (typeof value === 'object' && value !== null) {
      value = cloneOriginSchema(context, value, schemaId)
    }

    clonedSchema[key] = value
  }

  return clonedSchema
}

function toJSON (variableName) {
  return `(${variableName} && typeof ${variableName}.toJSON === 'function')
    ? ${variableName}.toJSON()
    : ${variableName}
  `
}

const SINGLE_EXPRESSION_STATEMENT = /^json \+= (.*)$/
const JS_STRING_LITERAL = /^"(?:[^"\\]|\\.)*"$/

// Values of the JSON_STR_* constants defined in the generated code preamble,
// so single-expression statements using them can be folded into literals.
const JSON_STR_CONSTANTS = {
  JSON_STR_NULL: 'null',
  JSON_STR_EMPTY_STRING: '""',
  JSON_STR_EMPTY_OBJECT: '{}',
  JSON_STR_EMPTY_ARRAY: '[]',
  JSON_STR_QUOTE: '"'
}

// If the generated code is a single `json += <expression>` statement,
// return the expression so it can be merged with a prefix into a single
// string concatenation. Otherwise return null.
function extractSingleExpression (code) {
  const trimmed = code.trim()
  if (trimmed.indexOf('\n') !== -1) return null
  const match = trimmed.match(SINGLE_EXPRESSION_STATEMENT)
  return match === null ? null : match[1]
}

// Folds two compile-time string constants into a single literal, or returns
// null if either side is not a constant. Runtime concatenation of a literal
// with a non-constant expression is intentionally never generated here: a
// separate `json += <literal>` statement takes V8's string-append fast path,
// while `json += lit + call()` measures ~20% slower in hot loops.
function foldStringConstants (prefixExpr, valueExpr) {
  if (JSON_STR_CONSTANTS[valueExpr] !== undefined) {
    valueExpr = JSON.stringify(JSON_STR_CONSTANTS[valueExpr])
  }
  if (JS_STRING_LITERAL.test(prefixExpr) && JS_STRING_LITERAL.test(valueExpr)) {
    return JSON.stringify(JSON.parse(prefixExpr) + JSON.parse(valueExpr))
  }
  return null
}

function emitPrefixed (prefixExpr, code) {
  const expr = extractSingleExpression(code)
  if (expr !== null) {
    const folded = foldStringConstants(prefixExpr, expr)
    if (folded !== null) {
      return `json += ${folded}`
    }
  }
  return `json += ${prefixExpr}\n${code}`
}

function buildSingleTypeWithPrefix (context, location, input, prefixExpr) {
  return emitPrefixed(prefixExpr, buildSingleTypeSerializer(context, location, input))
}

// A non-recursive plain object schema that is not shared through a $ref can
// be serialized inline into the parent's json accumulator, avoiding a
// function call and an intermediate string per object. Each schema is
// inlined at most once so shared schema objects cannot blow up code size.
function isInlinableObjectSchema (context, location) {
  const schema = location.schema
  return typeof schema === 'object' &&
    schema !== null &&
    schema.type === 'object' &&
    schema.const === undefined &&
    schema.allOf === undefined &&
    schema.anyOf === undefined &&
    schema.oneOf === undefined &&
    !(schema.if && schema.then) &&
    !context.recursivePaths.has(`${location.schemaId || ''}#${location.jsonPointer || ''}`) &&
    !context.buildingSet.has(schema) &&
    !context.functionsNamesBySchema.has(schema) &&
    !context.inlinedSchemas.has(schema)
}

function buildInlineObjectValue (context, location, input) {
  const schema = location.schema
  const nullable = schema.nullable === true

  context.inlinedSchemas.add(schema)
  context.buildingSet.add(schema)
  const objVar = `obj_${context.uid++}`
  const code = `
    const ${objVar} = ${toJSON(input)}
    if (${objVar} === null) {
      json += ${nullable ? 'JSON_STR_NULL' : 'JSON_STR_EMPTY_OBJECT'}
    } else {
      ${buildInnerObject(context, location, objVar)}
    }
  `
  context.buildingSet.delete(schema)
  return code
}

// Like buildValue, but emits a constant prefix (object key, optionally with
// leading `{` or `,`) as a single pre-folded literal statement, folding it
// into the value too when the value is itself a compile-time constant.
// allowInline permits serializing a plain nested object schema inline; it
// must only be set when the schema was not reached through a $ref.
function buildValueWithPrefix (context, location, input, prefixExpr, allowInline) {
  let schema = location.schema

  if (typeof schema === 'object' && schema !== null) {
    if (schema.$ref !== undefined) {
      location = resolveRef(context, location)
      schema = location.schema
      allowInline = false
    }

    if (schema.type === undefined) {
      const inferredType = inferTypeByKeyword(schema)
      if (inferredType) {
        schema.type = inferredType
      }
    }

    if (
      Array.isArray(schema.type) &&
      schema.const === undefined &&
      schema.nullable !== true &&
      schema.allOf === undefined &&
      schema.anyOf === undefined &&
      schema.oneOf === undefined &&
      !(schema.if && schema.then)
    ) {
      return buildMultiTypeSerializer(context, location, input, prefixExpr)
    }

    if (allowInline && isInlinableObjectSchema(context, location)) {
      return `json += ${prefixExpr}\n${buildInlineObjectValue(context, location, input)}`
    }
  }

  return emitPrefixed(prefixExpr, buildValue(context, location, input))
}

function buildObject (context, location, input) {
  const schema = location.schema

  if (context.functionsNamesBySchema.has(schema)) {
    const funcName = context.functionsNamesBySchema.get(schema)
    return `json += ${funcName}(${input})`
  }

  const nullable = schema.nullable === true

  const schemaId = location.schemaId || ''
  const jsonPointer = location.jsonPointer || ''
  const fullPath = `${schemaId}#${jsonPointer}`

  if (context.recursivePaths.has(fullPath) || context.buildingSet.has(schema) || schemaId !== '') {
    const functionName = generateFuncName(context)
    context.functionsNamesBySchema.set(schema, functionName)

    const schemaRef = getSafeSchemaRef(context, location)

    const functionCode = `
      // ${schemaRef}
      function ${functionName} (input) {
        const obj = ${toJSON('input')}
        if (obj === null) return ${nullable ? 'JSON_STR_NULL' : 'JSON_STR_EMPTY_OBJECT'}
        let json = ''

        ${buildInnerObject(context, location, 'obj', true)}
      }
    `

    context.functions.push(functionCode)
    return `json += ${functionName}(${input})`
  }

  context.buildingSet.add(schema)
  const objVar = `obj_${context.uid++}`
  const code = `
    const ${objVar} = ${toJSON(input)}
    if (${objVar} === null) {
      json += ${nullable ? 'JSON_STR_NULL' : 'JSON_STR_EMPTY_OBJECT'}
    } else {
      ${buildInnerObject(context, location, objVar)}
    }
  `
  context.buildingSet.delete(schema)
  return code
}

function buildArray (context, location, input) {
  const schema = location.schema

  let itemsLocation = location.getPropertyLocation('items')
  itemsLocation.schema = itemsLocation.schema || {}

  const itemsHadRef = itemsLocation.schema.$ref !== undefined
  if (itemsHadRef) {
    itemsLocation = resolveRef(context, itemsLocation)
  }

  const itemsSchema = itemsLocation.schema

  if (context.functionsNamesBySchema.has(schema)) {
    const funcName = context.functionsNamesBySchema.get(schema)
    return `json += ${funcName}(${input})`
  }

  const nullable = schema.nullable === true

  const schemaId = location.schemaId || ''
  const jsonPointer = location.jsonPointer || ''
  const fullPath = `${schemaId}#${jsonPointer}`

  if (context.recursivePaths.has(fullPath) || context.buildingSet.has(schema) || schemaId !== '') {
    const functionName = generateFuncName(context)
    context.functionsNamesBySchema.set(schema, functionName)

    const schemaRef = getSafeSchemaRef(context, location)

    let functionCode = `
    function ${functionName} (obj) {
      // ${schemaRef}
      let json = ''
  `

    functionCode += `
    if (obj === null) return ${nullable ? 'JSON_STR_NULL' : 'JSON_STR_EMPTY_ARRAY'}
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
      functionCode += `if (arrayLength >= ${largeArraySize}) return JSON.stringify(obj)\n`
    }

    functionCode += `
    json += JSON_STR_BEGIN_ARRAY
  `

    if (Array.isArray(itemsSchema)) {
      for (let i = 0, itemsSchemaLength = itemsSchema.length; i < itemsSchemaLength; i++) {
        let item = itemsSchema[i]
        let itemLocation = itemsLocation.getPropertyLocation(i)
        if (itemLocation.schema.$ref) {
          itemLocation = resolveRef(context, itemLocation)
          item = itemLocation.schema
        }
        const value = `value_${i}`
        functionCode += `const ${value} = obj[${i}]`
        const tmpRes = buildValue(context, itemLocation, value)
        functionCode += `
        if (${i} < arrayLength) {
          if (${buildArrayTypeCondition(item.type, value)}) {
            if (${i}) {
              json += JSON_STR_COMMA
            }
            ${tmpRes}
          } else {
            throw new Error(\`Item at ${i} does not match schema definition.\`)
          }
        }
        `
      }

      if (schema.additionalItems) {
        functionCode += `
        for (let i = ${itemsSchema.length}; i < arrayLength; i++) {
          if (i) {
            json += JSON_STR_COMMA
          }
          json += JSON.stringify(obj[i])
        }`
      }
    } else {
      const code = (!itemsHadRef && isInlinableObjectSchema(context, itemsLocation))
        ? buildInlineObjectValue(context, itemsLocation, 'value')
        : buildValue(context, itemsLocation, 'value')
      functionCode += `
      if (arrayLength > 0) {
        const value = obj[0]
        ${code}
        for (let i = 1; i < arrayLength; i++) {
          json += JSON_STR_COMMA
          const value = obj[i]
          ${code}
        }
      }`
    }

    functionCode += `
      return json + JSON_STR_END_ARRAY
    }`

    context.functions.push(functionCode)
    return `json += ${functionName}(${input})`
  }

  context.buildingSet.add(schema)
  const safeSchemaRef = getSafeSchemaRef(context, location)
  const objVar = `obj_${context.uid++}`
  let inlinedCode = `
    const ${objVar} = ${input}
    if (${objVar} === null) {
      json += ${nullable ? 'JSON_STR_NULL' : 'JSON_STR_EMPTY_ARRAY'}
    } else if (!Array.isArray(${objVar})) {
      throw new TypeError(\`The value of '${safeSchemaRef}' does not match schema definition.\`)
    } else {
      const arrayLength_${objVar} = ${objVar}.length
  `

  if (!schema.additionalItems && Array.isArray(itemsSchema)) {
    inlinedCode += `
      if (arrayLength_${objVar} > ${itemsSchema.length}) {
        throw new Error(\`Item at ${itemsSchema.length} does not match schema definition.\`)
      }
    `
  }

  if (largeArrayMechanism === 'json-stringify') {
    inlinedCode += `if (arrayLength_${objVar} >= ${largeArraySize}) json += JSON.stringify(${objVar})\n else {`
  }

  inlinedCode += `
    json += JSON_STR_BEGIN_ARRAY
  `

  if (Array.isArray(itemsSchema)) {
    const localUid = context.uid++
    inlinedCode += `let addComma_${localUid} = false\n`
    for (let i = 0, itemsSchemaLength = itemsSchema.length; i < itemsSchemaLength; i++) {
      let item = itemsSchema[i]
      let itemLocation = itemsLocation.getPropertyLocation(i)
      if (itemLocation.schema.$ref) {
        itemLocation = resolveRef(context, itemLocation)
        item = itemLocation.schema
      }
      const value = `value_${i}_${context.uid++}`
      inlinedCode += `const ${value} = ${objVar}[${i}]`
      const tmpRes = buildValue(context, itemLocation, value)
      inlinedCode += `
        if (${i} < arrayLength_${objVar}) {
          if (${buildArrayTypeCondition(item.type, value)}) {
            !addComma_${localUid} && (addComma_${localUid} = true) || (json += JSON_STR_COMMA)
            ${tmpRes}
          } else {
            throw new Error(\`Item at ${i} does not match schema definition.\`)
          }
        }
        `
    }

    if (schema.additionalItems) {
      inlinedCode += `
        for (let i = ${itemsSchema.length}; i < arrayLength_${objVar}; i++) {
          !addComma_${localUid} && (addComma_${localUid} = true) || (json += JSON_STR_COMMA)
          json += JSON.stringify(${objVar}[i])
        }`
    }
  } else {
    const code = buildValue(context, itemsLocation, 'value')
    inlinedCode += `
      if (arrayLength_${objVar} > 0) {
        const value = ${objVar}[0]
        ${code}
        for (let i = 1; i < arrayLength_${objVar}; i++) {
          json += JSON_STR_COMMA
          const value = ${objVar}[i]
          ${code}
        }
      }`
  }

  inlinedCode += `
    json += JSON_STR_END_ARRAY
  `

  if (largeArrayMechanism === 'json-stringify') {
    inlinedCode += '}'
  }

  inlinedCode += '}'
  context.buildingSet.delete(schema)
  return inlinedCode
}

function buildArrayTypeCondition (type, accessor) {
  let condition
  switch (type) {
    case 'null':
      condition = `${accessor} === null`
      break
    case 'string':
      condition = `typeof ${accessor} === 'string' ||
      ${accessor} === null ||
      ${accessor} instanceof Date ||
      ${accessor} instanceof RegExp ||
      (
        typeof ${accessor} === "object" &&
        typeof ${accessor}.toString === "function" &&
        ${accessor}.toString !== Object.prototype.toString
      )`
      break
    case 'integer':
      condition = `Number.isInteger(${accessor})`
      break
    case 'number':
      condition = `Number.isFinite(${accessor})`
      break
    case 'boolean':
      condition = `typeof ${accessor} === 'boolean'`
      break
    case 'object':
      condition = `${accessor} && typeof ${accessor} === 'object' && ${accessor}.constructor === Object`
      break
    case 'array':
      condition = `Array.isArray(${accessor})`
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

function buildMultiTypeSerializer (context, location, input, prefixExpr) {
  const schema = location.schema
  const types = schema.type.sort(t1 => t1 === 'null' ? -1 : 1)

  let code = ''

  types.forEach((type, index) => {
    location.schema = { ...location.schema, type }
    const nestedResult = prefixExpr === undefined
      ? buildSingleTypeSerializer(context, location, input)
      : buildSingleTypeWithPrefix(context, location, input, prefixExpr)

    const statement = index === 0 ? 'if' : 'else if'
    switch (type) {
      case 'null':
        code += `
          ${statement} (${input} === null) {
            ${nestedResult}
          }
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
              ${input}.toString !== Object.prototype.toString
            )
          ) {
            ${nestedResult}
          }
        `
        break
      }
      case 'array': {
        code += `
          ${statement}(Array.isArray(${input})) {
            ${nestedResult}
          }
        `
        break
      }
      case 'integer': {
        code += `
          ${statement}(Number.isInteger(${input}) || ${input} === null) {
            ${nestedResult}
          }
        `
        break
      }
      case 'object': {
        // An array is `typeof === 'object'`, so it would otherwise be captured
        // by this branch and serialized as an object (dropping its items). Exclude
        // arrays here so a sibling `array` type in the same `type` list can match.
        code += `
          ${statement}((typeof ${input} === "object" && !Array.isArray(${input})) || ${input} === null) {
            ${nestedResult}
          }
        `
        break
      }
      default: {
        code += `
          ${statement}(typeof ${input} === "${type}" || ${input} === null) {
            ${nestedResult}
          }
        `
        break
      }
    }
  })
  code += `
    else throw new TypeError(\`The value of '${getSafeSchemaRef(context, location)}' does not match schema definition.\`)
  `

  return code
}

function buildSingleTypeSerializer (context, location, input) {
  const schema = location.schema

  switch (schema.type) {
    case 'null':
      return 'json += JSON_STR_NULL'
    case 'string': {
      if (schema.format === 'date-time') {
        return `json += asDateTime(${input})`
      } else if (schema.format === 'date') {
        return `json += asDate(${input})`
      } else if (schema.format === 'time') {
        return `json += asTime(${input})`
      } else if (schema.format === 'unsafe') {
        return `json += asUnsafeString(${input})`
      } else {
        return `
        if (typeof ${input} !== 'string') {
          if (${input} === null) {
            json += JSON_STR_EMPTY_STRING
          } else if (${input} instanceof Date) {
            json += JSON_STR_QUOTE + ${input}.toISOString() + JSON_STR_QUOTE
          } else if (${input} instanceof RegExp) {
            json += asString(${input}.source)
          } else {
            json += asString(${input}.toString())
          }
        } else {
          json += asString(${input})
        }
        `
      }
    }
    case 'integer':
      return `json += asInteger(${input})`
    case 'number':
      return `json += asNumber(${input})`
    case 'boolean':
      return `json += (${input} ? 'true' : 'false')`
    case 'object': {
      return buildObject(context, location, input)
    }
    case 'array': {
      return buildArray(context, location, input)
    }
    case undefined:
      return `json += JSON.stringify(${input})`
    default:
      throw new Error(`${schema.type} unsupported`)
  }
}

function detectRecursiveSchemas (context, location) {
  const pathStack = new Set()
  function traverse (location) {
    const schema = location.schema
    if (typeof schema !== 'object' || schema === null) return

    const schemaId = location.schemaId || ''
    const jsonPointer = location.jsonPointer || ''
    const fullPath = `${schemaId}#${jsonPointer}`

    if (pathStack.has(fullPath)) {
      // Mark all nodes in the current path that are part of the cycle
      let inCycle = false
      for (const p of pathStack) {
        if (p === fullPath) inCycle = true
        if (inCycle) context.recursivePaths.add(p)
      }
      context.recursivePaths.add(fullPath)
      return
    }
    pathStack.add(fullPath)

    if (schema.$ref) {
      try {
        const res = resolveRef(context, location)
        traverse(res)
      } catch (err) {
        // Validation will handle missing refs later
      }
    }

    if (schema.properties) {
      const propertiesLocation = location.getPropertyLocation('properties')
      for (const key in schema.properties) {
        traverse(propertiesLocation.getPropertyLocation(key))
      }
    }
    if (schema.additionalProperties && typeof schema.additionalProperties === 'object') {
      traverse(location.getPropertyLocation('additionalProperties'))
    }
    if (schema.patternProperties) {
      const patternPropertiesLocation = location.getPropertyLocation('patternProperties')
      for (const key in schema.patternProperties) {
        traverse(patternPropertiesLocation.getPropertyLocation(key))
      }
    }
    if (schema.items) {
      const itemsLocation = location.getPropertyLocation('items')
      if (Array.isArray(schema.items)) {
        for (let i = 0; i < schema.items.length; i++) {
          traverse(itemsLocation.getPropertyLocation(i))
        }
      } else {
        traverse(itemsLocation)
      }
    }
    if (schema.additionalItems && typeof schema.additionalItems === 'object') {
      traverse(location.getPropertyLocation('additionalItems'))
    }

    if (schema.oneOf) {
      const oneOfLocation = location.getPropertyLocation('oneOf')
      for (let i = 0; i < schema.oneOf.length; i++) {
        traverse(oneOfLocation.getPropertyLocation(i))
      }
    }
    if (schema.anyOf) {
      const anyOfLocation = location.getPropertyLocation('anyOf')
      for (let i = 0; i < schema.anyOf.length; i++) {
        traverse(anyOfLocation.getPropertyLocation(i))
      }
    }
    if (schema.allOf) {
      const allOfLocation = location.getPropertyLocation('allOf')
      for (let i = 0; i < schema.allOf.length; i++) {
        traverse(allOfLocation.getPropertyLocation(i))
      }
    }
    if (schema.then) traverse(location.getPropertyLocation('then'))
    if (schema.else) traverse(location.getPropertyLocation('else'))

    pathStack.delete(fullPath)
  }
  traverse(location)
}

function buildConstSerializer (location, input) {
  const schema = location.schema
  const type = schema.type

  const hasNullType = Array.isArray(type) && type.includes('null')

  let code = ''

  if (hasNullType) {
    code += `
      if (${input} === null) {
        json += JSON_STR_NULL
      } else {
    `
  }

  code += `json += ${JSON.stringify(JSON.stringify(schema.const))}`

  if (hasNullType) {
    code += `
      }
    `
  }

  return code
}

function buildAllOf (context, location, input) {
  const schema = location.schema

  let mergedSchemaId = context.mergedSchemasIds.get(schema)
  if (mergedSchemaId) {
    const mergedLocation = getMergedLocation(context, mergedSchemaId)
    return buildValue(context, mergedLocation, input)
  }

  mergedSchemaId = `__fjs_merged_${schemaIdCounter++}`
  context.mergedSchemasIds.set(schema, mergedSchemaId)

  const { allOf, ...schemaWithoutAllOf } = location.schema
  const locations = [
    new Location(
      schemaWithoutAllOf,
      location.schemaId,
      location.jsonPointer
    )
  ]

  const allOfsLocation = location.getPropertyLocation('allOf')
  for (let i = 0, allOfLength = allOf.length; i < allOfLength; i++) {
    locations.push(allOfsLocation.getPropertyLocation(i))
  }

  const mergedLocation = mergeLocations(context, mergedSchemaId, locations)
  return buildValue(context, mergedLocation, input)
}

function buildOneOf (context, location, input) {
  context.validatorSchemasIds.add(location.schemaId)

  const schema = location.schema

  const type = schema.anyOf ? 'anyOf' : 'oneOf'
  const { [type]: oneOfs, ...schemaWithoutAnyOf } = location.schema

  const locationWithoutOneOf = new Location(
    schemaWithoutAnyOf,
    location.schemaId,
    location.jsonPointer
  )
  const oneOfsLocation = location.getPropertyLocation(type)

  let code = ''

  for (let index = 0, oneOfsLength = oneOfs.length; index < oneOfsLength; index++) {
    const optionLocation = oneOfsLocation.getPropertyLocation(index)
    const optionSchema = optionLocation.schema

    let mergedSchemaId = context.mergedSchemasIds.get(optionSchema)
    let mergedLocation = null
    if (mergedSchemaId) {
      mergedLocation = getMergedLocation(context, mergedSchemaId)
    } else {
      mergedSchemaId = `__fjs_merged_${schemaIdCounter++}`
      context.mergedSchemasIds.set(optionSchema, mergedSchemaId)

      mergedLocation = mergeLocations(context, mergedSchemaId, [
        locationWithoutOneOf,
        optionLocation
      ])
    }

    const nestedResult = buildValue(context, mergedLocation, input)
    const schemaRef = getValidatorSchemaRef(context, optionLocation)

    code += `
      ${index === 0 ? 'if' : 'else if'}(validator.validate("${schemaRef}", ${input})) {
        ${nestedResult}
      }
    `
  }

  code += `
    else throw new TypeError(\`The value of '${getSafeSchemaRef(context, location)}' does not match schema definition.\`)
  `

  return code
}

function buildIfThenElse (context, location, input) {
  context.validatorSchemasIds.add(location.schemaId)

  const {
    if: ifSchema,
    then: thenSchema,
    else: elseSchema,
    ...schemaWithoutIfThenElse
  } = location.schema

  const rootLocation = new Location(
    schemaWithoutIfThenElse,
    location.schemaId,
    location.jsonPointer
  )

  const ifLocation = location.getPropertyLocation('if')
  const ifSchemaRef = getValidatorSchemaRef(context, ifLocation)

  const thenLocation = location.getPropertyLocation('then')
  let thenMergedSchemaId = context.mergedSchemasIds.get(thenSchema)
  let thenMergedLocation = null
  if (thenMergedSchemaId) {
    thenMergedLocation = getMergedLocation(context, thenMergedSchemaId)
  } else {
    thenMergedSchemaId = `__fjs_merged_${schemaIdCounter++}`
    context.mergedSchemasIds.set(thenSchema, thenMergedSchemaId)

    thenMergedLocation = mergeLocations(context, thenMergedSchemaId, [
      rootLocation,
      thenLocation
    ])
  }

  if (!elseSchema) {
    return `
      if (validator.validate("${ifSchemaRef}", ${input})) {
        ${buildValue(context, thenMergedLocation, input)}
      } else {
        ${buildValue(context, rootLocation, input)}
      }
    `
  }

  const elseLocation = location.getPropertyLocation('else')
  let elseMergedSchemaId = context.mergedSchemasIds.get(elseSchema)
  let elseMergedLocation = null
  if (elseMergedSchemaId) {
    elseMergedLocation = getMergedLocation(context, elseMergedSchemaId)
  } else {
    elseMergedSchemaId = `__fjs_merged_${schemaIdCounter++}`
    context.mergedSchemasIds.set(elseSchema, elseMergedSchemaId)

    elseMergedLocation = mergeLocations(context, elseMergedSchemaId, [
      rootLocation,
      elseLocation
    ])
  }

  return `
    if (validator.validate("${ifSchemaRef}", ${input})) {
      ${buildValue(context, thenMergedLocation, input)}
    } else {
      ${buildValue(context, elseMergedLocation, input)}
    }
  `
}

function buildValue (context, location, input) {
  let schema = location.schema

  if (typeof schema === 'boolean') {
    return `json += JSON.stringify(${input})`
  }

  if (schema.$ref) {
    location = resolveRef(context, location)
    schema = location.schema
  }

  if (schema.allOf) {
    return buildAllOf(context, location, input)
  }

  if (schema.anyOf || schema.oneOf) {
    return buildOneOf(context, location, input)
  }

  if (schema.if && schema.then) {
    return buildIfThenElse(context, location, input)
  }

  if (schema.type === undefined) {
    const inferredType = inferTypeByKeyword(schema)
    if (inferredType) {
      schema.type = inferredType
    }
  }

  let code = ''

  const type = schema.type
  const nullable = schema.nullable === true
  if (nullable) {
    code += `
      if (${input} === null) {
        json += JSON_STR_NULL
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
