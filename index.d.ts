import { Options as AjvOptions } from "ajv"
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
    /**
     * Open API 3.0 spec states that any value that can be null must be declared `nullable`
     * @default false
     */
    nullable?: boolean;
  }

  export interface RefSchema {
    /**
     * A json-pointer to a schema to use as a reference
     */
    $ref: string;
  }
  
  export interface AnySchema extends BaseSchema {
  }

  export interface StringSchema extends BaseSchema {
    type: "string";
    format?: string;
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

  export interface Options {
    /**
     * Optionally add an external definition to reference from your schema
     */
    schema?: Record<string, Schema>
    /**
     * Configure Ajv, which is used to evaluate conditional schemas and combined (anyOf) schemas
     */
    ajv?: AjvOptions
    /**
     * Optionally configure how the integer will be rounded
     */
    rounding?: 'ceil' | 'floor' | 'round'
  }
}

/**
 * Build a stringify function using a schema of the documents that should be stringified
 * @param schema The schema used to stringify values
 * @param options The options to use (optional)
 */
declare function build(schema: build.AnySchema, options?: build.Options): (doc: any) => any;
declare function build(schema: build.StringSchema, options?: build.Options): (doc: string) => string;
declare function build(schema: build.IntegerSchema | build.NumberSchema, options?: build.Options): (doc: number) => string;
declare function build(schema: build.NullSchema, options?: build.Options): (doc: null) => "null";
declare function build(schema: build.BooleanSchema, options?: build.Options): (doc: boolean) => string;
declare function build(schema: build.ArraySchema | build.TupleSchema, options?: build.Options): (doc: any[]) => string;
declare function build(schema: build.ObjectSchema, options?: build.Options): (doc: object) => string;
declare function build(schema: build.Schema, options?: build.Options): (doc: object | any[] | string | number | boolean | null) => string;

export = build;
