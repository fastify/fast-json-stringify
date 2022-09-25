import { expectError } from "tsd";
import build from "../..";

// With inference
interface Schema {
  id: string;
  a?: number;
}

const stringify3 = build({
  type: "object",
  properties: { a: { type: "string" } },
});
stringify3<Schema>({ id: "123" });
stringify3<Schema>({ a: 123, id: "123" });
expectError(stringify3<Schema>({ anotherOne: "bar" }));
expectError(stringify3<Schema>({ a: "bar" }));

// Without inference
const stringify4 = build({
  type: "object",
  properties: { a: { type: "string" } },
});
stringify4({ id: "123" });
stringify4({ a: 123, id: "123" });
stringify4({ anotherOne: "bar" });
stringify4({ a: "bar" });

// Without inference - string type
const stringify5 = build({
  type: "string",
});
stringify5("foo");
expectError(stringify5({ id: "123" }));

// Without inference - null type
const stringify6 = build({
  type: "null",
});
stringify6(null);
expectError(stringify6("a string"));

// Without inference - boolean type
const stringify7 = build({
  type: "boolean",
});
stringify7(true);
expectError(stringify7("a string"));
