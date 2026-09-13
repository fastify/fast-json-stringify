# Fuzzing

A differential fuzzer for the serializer. Each round draws a random schema and a value that
conforms to it, and the text the compiled serializer writes must be, byte for byte, what the
README promises for that value: properties in schema order with the required ones first, the
extra ones the schema keeps, a default where a value is missing, dates by their format, null
where the schema allows it. Three arms write it: the function compiled in memory, the standalone
code written to a file and required back, and the large array mechanism that hands arrays over
to `JSON.stringify`.

The CI runs a thousand rounds on a seed nobody chose, on every push and pull request. A
divergence turns the job red and prints the seed that reproduces it, with the case shrunk to the
lines worth pasting into a test.

```bash
npm run fuzz                               # two hundred rounds
npm run fuzz -- --rounds 2000              # longer
npm run fuzz -- --seed 12345 --rounds 1    # replay what a past run printed
npm run fuzz -- --keep-going               # do not stop at the first divergence
npm run fuzz -- --no-shrink                # print the round as drawn
```

`schema.js` holds the generator and the model: `drawSchema` and `drawValue` draw a case,
`expected` says what it serializes to, and the `NAMES` and `ALPHABET` lists are where the awkward
property names and characters live. Not covered yet: `if/then/else`, `allOf`, `$id` based refs,
the `rounding` option and values with `toJSON`.
