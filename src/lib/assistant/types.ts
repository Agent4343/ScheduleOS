import type Anthropic from "@anthropic-ai/sdk"
import type { UserRole } from "@prisma/client"
import type { ZodType } from "zod"

/** Who the assistant is acting for. Every tool is scoped by this. */
export interface ToolContext {
  organizationId: string
  userId: string
  userRole: UserRole
  /** IANA timezone the organization runs in; "today" is computed in it. */
  timeZone: string
}

/**
 * One capability the model may call.
 *
 * `input` validates what the model sent before `run` sees it; `jsonSchema`
 * is what the model is shown. Keep the two in step (the registry test checks
 * every required JSON property is required by the Zod schema too).
 */
export interface AssistantTool<I = unknown> {
  name: string
  description: string
  input: ZodType<I>
  jsonSchema: Anthropic.Tool["input_schema"]
  /** Returns text for the model. Throw ServiceError for a user-facing failure. */
  run: (ctx: ToolContext, input: I) => Promise<string>
}

export function defineTool<I>(tool: AssistantTool<I>): AssistantTool<I> {
  return tool
}

export interface ToolCallRecord {
  name: string
  status: "success" | "error"
  result: string
}
