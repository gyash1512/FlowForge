"""Tests for error types."""

from conduit_sdk.errors import (
    ConduitError,
    NodeExecutionError,
    NodeTimeoutError,
    RetryExhaustedError,
    ValidationError,
    WorkflowNotFoundError,
    WorkflowTimeoutError,
)


class TestErrors:
    def test_conduit_error(self):
        err = ConduitError("test", "TEST", 400)
        assert str(err) == "test"
        assert err.code == "TEST"
        assert err.status_code == 400

    def test_workflow_not_found(self):
        err = WorkflowNotFoundError("wf_123")
        assert err.status_code == 404
        assert err.code == "WORKFLOW_NOT_FOUND"
        assert "wf_123" in str(err)

    def test_node_execution_error(self):
        cause = RuntimeError("boom")
        err = NodeExecutionError("nd_123", cause)
        assert "boom" in str(err)
        assert err.__cause__ is cause

    def test_node_timeout_error(self):
        err = NodeTimeoutError("nd_123", 5000)
        assert err.status_code == 408
        assert err.details == {"node_id": "nd_123", "timeout_ms": 5000}

    def test_validation_error(self):
        err = ValidationError("bad input")
        assert err.status_code == 400

    def test_retry_exhausted_error(self):
        err = RetryExhaustedError("nd_123", 3)
        assert err.details == {"node_id": "nd_123", "max_attempts": 3}

    def test_workflow_timeout_error(self):
        err = WorkflowTimeoutError("wf_123", 30000)
        assert err.status_code == 408
