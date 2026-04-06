"""Tests for the Node builder."""

import pytest

from flowforge_sdk import node, NodeType


class TestNodeBuilder:
    def test_builds_minimal_node(self):
        async def handler(ctx):
            return f"Hello, {ctx.input}"

        n = node("greet").handler(handler).build()
        assert n.id == "greet"
        assert n.name == "greet"
        assert n.type == NodeType.FUNCTION

    def test_throws_without_handler(self):
        with pytest.raises(ValueError, match="requires a handler"):
            node("broken").build()

    def test_sets_name_type_metadata(self):
        async def handler(ctx):
            return []

        n = (
            node("fetch")
            .name("Fetch Users")
            .type(NodeType.DATA)
            .metadata({"source": "api"})
            .handler(handler)
            .build()
        )
        assert n.name == "Fetch Users"
        assert n.type == NodeType.DATA
        assert n.metadata == {"source": "api"}

    def test_configures_retry(self):
        async def handler(ctx):
            return "ok"

        n = (
            node("retry-node")
            .retry(max_attempts=5, backoff="linear", delay_ms=500)
            .handler(handler)
            .build()
        )
        assert n.retry is not None
        assert n.retry.max_attempts == 5
        assert n.retry.backoff == "linear"
        assert n.retry.delay_ms == 500

    def test_sets_timeout(self):
        async def handler(ctx):
            return "done"

        n = node("slow").timeout(5000).handler(handler).build()
        assert n.timeout == 5000

    def test_sets_depends_on(self):
        async def handler(ctx):
            return "ok"

        n = node("step-2").depends_on("step-1", "step-0").handler(handler).build()
        assert n.depends_on == ["step-1", "step-0"]

    def test_supports_chaining(self):
        async def handler(ctx):
            return 42

        n = (
            node("chained")
            .type(NodeType.INTEGRATION)
            .name("Chained Node")
            .timeout(3000)
            .retry(max_attempts=2)
            .metadata({"key": "val"})
            .handler(handler)
            .build()
        )
        assert n.id == "chained"
        assert n.name == "Chained Node"
        assert n.type == NodeType.INTEGRATION
        assert n.timeout == 3000
        assert n.retry is not None
        assert n.retry.max_attempts == 2
