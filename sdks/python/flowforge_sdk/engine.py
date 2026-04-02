"""In-memory workflow execution engine."""

from __future__ import annotations

import asyncio
import logging
from datetime import datetime
from typing import Any
from uuid import uuid4

from flowforge_sdk.errors import (
    NodeExecutionError,
    NodeTimeoutError,
    RetryExhaustedError,
    WorkflowNotFoundError,
)
from flowforge_sdk.node import Node
from flowforge_sdk.types import NodeContext, RunRecord, RunStatus, StepRecord, StepStatus
from flowforge_sdk.workflow import Workflow

logger = logging.getLogger("flowforge")


def _make_id(prefix: str) -> str:
    return f"{prefix}_{uuid4().hex[:21]}"


def _compute_delay(backoff: str, delay_ms: int, attempt: int, max_delay_ms: int | None) -> float:
    if backoff == "fixed":
        delay = delay_ms
    elif backoff == "linear":
        delay = delay_ms * attempt
    else:  # exponential
        delay = delay_ms * (2 ** (attempt - 1))

    if max_delay_ms is not None:
        delay = min(delay, max_delay_ms)

    return delay / 1000.0


class Engine:
    """In-memory workflow execution engine."""

    def __init__(self) -> None:
        self._workflows: dict[str, Workflow] = {}
        self._runs: dict[str, RunRecord] = {}

    def register(self, wf: Workflow) -> None:
        defn = wf.build()
        self._workflows[defn.id] = wf
        logger.info("Registered workflow: %s", defn.id)

    def unregister(self, workflow_id: str) -> None:
        self._workflows.pop(workflow_id, None)

    def get_workflow(self, workflow_id: str) -> Workflow | None:
        return self._workflows.get(workflow_id)

    def list_workflows(self) -> list[str]:
        return list(self._workflows.keys())

    async def trigger(self, workflow_id: str, input: Any = None) -> RunRecord:
        wf = self._workflows.get(workflow_id)
        if wf is None:
            raise WorkflowNotFoundError(workflow_id)

        defn = wf.build()
        run_id = _make_id("run")
        run = RunRecord(
            id=run_id,
            workflow_id=workflow_id,
            trigger=defn.trigger,
            input=input,
        )

        store: dict[str, Any] = {}
        node_outputs: dict[str, Any] = {}
        cancel_event = asyncio.Event()

        try:
            run.status = RunStatus.RUNNING
            run.started_at = datetime.now()

            nodes = wf.nodes
            layers = _resolve_layers(nodes)

            for layer in layers:
                if cancel_event.is_set():
                    break

                results = await asyncio.gather(
                    *[
                        self._execute_node(
                            n,
                            input=input,
                            run_id=run_id,
                            workflow_id=workflow_id,
                            store=store,
                            node_outputs=node_outputs,
                            cancel_event=cancel_event,
                            workflow_retry=defn.retry,
                        )
                        for n in layer
                    ],
                    return_exceptions=True,
                )

                for i, result in enumerate(results):
                    if isinstance(result, BaseException):
                        node_id = layer[i].id
                        run.error = str(result)
                        logger.error("Node '%s' failed: %s", node_id, result)
                        cancel_event.set()
                        raise result

            # Last node output is the workflow output
            if nodes:
                last_node = nodes[-1]
                run.output = node_outputs.get(last_node.id)

            run.status = RunStatus.COMPLETED
        except Exception as exc:
            run.status = RunStatus.FAILED
            if not run.error:
                run.error = str(exc)
        finally:
            run.completed_at = datetime.now()
            run.updated_at = datetime.now()

        self._runs[run.id] = run
        return run

    async def emit(self, event: str, payload: Any = None) -> list[RunRecord]:
        runs: list[RunRecord] = []
        for wf_id, wf in self._workflows.items():
            defn = wf.build()
            if defn.trigger.type == "event" and defn.trigger.event == event:
                run = await self.trigger(wf_id, payload)
                runs.append(run)
        return runs

    def get_run(self, run_id: str) -> RunRecord | None:
        return self._runs.get(run_id)

    def list_runs(self, workflow_id: str | None = None) -> list[RunRecord]:
        runs = list(self._runs.values())
        if workflow_id:
            runs = [r for r in runs if r.workflow_id == workflow_id]
        return runs

    async def _execute_node(
        self,
        n: Node,
        *,
        input: Any,
        run_id: str,
        workflow_id: str,
        store: dict[str, Any],
        node_outputs: dict[str, Any],
        cancel_event: asyncio.Event,
        workflow_retry: Any | None,
    ) -> None:
        step_id = _make_id("stp")
        defn = n.build()

        # Determine input
        if defn.depends_on:
            if len(defn.depends_on) == 1:
                node_input = node_outputs.get(defn.depends_on[0], input)
            else:
                node_input = {dep: node_outputs.get(dep) for dep in defn.depends_on}
        else:
            node_input = input

        # Validate input model
        input_model = n.get_input_model()
        if input_model is not None and isinstance(node_input, dict):
            node_input = input_model.model_validate(node_input)

        # Check condition
        condition = n.get_condition()
        if condition is not None:
            ctx = NodeContext(
                input=node_input,
                run_id=run_id,
                step_id=step_id,
                workflow_id=workflow_id,
                attempt=1,
                store=store,
                cancel_event=cancel_event,
            )
            result = condition(ctx)
            if asyncio.iscoroutine(result):
                result = await result
            if not result:
                return

        retry_config = defn.retry or workflow_retry
        handler = n.get_handler()

        async def execute(attempt: int) -> Any:
            ctx = NodeContext(
                input=node_input,
                run_id=run_id,
                step_id=step_id,
                workflow_id=workflow_id,
                attempt=attempt,
                store=store,
                cancel_event=cancel_event,
            )

            if defn.timeout:
                return await asyncio.wait_for(
                    handler(ctx), timeout=defn.timeout / 1000.0
                )
            return await handler(ctx)

        if retry_config:
            max_attempts = retry_config.max_attempts if hasattr(retry_config, 'max_attempts') else retry_config.get('max_attempts', 3)
            backoff = retry_config.backoff if hasattr(retry_config, 'backoff') else retry_config.get('backoff', 'exponential')
            delay_ms = retry_config.delay_ms if hasattr(retry_config, 'delay_ms') else retry_config.get('delay_ms', 1000)
            max_delay_ms = retry_config.max_delay_ms if hasattr(retry_config, 'max_delay_ms') else retry_config.get('max_delay_ms')

            last_error: Exception | None = None
            for attempt in range(1, max_attempts + 1):
                try:
                    output = await execute(attempt)
                    node_outputs[defn.id] = output
                    return
                except Exception as exc:
                    last_error = exc
                    if attempt >= max_attempts:
                        break
                    delay = _compute_delay(backoff, delay_ms, attempt, max_delay_ms)
                    await asyncio.sleep(delay)

            raise RetryExhaustedError(defn.id, max_attempts)
        else:
            try:
                output = await execute(1)
                node_outputs[defn.id] = output
            except asyncio.TimeoutError:
                raise NodeTimeoutError(defn.id, defn.timeout or 0)
            except Exception as exc:
                raise NodeExecutionError(defn.id, exc) from exc


def _resolve_layers(nodes: list[Node]) -> list[list[Node]]:
    """Topological sort into parallel layers."""
    node_map = {n.id: n for n in nodes}
    in_degree: dict[str, int] = {}
    dependents: dict[str, list[str]] = {}

    for n in nodes:
        defn = n.build()
        deps = defn.depends_on or []
        in_degree[n.id] = len(deps)
        for dep in deps:
            dependents.setdefault(dep, []).append(n.id)

    layers: list[list[Node]] = []
    queue = [n for n in nodes if in_degree.get(n.id, 0) == 0]

    while queue:
        layers.append(queue)
        next_queue: list[Node] = []
        for n in queue:
            for dep_id in dependents.get(n.id, []):
                in_degree[dep_id] = in_degree.get(dep_id, 1) - 1
                if in_degree[dep_id] == 0:
                    next_queue.append(node_map[dep_id])
        queue = next_queue

    return layers
