'use strict'

class Location {
  constructor (schema, schemaId, jsonPointer = '#', isValidated = false) {
    this.schema = schema
    this.schemaId = schemaId
    this.jsonPointer = jsonPointer
    this.isValidated = isValidated
    this.mergedSchemaId = null
  }

  getPropertyLocation (propertyName) {
    const propertyLocation = new Location(
      this.schema[propertyName],
      this.schemaId,
      this.jsonPointer + '/' + propertyName,
      this.isValidated
    )

    if (this.mergedSchemaId !== null) {
      propertyLocation.addMergedSchema(
        this.schema[propertyName],
        this.mergedSchemaId,
        this.jsonPointer + '/' + propertyName
      )
    }

    return propertyLocation
  }

  // Use this method to get current schema location.
  // Use it when you need to create reference to the current location.
  getSchemaId () {
    return this.mergedSchemaId || this.schemaId
  }

  // Use this method to get original schema id for resolving user schema $refs
  // Don't join it with a JSON pointer to get the current location.
  getOriginSchemaId () {
    return this.schemaId
  }

  getSchemaRef () {
    const schemaId = this.getSchemaId()
    return schemaId + this.jsonPointer
  }

  addMergedSchema (mergedSchema, schemaId, jsonPointer = '#') {
    this.schema = mergedSchema
    this.mergedSchemaId = schemaId
    this.jsonPointer = jsonPointer
  }
}

module.exports = Location
