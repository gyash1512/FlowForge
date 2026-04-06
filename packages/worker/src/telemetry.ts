// ────────────────────────────────────────────────────────────────
// OpenTelemetry Setup
// ────────────────────────────────────────────────────────────────

import { NodeSDK } from '@opentelemetry/sdk-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { Resource } from '@opentelemetry/resources';
import { ATTR_SERVICE_NAME } from '@opentelemetry/semantic-conventions';
import { trace, SpanStatusCode } from '@opentelemetry/api';

export interface TelemetryOptions {
  serviceName?: string;
  exporterEndpoint?: string;
}

export interface Span {
  end(status: 'ok' | 'error', attrs?: Record<string, string>): void;
}

let sdkStarted = false;

/**
 * Initialise the OpenTelemetry SDK.
 */
export function initTelemetry(options?: TelemetryOptions): void {
  if (sdkStarted) return;

  const serviceName = options?.serviceName ?? 'flowforge-worker';

  const traceExporter = new OTLPTraceExporter({
    url: options?.exporterEndpoint ?? 'http://localhost:4318/v1/traces',
  });

  const sdk = new NodeSDK({
    resource: new Resource({ [ATTR_SERVICE_NAME]: serviceName }),
    traceExporter,
  });

  sdk.start();
  sdkStarted = true;
}

/**
 * Create a span wrapping a single node execution inside a run.
 *
 * Returns an object whose `end()` method closes the span with the given status.
 */
export function createNodeSpan(runId: string, stepName: string, nodeName: string): Span {
  const tracer = trace.getTracer('flowforge-worker');
  const otelSpan = tracer.startSpan(`node:${nodeName}`, {
    attributes: {
      'flowforge.run_id': runId,
      'flowforge.step_name': stepName,
      'flowforge.node_name': nodeName,
    },
  });

  return {
    end(status: 'ok' | 'error', attrs?: Record<string, string>) {
      if (attrs) {
        for (const [key, value] of Object.entries(attrs)) {
          otelSpan.setAttribute(key, value);
        }
      }

      if (status === 'error') {
        otelSpan.setStatus({ code: SpanStatusCode.ERROR });
      }

      otelSpan.end();
    },
  };
}
