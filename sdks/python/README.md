# Conduit Python SDK

Code-first workflow engine — Python SDK.

## Installation

```bash
pip install conduit-sdk
```

## Quick Start

```python
from conduit_sdk import node, workflow
from conduit_sdk.engine import Engine

# Define nodes
greet = node("greet").handler(lambda ctx: f"Hello, {ctx.input}!")

# Define workflow
wf = workflow("hello").trigger(type="manual").pipe(greet)

# Run
engine = Engine()
engine.register(wf)
run = await engine.trigger("hello", "World")
print(run.output)  # "Hello, World!"
```
