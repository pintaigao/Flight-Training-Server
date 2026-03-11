import { CustomScalar, Scalar } from '@nestjs/graphql';
import { GraphQLScalarType, Kind, type ValueNode } from 'graphql';

type JsonValue = null | boolean | number | string | JsonValue[] | { [k: string]: JsonValue };

function parseLiteral(ast: ValueNode): JsonValue {
  switch (ast.kind) {
    case Kind.NULL:
      return null;
    case Kind.BOOLEAN:
      return ast.value;
    case Kind.INT:
      return Number.parseInt(ast.value, 10);
    case Kind.FLOAT:
      return Number.parseFloat(ast.value);
    case Kind.STRING:
      return ast.value;
    case Kind.LIST:
      return ast.values.map(parseLiteral);
    case Kind.OBJECT: {
      const out: Record<string, JsonValue> = {};
      for (const f of ast.fields) out[f.name.value] = parseLiteral(f.value);
      return out;
    }
    default:
      return null;
  }
}

@Scalar('JSON')
export class JSONScalar implements CustomScalar<JsonValue, JsonValue> {
  description = 'JSON scalar';

  private readonly impl = new GraphQLScalarType({
    name: 'JSON',
    serialize: (value) => value as JsonValue,
    parseValue: (value) => value as JsonValue,
    parseLiteral,
  });

  serialize(value: JsonValue) {
    return this.impl.serialize(value) as JsonValue;
  }
  parseValue(value: JsonValue) {
    return this.impl.parseValue(value) as JsonValue;
  }
  parseLiteral(ast: ValueNode) {
    return this.impl.parseLiteral(ast, {}) as JsonValue;
  }
}

