'use strict'

// V8 13.8 (Node 25+) introduced the side-effect-free JSON.stringify fast path
// (https://v8.dev/blog/json-stringify). Two things depend on it: the
// projection behind objectMechanism: 'native' and the native string escape in
// the serializer. Detecting it from the V8 version rather than the Node major
// follows the feature across runtimes. process.versions.v8 is missing on
// non-V8 runtimes: String(undefined) parses to NaN and the comparison is
// false, i.e. "no fast path", with no branch to cover.
const [v8Major, v8Minor] = String(process.versions.v8).split('.').map(Number)

module.exports = {
  HAS_FAST_JSON_STRINGIFY: v8Major * 100 + v8Minor >= 1308
}
