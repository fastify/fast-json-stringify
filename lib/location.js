'use strict'

function encodeFragmentToken (value) {
  const escapedValue = String(value).replace(/~/g, '~0').replace(/\//g, '~1')
  let encodedValue = ''

  for (const character of escapedValue) {
    const code = character.charCodeAt(0)
    // encodeURIComponent throws for lone surrogates, which remain safe in generated string literals.
    encodedValue += character.length === 1 && code >= 0xD800 && code <= 0xDFFF
      ? character
      : encodeURIComponent(character)
  }

  return encodedValue
}

class Location {
  constructor (schema, schemaId, jsonPointer = '#') {
    this.schema = schema
    this.schemaId = schemaId
    this.jsonPointer = jsonPointer
  }

  getPropertyLocation (propertyName) {
    const escapedPropertyName = encodeFragmentToken(propertyName)
    const propertyLocation = new Location(
      this.schema[propertyName],
      this.schemaId,
      this.jsonPointer + '/' + escapedPropertyName
    )
    return propertyLocation
  }

  getSchemaRef () {
    return this.schemaId + this.jsonPointer
  }
}

module.exports = Location
