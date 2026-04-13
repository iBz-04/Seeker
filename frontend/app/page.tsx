'use client'

import { AuthDialog } from '@/components/auth-dialog'
import { Chat } from '@/components/chat'
import { ChatInput } from '@/components/chat-input'
import {
  ChatSettings,
  ResearchSettings,
} from '@/components/chat-settings'
import { NavBar } from '@/components/navbar'
import { AuthViewType, useAuth } from '@/lib/auth'
import { Message } from '@/lib/messages'
import { supabase } from '@/lib/supabase'
import { usePostHog } from 'posthog-js/react'
import { SetStateAction, useEffect, useRef, useState } from 'react'
import { useLocalStorage } from 'usehooks-ts'

type ResearchResponse = {
  success: boolean
  mode: 'answer' | 'report'
  content: string
  learnings?: string[]
  visitedUrls?: string[]
  mdPath?: string
  docxPath?: string
  error?: string
}

const defaultResearchSettings: ResearchSettings = {
  breadth: 3,
  depth: 2,
  mode: 'answer',
}

function extractMessageText(message: Message) {
  return message.content
    .filter((content) => content.type === 'text')
    .map((content) => content.text)
    .join('\n')
    .trim()
}

function formatResearchResponse(result: ResearchResponse) {
  const sections = [result.content?.trim() ?? '']

  if (result.mode !== 'report' && result.learnings && result.learnings.length > 0) {
    sections.push(
      `Learnings:\n${result.learnings.map((learning) => `- ${learning}`).join('\n')}`,
    )
  }

  if (
    result.mode !== 'report' &&
    result.visitedUrls &&
    result.visitedUrls.length > 0
  ) {
    sections.push(
      `Sources:\n${result.visitedUrls.map((url) => `- ${url}`).join('\n')}`,
    )
  }

  const savedFiles = [result.mdPath, result.docxPath].filter(Boolean)
  if (savedFiles.length > 0) {
    sections.push(`Saved files:\n${savedFiles.map((path) => `- ${path}`).join('\n')}`)
  }

  return sections.filter(Boolean).join('\n\n').trim()
}

export default function Home() {
  const [chatInput, setChatInput] = useLocalStorage('chat', '')
  const [researchSettings, setResearchSettings] =
    useLocalStorage<ResearchSettings>('researchSettings', defaultResearchSettings)
  const [files, setFiles] = useState<File[]>([])
  const [messages, setMessages] = useState<Message[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [isHydrated, setIsHydrated] = useState(false)
  const [isAuthDialogOpen, setAuthDialog] = useState(false)
  const [authView, setAuthView] = useState<AuthViewType>('sign_in')
  const [isRateLimited, setIsRateLimited] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const abortControllerRef = useRef<AbortController | null>(null)
  const lastRequestRef = useRef<{
    query: string
    settings: ResearchSettings
  } | null>(null)
  const { session } = useAuth(setAuthDialog, setAuthView)
  const posthog = usePostHog()
  const activeChatInput = isHydrated ? chatInput : ''
  const activeResearchSettings = isHydrated
    ? researchSettings
    : defaultResearchSettings

  useEffect(() => {
    setIsHydrated(true)
  }, [])

  async function runResearch(query: string, settings: ResearchSettings) {
    abortControllerRef.current?.abort()

    const controller = new AbortController()
    abortControllerRef.current = controller

    setIsLoading(true)
    setErrorMessage('')
    setIsRateLimited(false)

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query,
          breadth: settings.breadth,
          depth: settings.depth,
          mode: settings.mode,
        }),
        signal: controller.signal,
      })

      const result = (await response.json()) as ResearchResponse

      if (!response.ok) {
        if (response.status === 429) {
          setIsRateLimited(true)
        }

        throw new Error(result.error || 'Research request failed.')
      }

      const assistantMessage: Message = {
        role: 'assistant',
        content: [{ type: 'text', text: formatResearchResponse(result) }],
      }

      setMessages((currentMessages) => [...currentMessages, assistantMessage])

      posthog.capture('research_completed', {
        mode: settings.mode,
        breadth: settings.breadth,
        depth: settings.depth,
      })
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        return
      }

      setErrorMessage(
        error instanceof Error ? error.message : 'Research request failed.',
      )
    } finally {
      if (abortControllerRef.current === controller) {
        abortControllerRef.current = null
      }
      setIsLoading(false)
    }
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()

    const query = activeChatInput.trim()
    if (!query) {
      return
    }

    if (isLoading) {
      abortControllerRef.current?.abort()
    }

    const userMessage: Message = {
      role: 'user',
      content: [{ type: 'text', text: query }],
    }

    setMessages((currentMessages) => [...currentMessages, userMessage])
    lastRequestRef.current = {
      query,
      settings: activeResearchSettings,
    }

    setChatInput('')
    setFiles([])

    posthog.capture('research_submit', {
      mode: activeResearchSettings.mode,
      breadth: activeResearchSettings.breadth,
      depth: activeResearchSettings.depth,
    })

    await runResearch(query, activeResearchSettings)
  }

  async function retry() {
    const previousRequest = lastRequestRef.current

    if (!previousRequest || isLoading) {
      return
    }

    await runResearch(previousRequest.query, previousRequest.settings)
  }

  function stop() {
    abortControllerRef.current?.abort()
    setIsLoading(false)
  }

  function handleSaveInputChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    setChatInput(e.target.value)
  }

  function handleFileChange(change: SetStateAction<File[]>) {
    setFiles(change)
  }

  function logout() {
    supabase
      ? supabase.auth.signOut()
      : console.warn('Supabase is not initialized')
  }

  function handleSocialClick(target: 'github' | 'x' | 'discord') {
    if (target === 'github') {
      window.open('https://github.com/iBz-04/Seeker', '_blank')
      return
    }

    if (target === 'x') {
      window.open('https://x.com/e2b_dev', '_blank')
      return
    }

    window.open('https://discord.gg/U7KEcGErtQ', '_blank')
  }

  function handleClearChat() {
    stop()
    setChatInput('')
    setFiles([])
    setMessages([])
    setErrorMessage('')
    setIsRateLimited(false)
    lastRequestRef.current = null
  }

  function handleUndo() {
    stop()

    setMessages((currentMessages) => {
      const updatedMessages = [...currentMessages]

      if (
        updatedMessages.length > 0 &&
        updatedMessages[updatedMessages.length - 1].role === 'assistant'
      ) {
        updatedMessages.pop()
      }

      if (
        updatedMessages.length > 0 &&
        updatedMessages[updatedMessages.length - 1].role === 'user'
      ) {
        const removedMessage = updatedMessages.pop()
        if (removedMessage) {
          setChatInput(extractMessageText(removedMessage))
        }
      }

      return updatedMessages
    })
  }

  return (
    <main className="flex min-h-screen max-h-screen">
      {supabase && (
        <AuthDialog
          open={isAuthDialogOpen}
          setOpen={setAuthDialog}
          view={authView}
          supabase={supabase}
        />
      )}
      <div className="flex w-full">
        <div className="flex flex-col w-full max-h-full max-w-[800px] mx-auto px-4 overflow-auto">
          <NavBar
            session={session}
            showLogin={() => setAuthDialog(true)}
            signOut={logout}
            onSocialClick={handleSocialClick}
            onClear={handleClearChat}
            canClear={messages.length > 0 || activeChatInput.length > 0}
            canUndo={messages.length > 0 && !isLoading}
            onUndo={handleUndo}
          />
          <Chat messages={messages} isLoading={isLoading} setCurrentPreview={() => {}} />
          <ChatInput
            retry={retry}
            isErrored={errorMessage.length > 0}
            errorMessage={errorMessage}
            isLoading={isLoading}
            isRateLimited={isRateLimited}
            stop={stop}
            input={activeChatInput}
            handleInputChange={handleSaveInputChange}
            handleSubmit={handleSubmit}
            isMultiModal={false}
            files={files}
            handleFileChange={handleFileChange}
          >
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span className="rounded-full border px-2 py-1">
                {activeResearchSettings.mode === 'report' ? 'Full report' : 'Short answer'}
              </span>
              <span>
                Breadth {activeResearchSettings.breadth} · Depth {activeResearchSettings.depth}
              </span>
            </div>
            <ChatSettings
              settings={activeResearchSettings}
              onSettingsChange={(settings) => setResearchSettings(settings)}
            />
          </ChatInput>
        </div>
      </div>
    </main>
  )
}
