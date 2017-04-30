'use strict'

const benchmark = require('benchmark');

const schema = {
  'title': 'Example Schema',
  'type': 'object',
  'properties': {
    'firstName': {
      'type': 'string'
    },
    'lastName': {
      'type': 'string'
    },
    'age': {
      'description': 'Age in years',
      'type': 'integer',
      'minimum': 0
    }
  }
}

const arraySchema = {
  title: 'array schema',
  type: 'array',
  items: schema
}

const obj = {
  firstName: 'Matteo',
  lastName: 'Collina',
  age: 32
}

const 
  fastStringify = require('.'),
  stringify       = fastStringify(schema),
  stringifyArray  = fastStringify(arraySchema),
  stringifyString = fastStringify({ type: 'string' });

var
  var_long_string_concat_via_for_loop_raw        = concat('"', 10000),
  var_long_string_concat_via_for_loop_numbered   = concat('"', 10000),
  var_long_string_concat_via_array_join_raw      = tacnoc('"', 10000),
  var_long_string_concat_via_array_join_numbered = tacnoc('"', 10000);

Number(var_long_string_concat_via_for_loop_numbered);
Number(var_long_string_concat_via_array_join_numbered);

const
  const_long_string_concat_via_for_loop_raw        = concat('"', 10000),
  const_long_string_concat_via_for_loop_numbered   = concat('"', 10000),
  const_long_string_concat_via_array_join_raw      = tacnoc('"', 10000),
  const_long_string_concat_via_array_join_numbered = tacnoc('"', 10000);

Number(const_long_string_concat_via_for_loop_numbered);
Number(const_long_string_concat_via_array_join_numbered);

const
  ARRAY_SIZE = 1000,
  multiArray = new Array(ARRAY_SIZE);

for (let i = ARRAY_SIZE; i--;) {
  multiArray[i] = obj;
}

var shortString        = 'hello world';
let letShortString     = 'hello world';
const constShortString = 'hello world';

console.log('\nArray:');
new benchmark.Suite()
  .add('Array        JSON.stringify      ', () => JSON.stringify(multiArray))
  .add('Array        fast-json-stringify ', () => stringifyArray(multiArray)).on('cycle', cycle).run();

console.log('\n=> var_long_string_concat_via_for_loop_raw:'.replace(/_/g, ' '));
new benchmark.Suite()
  .add('String Long  JSON.stringify      ', () => JSON.stringify(var_long_string_concat_via_for_loop_raw))
  .add('String Long  fast-json-stringify ', () => stringifyString(var_long_string_concat_via_for_loop_raw)).on('cycle', cycle).run();

console.log('\n=> var_long_string_concat_via_for_loop_numbered:'.replace(/_/g, ' '));
new benchmark.Suite()
  .add('String Long  JSON.stringify      ', () => JSON.stringify(var_long_string_concat_via_for_loop_numbered))
  .add('String Long  fast-json-stringify ', () => stringifyString(var_long_string_concat_via_for_loop_numbered)).on('cycle', cycle).run();

console.log('\n=> var_long_string_concat_via_array_join_raw:'.replace(/_/g, ' '));
new benchmark.Suite()
  .add('String Long  JSON.stringify      ', () => JSON.stringify(var_long_string_concat_via_array_join_raw))
  .add('String Long  fast-json-stringify ', () => stringifyString(var_long_string_concat_via_array_join_raw)).on('cycle', cycle).run();

console.log('\n=> var_long_string_concat_via_array_join_numbered:'.replace(/_/g, ' '));
new benchmark.Suite()
  .add('String Long  JSON.stringify      ', () => JSON.stringify(var_long_string_concat_via_array_join_numbered))
  .add('String Long  fast-json-stringify ', () => stringifyString(var_long_string_concat_via_array_join_numbered)).on('cycle', cycle).run();

console.log('\n=> const_long_string_concat_via_for_loop_raw:');
new benchmark.Suite()
  .add('String Long C JSON.stringify     ', () => JSON.stringify(const_long_string_concat_via_for_loop_raw))
  .add('String Long C fast-json-stringify', () => stringifyString(const_long_string_concat_via_for_loop_raw)).on('cycle', cycle).run();

console.log('\n=> const_long_string_concat_via_for_loop_numbered:');
new benchmark.Suite()
  .add('String Long C JSON.stringify     ', () => JSON.stringify(const_long_string_concat_via_for_loop_numbered))
  .add('String Long C fast-json-stringify', () => stringifyString(const_long_string_concat_via_for_loop_numbered)).on('cycle', cycle).run();

console.log('\n=> const_long_string_concat_via_array_join_raw:');
new benchmark.Suite()
  .add('String Long C JSON.stringify     ', () => JSON.stringify(const_long_string_concat_via_array_join_raw))
  .add('String Long C fast-json-stringify', () => stringifyString(const_long_string_concat_via_array_join_raw)).on('cycle', cycle).run();

console.log('\n=> const_long_string_concat_via_array_join_numbered:');
new benchmark.Suite()
  .add('String Long C JSON.stringify     ', () => JSON.stringify(const_long_string_concat_via_array_join_numbered))
  .add('String Long C fast-json-stringify', () => stringifyString(const_long_string_concat_via_array_join_numbered)).on('cycle', cycle).run();

console.log('\nString short:');
new benchmark.Suite()
  .add('String Short JSON.stringify      ', () => JSON.stringify('hello world'))
  .add('String Short fast-json-stringify ', () => stringifyString('hello world')).on('cycle', cycle).run();

console.log('\nString short LET:');
new benchmark.Suite()
  .add('String Short JSON.stringify      ', () => JSON.stringify(letShortString))
  .add('String Short fast-json-stringify ', () => stringifyString(letShortString)).on('cycle', cycle).run();

console.log('\nString short Var:');
new benchmark.Suite()
  .add('String Short JSON.stringify      ', () => JSON.stringify(shortString))
  .add('String Short fast-json-stringify ', () => stringifyString(shortString)).on('cycle', cycle).run();

console.log('\nString short Const:');
new benchmark.Suite()
  .add('String Short JSON.stringify      ', () => JSON.stringify(constShortString))
  .add('String Short fast-json-stringify ', () => stringifyString(constShortString)).on('cycle', cycle).run();

console.log('\nObject:');
new benchmark.Suite()
  .add('Object       JSON.stringify      ', () => JSON.stringify(obj))
  .add('Object       fast-json-stringify ', () => stringify(obj)).on('cycle', cycle).run();


function cycle (e) {
  console.log(e.target.toString())
}

function concat(str, times) {
  var tempString = '';

  for (let i = 0; i < times; i++) {
    tempString += i;
    if (i % 100 === 0)
      tempString += str;
  }

  return tempString;
}

function tacnoc(str, times) {
  return new Array(times).join(str);
}