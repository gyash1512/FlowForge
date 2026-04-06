# Math Tool

The Math tool evaluates, simplifies, and differentiates mathematical expressions and performs unit conversions using the mathjs library. It is a pure computation tool with no side effects.

## Quick Reference

| Property      | Value                                     |
| ------------- | ----------------------------------------- |
| **Node name** | `tools/math`                              |
| **Version**   | 0.1.0                                     |
| **Library**   | mathjs                                    |
| **Actions**   | evaluate, simplify, derivative, convert   |
| **Tags**      | math, calculator, algebra, tools, agentic |

## Actions

### evaluate

Evaluate a mathematical expression and return the numeric or symbolic result.

| Parameter    | Type   | Required | Description                                         |
| ------------ | ------ | -------- | --------------------------------------------------- |
| `expression` | string | Yes      | Mathematical expression (e.g. `"2^10 + sqrt(144)"`) |

Returns the evaluated result. Numeric results are rounded to the configured `precision`.

**Examples:**

| Expression           | Result |
| -------------------- | ------ |
| `2 + 3 * 4`          | `14`   |
| `sqrt(144) + log(e)` | `13`   |
| `det([1, 2; 3, 4])`  | `-2`   |
| `sin(pi / 2)`        | `1`    |

### simplify

Simplify an algebraic expression.

| Parameter    | Type   | Required | Description                                   |
| ------------ | ------ | -------- | --------------------------------------------- |
| `expression` | string | Yes      | Expression to simplify (e.g. `"2x + 3x - x"`) |

Returns the simplified expression as a string (e.g. `"4 * x"`).

### derivative

Compute the symbolic derivative of an expression with respect to a variable.

| Parameter    | Type   | Required | Description                                              |
| ------------ | ------ | -------- | -------------------------------------------------------- |
| `expression` | string | Yes      | Expression to differentiate (e.g. `"x^3 + 2*x"`)         |
| `variable`   | string | No       | Variable to differentiate with respect to (default: `x`) |

Returns the derivative as a string (e.g. `"3 * x ^ 2 + 2"`).

### convert

Convert a value from one unit to another.

| Parameter | Type   | Required | Description                             |
| --------- | ------ | -------- | --------------------------------------- |
| `from`    | string | Yes      | Source value with unit (e.g. `"10 km"`) |
| `to`      | string | Yes      | Target unit (e.g. `"miles"`)            |

Returns:

```json
{
  "value": 6.2137119223733,
  "unit": "miles",
  "formatted": "6.2137119223733 miles"
}
```

## Output Schema

| Field        | Type                      | Description                                                     |
| ------------ | ------------------------- | --------------------------------------------------------------- |
| `result`     | number, string, or object | The computation result                                          |
| `expression` | string                    | The original expression (or a descriptive string for `convert`) |
| `success`    | boolean                   | `true` on success                                               |

## Configuration Reference

| Property           | Type     | Default | Description                                                                           |
| ------------------ | -------- | ------- | ------------------------------------------------------------------------------------- |
| `precision`        | integer  | `14`    | Number of significant digits for numeric output.                                      |
| `allowedFunctions` | string[] | (none)  | If set, restrict mathjs to only these functions. All other functions are unavailable. |

### Function restriction

When `allowedFunctions` is configured, a restricted scope is built containing only the specified mathjs functions. This is useful for limiting what an AI agent can compute -- for example, allowing `["add", "subtract", "multiply", "divide"]` but not `evaluate` or `import`.

!!! note
If an entry in `allowedFunctions` does not correspond to a real mathjs function, it is silently ignored.

## Safety

The Math tool has a minimal attack surface since it performs pure computations with no I/O:

- **No filesystem access**: All computation happens in memory.
- **No network access**: The tool does not make any outbound requests.
- **Precision control**: Numeric results are bounded by the `precision` setting, preventing excessively large output.
- **Function allowlisting**: The `allowedFunctions` config restricts which mathjs functions are available, providing defense against unexpected computation patterns.

!!! warning
The `evaluate` action can evaluate arbitrary mathjs expressions, including matrix operations and function definitions. If you want to restrict an agent to basic arithmetic, use `allowedFunctions` to limit the available operations.

## Usage Example

```typescript
import { mathNode } from '@flowforge/nodes';

const workflow = {
  nodes: [
    {
      id: 'convert-units',
      node: mathNode,
      config: {
        precision: 6,
      },
      input: {
        action: 'convert',
        from: '100 celsius',
        to: 'fahrenheit',
      },
    },
  ],
};
```

### Derivative Example

```typescript
{
  id: 'compute-gradient',
  node: mathNode,
  config: { precision: 10 },
  input: {
    action: 'derivative',
    expression: '3*x^4 + 2*x^2 - 7*x + 1',
    variable: 'x',
  },
}
// Result: "12 * x ^ 3 + 4 * x - 7"
```

!!! tip
The `convert` action supports a wide range of units: length, mass, time, temperature, volume, area, speed, force, energy, power, pressure, and more. Refer to the [mathjs unit documentation](https://mathjs.org/docs/datatypes/units.html) for the full list.
