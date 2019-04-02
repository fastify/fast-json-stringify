declare module "fast-json-stringify" {
  namespace build {
    interface BaseSchema {
      /**
       * Schema title
       */
      title?: string;
      /**
       * Schema description
       */
      description?: string;
      /**
       * A comment to be added to the schema
       */
      $comment?: string;
      /**
       * Default value to be assigned when no value is given in the document
       */
      default?: any;
      /**
       * A list of example values that match this schema
       */
      examples?: any[];
      /**
       * A set of schemas of which at least one must match
       */
      anyOf?: Partial<Schema>[];
      /**
       * A set of schemas which must all match
       */
      allOf?: Partial<Schema>[];
      /**
       * A conditional schema to check, controls schemas defined in `then` and `else`
       */
      if?: Partial<Schema>;
      /**
       * A schema to apply if the conditional schema from `if` passes
       */
      then?: Partial<Schema>;
      /**
       * A schema to apply if the conditional schema from `if` fails
       */
      else?: Partial<Schema>;
    }

    export interface RefSchema {
      /**
       * A json-pointer to a schema to use as a reference
       */
      $ref: string;
    }

    export interface StringSchema extends BaseSchema {
      type: "string";
    }

    export interface IntegerSchema extends BaseSchema {
      type: "integer";
    }

    export interface NumberSchema extends BaseSchema {
      type: "number";
    }

    export interface NullSchema extends BaseSchema {
      type: "null";
    }

    export interface BooleanSchema extends BaseSchema {
      type: "boolean";
    }

    export interface ArraySchema extends BaseSchema {
      type: "array";
      /**
       * The schema for the items in the array
       */
      items: Schema | {}
    }

    export interface TupleSchema extends BaseSchema {
      type: "array";
      /**
       * The schemas for the items in the tuple
       */
      items: Schema[];
    }

    type ObjectProperties = Record<string, Schema> & {
      anyOf?: Record<string, Schema>[];
      allOf?: Record<string, Schema>[];
      if?: Record<string, Schema>;
      then?: Record<string, Schema>;
      else?: Record<string, Schema>;
    }

    export interface ObjectSchema<T extends ObjectProperties = {}, U extends ObjectProperties = {}> extends BaseSchema {
      type: "object";
      /**
       * Describe the properties of the object
       */
      properties?: T;
      /**
       * The required properties of the object
       */
      required?: (keyof T)[];
      /**
       * Describe properties that have keys following a given pattern
       */
      patternProperties?: U;
      /**
       * Specifies whether additional properties on the object are allowed, and optionally what schema they should
       * adhere to
       * @default false
       */
      additionalProperties?: Schema | boolean;
    }

    export type Schema =
      | RefSchema
      | StringSchema
      | IntegerSchema
      | NumberSchema
      | NullSchema
      | BooleanSchema
      | ArraySchema
      | TupleSchema
      | ObjectSchema;
  }

  /**
   * Build a stringify function using a schema of the documents that should be stringified
   * @param schema The schema used to stringify values
   */
  function build(schema: build.StringSchema): (doc: string) => string;
  function build(schema: build.IntegerSchema | build.NumberSchema): (doc: number) => string;
  function build(schema: build.NullSchema): (doc: null) => 'null';
  function build(schema: build.BooleanSchema): (doc: boolean) => string;
  function build(schema: build.ArraySchema | build.TupleSchema): (doc: any[]) => string;
  function build(schema: build.ObjectSchema): (doc: object) => string;
  function build(schema: build.Schema): (doc: object | any[] | string | number | boolean | null) => string;
  export = build;
}
