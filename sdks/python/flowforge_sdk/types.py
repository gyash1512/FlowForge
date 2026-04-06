"""Core types for FlowForge SDK."""

from __future__ import annotations

import asyncio
from datetime import datetime
from enum import Enum
from typing import Any, Protocol

from pydantic import BaseModel, Field


class StrEnum(str, Enum):
    """str-valued Enum compatible with Python 3.10+."""


class RunStatus(StrEnum):
    PENDING = "pending"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"
    PAUSED = "paused"
    WAITING = "waiting"


class StepStatus(StrEnum):
    PENDING = "pending"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"
    SKIPPED = "skipped"
    RETRYING = "retrying"


class NodeType(StrEnum):
    """Legacy node type enum (use NodeCategory for new code)."""
    FUNCTION = "function"
    AGENT = "agent"
    DATA = "data"
    INTEGRATION = "integration"
    CONDITION = "condition"
    PARALLEL = "parallel"
    LOOP = "loop"
    DELAY = "delay"
    WEBHOOK = "webhook"
    CUSTOM = "custom"


class NodeCategory(StrEnum):
    """Node categories matching the TypeScript SDK."""
    DATA = "data"
    COMMUNICATION = "communication"
    AI = "ai"
    CONTROL = "control"
    TRANSFORM = "transform"
    CUSTOM = "custom"


class TriggerType(StrEnum):
    EVENT = "event"
    CRON = "cron"
    WEBHOOK = "webhook"
    MANUAL = "manual"
    SUB_WORKFLOW = "sub-workflow"


class RetryConfig(BaseModel):
    max_attempts: int = 3
    backoff: str = "exponential"
    delay_ms: int = 1000
    max_delay_ms: int | None = None


class WebhookConfig(BaseModel):
    path: str
    method: str | None = None


class TriggerDefinition(BaseModel):
    type: TriggerType
    event: str | None = None
    cron: str | None = None
    webhook: WebhookConfig | None = None


class Logger(Protocol):
    def info(self, msg: str, **kwargs: Any) -> None: ...
    def warn(self, msg: str, **kwargs: Any) -> None: ...
    def error(self, msg: str, **kwargs: Any) -> None: ...
    def debug(self, msg: str, **kwargs: Any) -> None: ...


class WorkflowMetadata(BaseModel):
    """Metadata about the current workflow run."""
    run_id: str
    workflow_id: str
    workflow_name: str
    attempt: int
    started_at: datetime
    tenant_id: str | None = None


class WorkflowEventModel(BaseModel):
    """A typed event that triggers workflows."""
    id: str
    type: str
    data: Any = None
    source: str | None = None
    timestamp: datetime = Field(default_factory=datetime.now)


class NodeContext:
    """Context passed to node handlers during execution."""

    def __init__(
        self,
        *,
        input: Any,
        run_id: str,
        step_id: str,
        workflow_id: str,
        attempt: int,
        store: dict[str, Any],
        cancel_event: asyncio.Event | None = None,
    ) -> None:
        self.input = input
        self.run_id = run_id
        self.step_id = step_id
        self.workflow_id = workflow_id
        self.attempt = attempt
        self.store = store
        self._cancel_event = cancel_event or asyncio.Event()

    @property
    def cancelled(self) -> bool:
        return self._cancel_event.is_set()


class RunRecord(BaseModel):
    id: str
    workflow_id: str
    status: RunStatus = RunStatus.PENDING
    trigger: TriggerDefinition
    input: Any = None
    output: Any = None
    error: str | None = None
    started_at: datetime | None = None
    completed_at: datetime | None = None
    created_at: datetime = Field(default_factory=datetime.now)
    updated_at: datetime = Field(default_factory=datetime.now)
    metadata: dict[str, Any] | None = None


class StepRecord(BaseModel):
    id: str
    run_id: str
    node_id: str
    status: StepStatus = StepStatus.PENDING
    input: Any = None
    output: Any = None
    error: str | None = None
    attempt: int = 1
    started_at: datetime | None = None
    completed_at: datetime | None = None
    created_at: datetime = Field(default_factory=datetime.now)
    duration_ms: int | None = None
