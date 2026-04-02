"""Tests for the Workflow builder."""

import pytest

from flowforge_sdk import Workflow, workflow, node


def _dummy_handler(ctx):
    return "ok"


async def _async_handler(ctx):
    return "ok"


def _make_node(id: str):
    return node(id).handler(_async_handler)


class TestWorkflowBuilder:
    def test_builds_minimal_workflow(self):
        wf = (
            workflow("simple")
            .trigger(type="manual")
            .pipe(_make_node("step-1"))
            .build()
        )
        assert wf.id == "simple"
        assert wf.name == "simple"
        assert wf.version == "1.0.0"
        assert wf.trigger.type == "manual"
        assert wf.node_ids == ["step-1"]

    def test_throws_without_trigger(self):
        with pytest.raises(ValueError, match="requires a trigger"):
            workflow("no-trigger").pipe(_make_node("a")).build()

    def test_throws_without_nodes(self):
        with pytest.raises(ValueError, match="requires at least one node"):
            workflow("no-nodes").trigger(type="manual").build()

    def test_sets_all_properties(self):
        wf = (
            workflow("full")
            .name("Full Workflow")
            .version("2.0.0")
            .description("A test workflow")
            .trigger(type="event", event="user.created")
            .timeout(60000)
            .retry(max_attempts=5, backoff="linear", delay_ms=2000)
            .metadata({"team": "platform"})
            .pipe(_make_node("a"))
            .build()
        )
        assert wf.name == "Full Workflow"
        assert wf.version == "2.0.0"
        assert wf.description == "A test workflow"
        assert wf.trigger.event == "user.created"
        assert wf.timeout == 60000
        assert wf.retry is not None
        assert wf.retry.max_attempts == 5

    def test_pipes_multiple_nodes(self):
        wf = (
            workflow("pipeline")
            .trigger(type="manual")
            .pipe(_make_node("step-1"))
            .pipe(_make_node("step-2"))
            .pipe(_make_node("step-3"))
            .build()
        )
        assert wf.node_ids == ["step-1", "step-2", "step-3"]

    def test_supports_cron_trigger(self):
        wf = (
            workflow("cron-wf")
            .trigger(type="cron", cron="0 * * * *")
            .pipe(_make_node("tick"))
            .build()
        )
        assert wf.trigger.type == "cron"
        assert wf.trigger.cron == "0 * * * *"

    def test_supports_webhook_trigger(self):
        wf = (
            workflow("webhook-wf")
            .trigger(type="webhook", webhook_path="/hooks/stripe", webhook_method="POST")
            .pipe(_make_node("handle"))
            .build()
        )
        assert wf.trigger.type == "webhook"
        assert wf.trigger.webhook is not None
        assert wf.trigger.webhook.path == "/hooks/stripe"
