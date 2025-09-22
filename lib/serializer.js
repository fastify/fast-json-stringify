'use strict'

const findEscapeSequence = /["\b\t\n\v\f\r\/]/

module.exports = class Serializer {
  constructor (options) {
    switch (options && options.rounding) {
      case 'floor':
        this.parseInteger = Math.floor
        break
      case 'ceil':
        this.parseInteger = Math.ceil
        break
      case 'round':
        this.parseInteger = Math.round
        break
      case 'trunc':
      default:
        this.parseInteger = Math.trunc
        break
    }
    this._options = options
  }

  asInteger (i) {
    if (Number.isInteger(i)) {
      return '' + i
    } else if (typeof i === 'bigint') {
      return i.toString()
    }
    /* eslint no-undef: "off" */
    const integer = this.parseInteger(i)
    // check if number is Infinity or NaN
    // eslint-disable-next-line no-self-compare
    if (integer === Infinity || integer === -Infinity || integer !== integer) {
      throw new Error(`The value "${i}" cannot be converted to an integer.`)
    }
    return '' + integer
  }

  asNumber (i) {
    // fast cast to number
    const num = Number(i)
    // check if number is NaN
    // eslint-disable-next-line no-self-compare
    if (num !== num) {
      throw new Error(`The value "${i}" cannot be converted to a number.`)
    } else if (num === Infinity || num === -Infinity) {
      return 'null'
    } else {
      return '' + num
    }
  }

  asBoolean (bool) {
    return bool && 'true' || 'false' // eslint-disable-line
  }

  asDateTime (date) {
    if (date === null) return '""'
    if (date instanceof Date) {
      return '"' + date.toISOString() + '"'
    }
    if (typeof date === 'string') {
      return '"' + date + '"'
    }
    throw new Error(`The value "${date}" cannot be converted to a date-time.`)
  }

  asDate (date) {
    if (date === null) return '""'
    if (date instanceof Date) {
      return '"' + new Date(date.getTime() - (date.getTimezoneOffset() * 60000)).toISOString().slice(0, 10) + '"'
    }
    if (typeof date === 'string') {
      return '"' + date + '"'
    }
    throw new Error(`The value "${date}" cannot be converted to a date.`)
  }

  asTime (date) {
    if (date === null) return '""'
    if (date instanceof Date) {
      return '"' + new Date(date.getTime() - (date.getTimezoneOffset() * 60000)).toISOString().slice(11, 19) + '"'
    }
    if (typeof date === 'string') {
      return '"' + date + '"'
    }
    throw new Error(`The value "${date}" cannot be converted to a time.`)
  }

  asString (str) {
    if (findEscapeSequence.test(str)) {
      return JSON.stringify(str)
    } else {
      return '"' + str + '"'
    }
  }

  asUnsafeString (str) {
    return '"' + str + '"'
  }

  getState () {
    return this._options
  }

  static restoreFromState (state) {
    return new Serializer(state)
  }
}
