import type { NodeDefinition, AgentToolDef, NodeContext } from '@flowforge/shared';

/**
 * Converts a NodeDefinition into an AgentToolDef that can be used in agent nodes.
 *
 * This is the key composability feature of FlowForge: any existing node can be
 * exposed as a tool for AI agents automatically. The agent can then invoke it
 * during its tool-calling loop, just like any hand-written tool.
 *
 * The converted tool preserves the original node's:
 * - description (used by the LLM to decide when to call it)
 * - inputSchema (used by the LLM for parameter generation)
 * - handler (the actual execution logic)
 */
export function nodeAsAgentTool(node: NodeDefinition): AgentToolDef {
  return {
    description: node.description,
    inputSchema: node.inputSchema,
    handler: async (ctx: NodeContext, input: unknown) => {
      // Build a context that matches what the node handler expects:
      // - Replace ctx.input with the tool invocation's input
      // - Use an empty config (agent tools don't have per-invocation config)
      const nodeCtx: NodeContext = {
        ...ctx,
        input,
        config: {},
      };
      return node.handler(nodeCtx);
    },
  };
}

/**
 * Converts multiple NodeDefinitions into a tools record suitable for
 * use with `defineAgentNode({ tools: ... })`.
 *
 * @param nodes  A map of tool names to their node definitions.
 *               The keys become the tool names visible to the agent.
 *
 * @example
 * ```ts
 * import { generateTextNode } from '@flowforge/nodes';
 * import { nodesToAgentTools } from '@flowforge/engine';
 *
 * const tools = nodesToAgentTools({
 *   'generate-text': generateTextNode,
 *   'fetch-data': myDataNode,
 * });
 *
 * const agent = defineAgentNode({
 *   name: 'my-agent',
 *   tools,
 *   // ...
 * });
 * ```
 */
export function nodesToAgentTools(
  nodes: Record<string, NodeDefinition>,
): Record<string, AgentToolDef> {
  const tools: Record<string, AgentToolDef> = {};
  for (const [name, node] of Object.entries(nodes)) {
    tools[name] = nodeAsAgentTool(node);
  }
  return tools;
}
