"""Workflow builder for defining workflows."""

from __future__ import annotations

from typing import Any

from pydantic import BaseModel

from conduit_sdk.node import Node
from conduit_sdk.types import RetryConfig, TriggerDefinition, TriggerType, WebhookConfig


class WorkflowDefinition(BaseModel):
    """Serializable workflow definition."""

    id: str
    name: str
    version: str = "1.0.0"
    description: str | None = None
    trigger: TriggerDefinition
    node_ids: list[str]
    metadata: dict[str, Any] | None = None
    timeout: int | None = None
    retry: RetryConfig | None = None


class Workflow:
    """Builder for defining a workflow."""

    def __init__(self, id: str) -> None:
        self._id = id
        self._name = id
        self._version = "1.0.0"
        self._description: str | None = None
        self._trigger: TriggerDefinition | None = None
        self._nodes: list[Node] = []
        self._metadata: dict[str, Any] | None = None
        self._timeout: int | None = None
        self._retry: RetryConfig | None = None

    def name(self, name: str) -> Workflow:
        self._name = name
        return self

    def version(self, version: str) -> Workflow:
        self._version = version
        return self

    def description(self, desc: str) -> Workflow:
        self._description = desc
        return self

    def trigger(
        self,
        *,
        type: str,
        event: str | None = None,
        cron: str | None = None,
        webhook_path: str | None = None,
        webhook_method: str | None = None,
    ) -> Workflow:
        webhook = None
        if webhook_path:
            webhook = WebhookConfig(path=webhook_path, method=webhook_method)
        self._trigger = TriggerDefinition(
            type=TriggerType(type),
            event=event,
            cron=cron,
            webhook=webhook,
        )
        return self

    def timeout(self, ms: int) -> Workflow:
        self._timeout = ms
        return self

    def retry(
        self,
        max_attempts: int = 3,
        backoff: str = "exponential",
        delay_ms: int = 1000,
        max_delay_ms: int | None = None,
    ) -> Workflow:
        self._retry = RetryConfig(
            max_attempts=max_attempts,
            backoff=backoff,
            delay_ms=delay_ms,
            max_delay_ms=max_delay_ms,
        )
        return self

    def metadata(self, meta: dict[str, Any]) -> Workflow:
        self._metadata = meta
        return self

    def pipe(self, n: Node) -> Workflow:
        self._nodes.append(n)
        return self

    def parallel(self, nodes: list[Node]) -> Workflow:
        last = self._nodes[-1] if self._nodes else None
        for n in nodes:
            if last and n._depends_on is None:
                n.depends_on(last.id)
            self._nodes.append(n)
        return self

    def join(self, n: Node) -> Workflow:
        # Find leaf nodes (not depended on by any other node)
        all_deps: set[str] = set()
        for existing in self._nodes:
            defn = existing.build()
            if defn.depends_on:
                all_deps.update(defn.depends_on)
        leaves = [nd for nd in self._nodes if nd.id not in all_deps]
        if leaves and n._depends_on is None:
            n.depends_on(*[nd.id for nd in leaves])
        self._nodes.append(n)
        return self

    @property
    def nodes(self) -> list[Node]:
        return list(self._nodes)

    def build(self) -> WorkflowDefinition:
        if self._trigger is None:
            raise ValueError(f'Workflow "{self._id}" requires a trigger')
        if not self._nodes:
            raise ValueError(f'Workflow "{self._id}" requires at least one node')

        return WorkflowDefinition(
            id=self._id,
            name=self._name,
            version=self._version,
            description=self._description,
            trigger=self._trigger,
            node_ids=[n.id for n in self._nodes],
            metadata=self._metadata,
            timeout=self._timeout,
            retry=self._retry,
        )


def workflow(id: str) -> Workflow:
    """Create a new workflow builder."""
    return Workflow(id)
