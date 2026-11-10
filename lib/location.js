'use strict'

class Location {
  constructor (schema, schemaId, jsonPointer = '#') {
    this.schema = schema
    this.schemaId = schemaId
    this.jsonPointer = jsonPointer
  }

  getPropertyLocation (propertyName) {
    // a JSON pointer segment, so a property name with a / or a ~ still points at the property
    const name = String(propertyName)
    const segment = /[~/]/.test(name) ? name.replace(/~/g, '~0').replace(/\//g, '~1') : name
    const propertyLocation = new Location(
      this.schema[propertyName],
      this.schemaId,
      this.jsonPointer + '/' + segment
    )
    return propertyLocation
  }

  getSchemaRef () {
    return this.schemaId + this.jsonPointer
  }
}

module.exports = Location
