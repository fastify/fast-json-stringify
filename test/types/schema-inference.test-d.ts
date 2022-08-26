import { expectError } from "tsd";
import build from "../..";

// Schema with constant value
const schema = {
	type: "object",
	properties: {
		foo: {
			const: "bar",
		},
	},
	additionalProperties: false,
} as const;
const stringify = build(schema);

expectError(stringify({ foo: "baz" }));
expectError(stringify({ foo: 1 }));
expectError(stringify({ foo: null }));

stringify({ foo: "bar" });

// Schema with property multiple types
const schema1 = {
	type: "object",
	properties: {
		foo: {
			type: ["string", "integer", "null"],
		},
	},
} as const;
const stringify1 = build(schema1);
expectError(stringify1({ foo: true }));
stringify1({ foo: "bar" });
stringify1({ foo: "bar", anotherOne: null });
stringify1({ foo: 1 });
stringify1({ foo: null });

// Schema with nested properties
const schema2 = {
	type: "object",
	properties: {
		foo: {
			type: "object",
			properties: {
				bar: { type: "object", properties: { baz: { type: "string" } } },
			},
			required: ["bar"],
		},
	},
} as const;
const stringify2 = build(schema2);
expectError(
	stringify2({
		foo: {
			bar: { baz: 1 },
		},
	})
);
expectError(
	stringify2({
		foo: {
			bar: null,
		},
	})
);
stringify2({ foo: { bar: { baz: "baz" } } });
stringify2({ foo: { bar: {} } });

// With invalid schema
const schema3 = {
	type: "object",
	notAllowedKeyword: "foo",
} as const;

const stringify3 = build(schema3);
stringify3({ foo: "bar" });
stringify3({ foo: 1 });
stringify3({ foo: null });
stringify3({ foo: true });
stringify3({  });
