import Anthropic from "@anthropic-ai/sdk"
import { runTool, toAnthropicTools } from "./registry"
import type { ToolCallRecord, ToolContext } from "./types"

/** Model used for the assistant. Override with ASSISTANT_MODEL. */
export const ASSISTANT_MODEL = process.env.ASSISTANT_MODEL || "claude-sonnet-4-20250514"

/** Hard cap on model round-trips per user message. */
export const MAX_TOOL_ITERATIONS = 8

/** History sent to the model: the last N turns, each trimmed. */
export const HISTORY_TURNS = 10
export const MAX_TURN_CHARS = 4000

export interface AgentTurn {
  role: "user" | "assistant"
  content: string
}

export interface AgentResult {
  text: string
  toolCalls: ToolCallRecord[]
}

/**
 * Run one assistant turn: send the conversation, execute any tools the
 * model asks for, repeat until it answers in text or the iteration cap hits.
 */
export async function runAgent(input: {
  apiKey: string
  systemPrompt: string
  history: AgentTurn[]
  ctx: ToolContext
}): Promise<AgentResult> {
  const client = new Anthropic({ apiKey: input.apiKey })
  const tools = toAnthropicTools()

  const messages: Anthropic.MessageParam[] = input.history.slice(-HISTORY_TURNS).map((m) => ({
    role: m.role,
    content: m.content.length > MAX_TURN_CHARS ? m.content.slice(0, MAX_TURN_CHARS) + "…" : m.content,
  }))

  const toolCalls: ToolCallRecord[] = []
  let response = await client.messages.create({
    model: ASSISTANT_MODEL,
    max_tokens: 4096,
    system: input.systemPrompt,
    tools,
    messages,
  })

  let iterations = 0
  while (response.stop_reason === "tool_use") {
    if (++iterations > MAX_TOOL_ITERATIONS) {
      return {
        text: "I stopped before finishing: this request needed more steps than I am allowed to take in one go. Try splitting it into smaller requests.",
        toolCalls,
      }
    }

    const toolUses = response.content.filter(
      (block): block is Anthropic.ToolUseBlock => block.type === "tool_use"
    )

    const results: Anthropic.ToolResultBlockParam[] = []
    for (const use of toolUses) {
      const result = await runTool(use.name, use.input, input.ctx)
      toolCalls.push({ name: use.name, status: result.ok ? "success" : "error", result: result.text })
      results.push({
        type: "tool_result",
        tool_use_id: use.id,
        content: result.text,
        is_error: !result.ok,
      })
    }

    messages.push({ role: "assistant", content: response.content })
    messages.push({ role: "user", content: results })

    response = await client.messages.create({
      model: ASSISTANT_MODEL,
      max_tokens: 4096,
      system: input.systemPrompt,
      tools,
      messages,
    })
  }

  const text = response.content
    .filter((block): block is Anthropic.TextBlock => block.type === "text")
    .map((block) => block.text)
    .join("\n")
    .trim()

  return { text: text || "I couldn't generate a response. Please try again.", toolCalls }
}
