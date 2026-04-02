"""Error types for FlowForge SDK."""

from __future__ import annotations

from typing import Any


class FlowForgeError(Exception):
    """Base error for all FlowForge errors."""

    def __init__(
        self,
        message: str,
        code: str,
        status_code: int = 500,
        details: dict[str, Any] | None = None,
    ) -> None:
        super().__init__(message)
        self.code = code
        self.status_code = status_code
        self.details = details or {}


class WorkflowNotFoundError(FlowForgeError):
    def __init__(self, workflow_id: str) -> None:
        super().__init__(f"Workflow not found: {workflow_id}", "WORKFLOW_NOT_FOUND", 404)


class NodeExecutionError(FlowForgeError):
    def __init__(self, node_id: str, cause: Exception | None = None) -> None:
        msg = f"Node execution failed: {node_id}"
        if cause:
            msg += f" — {cause}"
        super().__init__(msg, "NODE_EXECUTION_FAILED", 500, {"node_id": node_id})
        self.__cause__ = cause


class NodeTimeoutError(FlowForgeError):
    def __init__(self, node_id: str, timeout_ms: int) -> None:
        super().__init__(
            f"Node {node_id} timed out after {timeout_ms}ms",
            "NODE_TIMEOUT",
            408,
            {"node_id": node_id, "timeout_ms": timeout_ms},
        )


class ValidationError(FlowForgeError):
    def __init__(self, message: str, details: dict[str, Any] | None = None) -> None:
        super().__init__(message, "VALIDATION_ERROR", 400, details)


class RetryExhaustedError(FlowForgeError):
    def __init__(self, node_id: str, max_attempts: int) -> None:
        super().__init__(
            f"Node {node_id} exhausted all {max_attempts} retry attempts",
            "RETRY_EXHAUSTED",
            500,
            {"node_id": node_id, "max_attempts": max_attempts},
        )


class WorkflowTimeoutError(FlowForgeError):
    def __init__(self, workflow_id: str, timeout_ms: int) -> None:
        super().__init__(
            f"Workflow {workflow_id} timed out after {timeout_ms}ms",
            "WORKFLOW_TIMEOUT",
            408,
            {"workflow_id": workflow_id, "timeout_ms": timeout_ms},
        )
