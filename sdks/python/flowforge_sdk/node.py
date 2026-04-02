"""Node builder for defining workflow nodes."""

from __future__ import annotations

from typing import Any, Callable, Coroutine

from pydantic import BaseModel

from flowforge_sdk.types import NodeContext, NodeType, RetryConfig


class NodeDefinition(BaseModel):
    """Serializable node definition."""

    id: str
    name: str
    type: NodeType = NodeType.FUNCTION
    retry: RetryConfig | None = None
    timeout: int | None = None
    depends_on: list[str] | None = None
    metadata: dict[str, Any] | None = None

    model_config = {"arbitrary_types_allowed": True}


HandlerFn = Callable[[NodeContext], Coroutine[Any, Any, Any]]
ConditionFn = Callable[[NodeContext], Coroutine[Any, Any, bool] | bool]


class Node:
    """Builder for defining a workflow node."""

    def __init__(self, id: str) -> None:
        self._id = id
        self._name = id
        self._type = NodeType.FUNCTION
        self._handler: HandlerFn | None = None
        self._retry: RetryConfig | None = None
        self._timeout: int | None = None
        self._depends_on: list[str] | None = None
        self._condition: ConditionFn | None = None
        self._metadata: dict[str, Any] | None = None
        self._input_model: type[BaseModel] | None = None
        self._output_model: type[BaseModel] | None = None

    def name(self, name: str) -> Node:
        self._name = name
        return self

    def type(self, node_type: NodeType) -> Node:
        self._type = node_type
        return self

    def input_model(self, model: type[BaseModel]) -> Node:
        self._input_model = model
        return self

    def output_model(self, model: type[BaseModel]) -> Node:
        self._output_model = model
        return self

    def handler(self, fn: HandlerFn) -> Node:
        self._handler = fn
        return self

    def retry(
        self,
        max_attempts: int = 3,
        backoff: str = "exponential",
        delay_ms: int = 1000,
        max_delay_ms: int | None = None,
    ) -> Node:
        self._retry = RetryConfig(
            max_attempts=max_attempts,
            backoff=backoff,
            delay_ms=delay_ms,
            max_delay_ms=max_delay_ms,
        )
        return self

    def timeout(self, ms: int) -> Node:
        self._timeout = ms
        return self

    def depends_on(self, *node_ids: str) -> Node:
        self._depends_on = list(node_ids)
        return self

    def condition(self, fn: ConditionFn) -> Node:
        self._condition = fn
        return self

    def metadata(self, meta: dict[str, Any]) -> Node:
        self._metadata = meta
        return self

    def build(self) -> NodeDefinition:
        if self._handler is None:
            raise ValueError(f'Node "{self._id}" requires a handler')
        return NodeDefinition(
            id=self._id,
            name=self._name,
            type=self._type,
            retry=self._retry,
            timeout=self._timeout,
            depends_on=self._depends_on,
            metadata=self._metadata,
        )

    @property
    def id(self) -> str:
        return self._id

    def get_handler(self) -> HandlerFn:
        if self._handler is None:
            raise ValueError(f'Node "{self._id}" requires a handler')
        return self._handler

    def get_condition(self) -> ConditionFn | None:
        return self._condition

    def get_input_model(self) -> type[BaseModel] | None:
        return self._input_model

    def get_output_model(self) -> type[BaseModel] | None:
        return self._output_model


def node(id: str) -> Node:
    """Create a new node builder."""
    return Node(id)
