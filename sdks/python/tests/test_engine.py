"""Tests for the Engine."""

import pytest
from flowforge_sdk import RunStatus, node, workflow
from flowforge_sdk.engine import Engine
from flowforge_sdk.errors import WorkflowNotFoundError


@pytest.fixture
def engine():
    return Engine()


class TestEngine:
    @pytest.mark.asyncio
    async def test_registers_and_lists_workflows(self, engine):
        async def handler(ctx):
            return "ok"

        wf = workflow("test-wf").trigger(type="manual").pipe(node("step-1").handler(handler))
        engine.register(wf)
        assert "test-wf" in engine.list_workflows()

    @pytest.mark.asyncio
    async def test_triggers_workflow(self, engine):
        async def handler(ctx):
            return f"processed: {ctx.input}"

        wf = workflow("test-wf").trigger(type="manual").pipe(node("step-1").handler(handler))
        engine.register(wf)

        run = await engine.trigger("test-wf", "hello")
        assert run.status == RunStatus.COMPLETED
        assert run.output == "processed: hello"

    @pytest.mark.asyncio
    async def test_throws_for_unknown_workflow(self, engine):
        with pytest.raises(WorkflowNotFoundError):
            await engine.trigger("nonexistent")

    @pytest.mark.asyncio
    async def test_multi_node_workflow(self, engine):
        async def add(ctx):
            return 10

        async def double(ctx):
            return ctx.input * 2

        wf = (
            workflow("multi")
            .trigger(type="manual")
            .pipe(node("add").handler(add))
            .pipe(node("double").depends_on("add").handler(double))
        )
        engine.register(wf)

        run = await engine.trigger("multi")
        assert run.status == RunStatus.COMPLETED
        assert run.output == 20

    @pytest.mark.asyncio
    async def test_parallel_nodes(self, engine):
        async def source(ctx):
            return 1

        async def left(ctx):
            return ctx.input + 10

        async def right(ctx):
            return ctx.input + 20

        async def merge(ctx):
            return ctx.input["left"] + ctx.input["right"]

        wf = (
            workflow("parallel")
            .trigger(type="manual")
            .pipe(node("source").handler(source))
            .parallel([
                node("left").handler(left),
                node("right").handler(right),
            ])
            .join(node("merge").handler(merge))
        )
        engine.register(wf)

        run = await engine.trigger("parallel")
        assert run.status == RunStatus.COMPLETED
        assert run.output == 32  # (1+10) + (1+20)

    @pytest.mark.asyncio
    async def test_captures_failure(self, engine):
        async def fail_handler(ctx):
            raise RuntimeError("boom")

        wf = workflow("failing").trigger(type="manual").pipe(node("fail").handler(fail_handler))
        engine.register(wf)

        run = await engine.trigger("failing")
        assert run.status == RunStatus.FAILED
        assert "boom" in (run.error or "")

    @pytest.mark.asyncio
    async def test_event_emission(self, engine):
        async def handler(ctx):
            return ctx.input

        wf = (
            workflow("event-wf")
            .trigger(type="event", event="user.created")
            .pipe(node("step").handler(handler))
        )
        engine.register(wf)

        runs = await engine.emit("user.created", {"user_id": "123"})
        assert len(runs) == 1
        assert runs[0].status == RunStatus.COMPLETED

    @pytest.mark.asyncio
    async def test_no_match_for_unknown_event(self, engine):
        async def handler(ctx):
            return ctx.input

        wf = (
            workflow("event-wf")
            .trigger(type="event", event="user.created")
            .pipe(node("step").handler(handler))
        )
        engine.register(wf)

        runs = await engine.emit("order.placed", {})
        assert len(runs) == 0

    @pytest.mark.asyncio
    async def test_retry_on_failure(self, engine):
        attempt = {"count": 0}

        async def flaky(ctx):
            attempt["count"] += 1
            if attempt["count"] < 3:
                raise RuntimeError("not yet")
            return "done"

        wf = (
            workflow("retry-wf")
            .trigger(type="manual")
            .pipe(
                node("flaky")
                .retry(max_attempts=3, backoff="fixed", delay_ms=0)
                .handler(flaky)
            )
        )
        engine.register(wf)

        run = await engine.trigger("retry-wf")
        assert run.status == RunStatus.COMPLETED
        assert run.output == "done"

    @pytest.mark.asyncio
    async def test_stores_and_retrieves_runs(self, engine):
        async def handler(ctx):
            return "ok"

        wf = workflow("test-wf").trigger(type="manual").pipe(node("step").handler(handler))
        engine.register(wf)

        run = await engine.trigger("test-wf")
        retrieved = engine.get_run(run.id)
        assert retrieved is not None
        assert retrieved.id == run.id

    @pytest.mark.asyncio
    async def test_conditional_skip(self, engine):
        called = {"value": False}

        async def handler(ctx):
            called["value"] = True
            return "ran"

        wf = (
            workflow("cond-wf")
            .trigger(type="manual")
            .pipe(node("skip").condition(lambda ctx: False).handler(handler))
        )
        engine.register(wf)

        run = await engine.trigger("cond-wf")
        assert run.status == RunStatus.COMPLETED
        assert not called["value"]
