declare namespace build {
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
     * Additional schema definition to reference from within the schema
     */
    definitions?: Record<string, Schema>
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

  type ObjectProperties = Record<string, Partial<Schema>> & {
    anyOf?: ObjectProperties[];
    allOf?: ObjectProperties[];
    if?: ObjectProperties;
    then?: ObjectProperties;
    else?: ObjectProperties;
  }

  export interface ObjectSchema extends BaseSchema {
    type: "object";
    /**
     * Describe the properties of the object
     */
    properties?: ObjectProperties;
    /**
     * The required properties of the object
     */
    required?: string[];
    /**
     * Describe properties that have keys following a given pattern
     */
    patternProperties?: ObjectProperties;
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
declare function build(schema: build.StringSchema): (doc: string) => string;
declare function build(schema: build.IntegerSchema | build.NumberSchema): (doc: number) => string;
declare function build(schema: build.NullSchema): (doc: null) => 'null';
declare function build(schema: build.BooleanSchema): (doc: boolean) => string;
declare function build(schema: build.ArraySchema | build.TupleSchema): (doc: any[]) => string;
declare function build(schema: build.ObjectSchema): (doc: object) => string;
declare function build(schema: build.Schema): (doc: object | any[] | string | number | boolean | null) => string;

export = build;
