"use client"

import { useState, useRef, useEffect } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import {
  Bot,
  Send,
  Loader2,
  Calendar,
  Users,
  Clock,
  AlertCircle,
  CheckCircle,
  Sparkles,
  Trash2,
  Plus,
  MessageSquare,
  ChevronLeft,
} from "lucide-react"
import { cn } from "@/lib/utils"

interface Message {
  id: string
  role: "user" | "assistant"
  content: string
  timestamp: Date
  toolCalls?: ToolCall[]
}

interface ToolCall {
  name: string
  status: "pending" | "success" | "error"
  result?: string
}

interface ChatSession {
  id: string
  title: string | null
  createdAt: string
  updatedAt: string
  messages?: { content: string; role: string }[]
}

const SUGGESTED_PROMPTS = [
  { icon: Calendar, text: "Show me today's schedule", color: "text-green-500" },
  { icon: Users, text: "Who is working this week?", color: "text-blue-500" },
  { icon: Clock, text: "Change John's shift to night on Friday", color: "text-purple-500" },
  { icon: AlertCircle, text: "Show pending time off requests", color: "text-orange-500" },
]

export default function AssistantPage() {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sessions, setSessions] = useState<ChatSession[]>([])
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null)
  const [showSidebar, setShowSidebar] = useState(true)
  const [loadingSessions, setLoadingSessions] = useState(true)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  // Load sessions on mount
  useEffect(() => {
    loadSessions()
  }, [])

  const loadSessions = async () => {
    try {
      setLoadingSessions(true)
      const response = await fetch("/api/assistant/sessions")
      if (response.ok) {
        const data = await response.json()
        setSessions(data)
      }
    } catch (err) {
      console.error("Error loading sessions:", err)
    } finally {
      setLoadingSessions(false)
    }
  }

  const loadSession = async (sessionId: string) => {
    try {
      setIsLoading(true)
      const response = await fetch(`/api/assistant/sessions/${sessionId}`)
      if (response.ok) {
        const data = await response.json()
        setCurrentSessionId(sessionId)
        setMessages(
          data.messages.map((m: { id: string; role: string; content: string; createdAt: string; toolCalls?: ToolCall[] }) => ({
            id: m.id,
            role: m.role as "user" | "assistant",
            content: m.content,
            timestamp: new Date(m.createdAt),
            toolCalls: m.toolCalls,
          }))
        )
      }
    } catch (err) {
      console.error("Error loading session:", err)
    } finally {
      setIsLoading(false)
    }
  }

  const deleteSession = async (sessionId: string) => {
    try {
      const response = await fetch(`/api/assistant/sessions/${sessionId}`, {
        method: "DELETE",
      })
      if (response.ok) {
        setSessions((prev) => prev.filter((s) => s.id !== sessionId))
        if (currentSessionId === sessionId) {
          startNewChat()
        }
      }
    } catch (err) {
      console.error("Error deleting session:", err)
    }
  }

  const startNewChat = () => {
    setCurrentSessionId(null)
    setMessages([])
    setError(null)
  }

  const sendMessage = async (content: string) => {
    if (!content.trim() || isLoading) return

    const userMessage: Message = {
      id: crypto.randomUUID(),
      role: "user",
      content: content.trim(),
      timestamp: new Date(),
    }

    setMessages((prev) => [...prev, userMessage])
    setInput("")
    setIsLoading(true)
    setError(null)

    try {
      const response = await fetch("/api/assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // History comes from the stored session on the server; only the new
        // message and the session id are sent.
        body: JSON.stringify({
          sessionId: currentSessionId,
          userMessage: content.trim(),
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Failed to get response")
      }

      // Update session ID if a new one was created
      if (data.sessionId && !currentSessionId) {
        setCurrentSessionId(data.sessionId)
        // Refresh sessions list
        loadSessions()
      }

      const assistantMessage: Message = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: data.content,
        timestamp: new Date(),
        toolCalls: data.toolCalls,
      }

      setMessages((prev) => [...prev, assistantMessage])
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong")
    } finally {
      setIsLoading(false)
      inputRef.current?.focus()
    }
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    sendMessage(input)
  }

  const handleSuggestedPrompt = (prompt: string) => {
    sendMessage(prompt)
  }

  return (
    <div className="flex h-[calc(100vh-8rem)]">
      {/* Sidebar - Chat History */}
      {showSidebar && (
        <div className="w-64 border-r flex flex-col bg-muted/30 mr-4 rounded-lg">
          <div className="p-3 border-b">
            <Button
              onClick={startNewChat}
              className="w-full justify-start gap-2"
              variant="outline"
            >
              <Plus className="h-4 w-4" />
              New Chat
            </Button>
          </div>
          <div className="flex-1 overflow-y-auto p-2 space-y-1">
            {loadingSessions ? (
              <div className="flex justify-center p-4">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : sessions.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center p-4">
                No conversations yet
              </p>
            ) : (
              sessions.map((session) => (
                <div
                  key={session.id}
                  className={cn(
                    "group flex items-center gap-2 p-2 rounded-md cursor-pointer hover:bg-muted transition-colors",
                    currentSessionId === session.id && "bg-muted"
                  )}
                  onClick={() => loadSession(session.id)}
                >
                  <MessageSquare className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                  <span className="text-sm truncate flex-1">
                    {session.title || "New conversation"}
                  </span>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 opacity-0 group-hover:opacity-100"
                    onClick={(e) => {
                      e.stopPropagation()
                      deleteSession(session.id)
                    }}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col">
        {/* Header */}
        <div className="mb-4">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              className="md:hidden"
              onClick={() => setShowSidebar(!showSidebar)}
            >
              <ChevronLeft className={cn("h-5 w-5 transition-transform", !showSidebar && "rotate-180")} />
            </Button>
            <div className="p-2 bg-primary/10 rounded-lg">
              <Bot className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">AI Assistant</h1>
              <p className="text-muted-foreground text-sm">
                Ask me anything about schedules, workers, time off, and more
              </p>
            </div>
            <div className="ml-auto flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowSidebar(!showSidebar)}
                className="hidden md:flex"
              >
                <MessageSquare className="h-4 w-4 mr-1" />
                History
              </Button>
              <Badge variant="secondary">
                <Sparkles className="h-3 w-3 mr-1" />
                Beta
              </Badge>
            </div>
          </div>
        </div>

        {/* Chat Area */}
        <Card className="flex-1 flex flex-col overflow-hidden">
          <CardContent className="flex-1 overflow-y-auto p-4 space-y-4">
            {messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center">
                <Bot className="h-16 w-16 text-muted-foreground/30 mb-4" />
                <h3 className="text-lg font-medium mb-2">How can I help you today?</h3>
                <p className="text-muted-foreground text-sm mb-6 max-w-md">
                  I can help you manage schedules, view worker information, handle time off requests,
                  and more. Your conversations are saved automatically.
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-w-2xl">
                  {SUGGESTED_PROMPTS.map((prompt, i) => (
                    <button
                      key={i}
                      onClick={() => handleSuggestedPrompt(prompt.text)}
                      className="flex items-center gap-3 p-3 rounded-lg border bg-card hover:bg-accent transition-colors text-left"
                    >
                      <prompt.icon className={cn("h-5 w-5", prompt.color)} />
                      <span className="text-sm">{prompt.text}</span>
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <>
                {messages.map((message) => (
                  <div
                    key={message.id}
                    className={cn(
                      "flex gap-3",
                      message.role === "user" ? "justify-end" : "justify-start"
                    )}
                  >
                    {message.role === "assistant" && (
                      <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                        <Bot className="h-4 w-4 text-primary" />
                      </div>
                    )}
                    <div
                      className={cn(
                        "max-w-[80%] rounded-lg p-3",
                        message.role === "user"
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted"
                      )}
                    >
                      <div className="whitespace-pre-wrap text-sm">{message.content}</div>
                      {message.toolCalls && message.toolCalls.length > 0 && (
                        <div className="mt-2 pt-2 border-t border-border/50 space-y-1">
                          {message.toolCalls.map((tool, i) => (
                            <div
                              key={i}
                              className="flex items-center gap-2 text-xs text-muted-foreground"
                            >
                              {tool.status === "success" ? (
                                <CheckCircle className="h-3 w-3 text-green-500" />
                              ) : tool.status === "error" ? (
                                <AlertCircle className="h-3 w-3 text-red-500" />
                              ) : (
                                <Loader2 className="h-3 w-3 animate-spin" />
                              )}
                              <span>{tool.name}</span>
                            </div>
                          ))}
                        </div>
                      )}
                      <div className="text-xs text-muted-foreground/70 mt-1">
                        {message.timestamp.toLocaleTimeString()}
                      </div>
                    </div>
                    {message.role === "user" && (
                      <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center flex-shrink-0">
                        <span className="text-xs font-medium text-primary-foreground">You</span>
                      </div>
                    )}
                  </div>
                ))}
                {isLoading && (
                  <div className="flex gap-3">
                    <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                      <Bot className="h-4 w-4 text-primary" />
                    </div>
                    <div className="bg-muted rounded-lg p-3">
                      <Loader2 className="h-4 w-4 animate-spin" />
                    </div>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </>
            )}
          </CardContent>

          {/* Error Display */}
          {error && (
            <div className="px-4 py-2 bg-destructive/10 text-destructive text-sm flex items-center gap-2">
              <AlertCircle className="h-4 w-4" />
              {error}
            </div>
          )}

          {/* Input Area */}
          <div className="p-4 border-t">
            <form onSubmit={handleSubmit} className="flex gap-2">
              <Input
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ask me anything..."
                disabled={isLoading}
                className="flex-1"
              />
              <Button type="submit" disabled={isLoading || !input.trim()}>
                {isLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
              </Button>
            </form>
            <p className="text-xs text-muted-foreground mt-2 text-center">
              Conversations are saved automatically. AI assistant can make mistakes.
            </p>
          </div>
        </Card>
      </div>
    </div>
  )
}
