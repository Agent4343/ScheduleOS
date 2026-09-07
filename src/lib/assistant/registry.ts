import type Anthropic from "@anthropic-ai/sdk"
import { ZodError } from "zod"
import { ServiceError } from "@/lib/services/errors"
import type { AssistantTool, ToolContext } from "./types"
import { getSchedules, updateSchedule, bulkUpdateSchedules, swapShiftsTool } from "./tools/schedules"
import { getWorkers, getWorkerByName, updateWorkerTool, getCrews } from "./tools/workers"
import { getTimeOffRequests, updateTimeOffRequest } from "./tools/time-off"
import { getTodaySummary, getWeekSummary } from "./tools/summaries"
import { getStaffingRules, checkStaffingGaps } from "./tools/staffing"

/** Every tool the assistant can use, in the order the model sees them. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const assistantTools: AssistantTool<any>[] = [
  getSchedules,
  updateSchedule,
  bulkUpdateSchedules,
  swapShiftsTool,
  getWorkers,
  getWorkerByName,
  updateWorkerTool,
  getCrews,
  getTimeOffRequests,
  updateTimeOffRequest,
  getTodaySummary,
  getWeekSummary,
  getStaffingRules,
  checkStaffingGaps,
]

const byName = new Map(assistantTools.map((t) => [t.name, t]))

/** The tool list in the shape the Anthropic SDK expects. */
export function toAnthropicTools(): Anthropic.Tool[] {
  return assistantTools.map((t) => ({
    name: t.name,
    description: t.description,
    input_schema: t.jsonSchema,
  }))
}

export interface ToolRunResult {
  ok: boolean
  text: string
}

/**
 * Validate the model's input and run the tool. Never throws: failures come
 * back as `{ ok: false, text }` so the model can read them and recover.
 */
export async function runTool(name: string, rawInput: unknown, ctx: ToolContext): Promise<ToolRunResult> {
  const tool = byName.get(name)
  if (!tool) return { ok: false, text: `Unknown tool: ${name}` }

  try {
    const input = tool.input.parse(rawInput ?? {})
    const text = await tool.run(ctx, input)
    return { ok: true, text }
  } catch (error) {
    if (error instanceof ZodError) {
      const issues = error.issues.map((i) => `${i.path.join(".") || "input"}: ${i.message}`).join("; ")
      return { ok: false, text: `Invalid input for ${name}: ${issues}` }
    }
    if (error instanceof ServiceError) {
      return { ok: false, text: error.message }
    }
    console.error(`Tool ${name} failed:`, error)
    return { ok: false, text: `${name} failed unexpectedly. Tell the user the action did not go through.` }
  }
}
