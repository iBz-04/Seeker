'use client'

import { AuthDialog } from '@/components/auth-dialog'
import { Chat } from '@/components/chat'
import { ChatInput } from '@/components/chat-input'
import { ChatPicker } from '@/components/chat-picker'
import { ChatSettings } from '@/components/chat-settings'
import { NavBar } from '@/components/navbar'
import { Preview } from '@/components/preview'
import { AuthViewType, useAuth } from '@/lib/auth'
import { Message, toAISDKMessages, toMessageImage } from '@/lib/messages'
import { LLMModelConfig } from '@/lib/models'
import modelsList from '@/lib/models.json'
import { FragmentSchema, fragmentSchema as schema } from '@/lib/schema'
import { supabase } from '@/lib/supabase'
import templates, { TemplateId } from '@/lib/templates'
import { ExecutionResult } from '@/lib/types'
import { DeepPartial } from 'ai'
import { experimental_useObject as useObject } from 'ai/react'
import { usePostHog } from 'posthog-js/react'
import { SetStateAction, useEffect, useState } from 'react'
import { useLocalStorage } from 'usehooks-ts'

export default function Home() {
  const [chatInput, setChatInput] = useLocalStorage('chat', '')
  const [files, setFiles] = useState<File[]>([])
  const [selectedTemplate, setSelectedTemplate] = useState<'auto' | TemplateId>(
    'auto',
  )
  const [languageModel, setLanguageModel] = useLocalStorage<LLMModelConfig>(
    'languageModel',
    {
      model: 'claude-3-5-sonnet-latest',
    },
  )

  const posthog = usePostHog()

  const [result, setResult] = useState<ExecutionResult>()
  const [messages, setMessages] = useState<Message[]>([])
  const [fragment, setFragment] = useState<DeepPartial<FragmentSchema>>()
  const [currentTab, setCurrentTab] = useState<'code' | 'fragment'>('code')
  const [isPreviewLoading, setIsPreviewLoading] = useState(false)
  const [isAuthDialogOpen, setAuthDialog] = useState(false)
  const [authView, setAuthView] = useState<AuthViewType>('sign_in')
  const [isRateLimited, setIsRateLimited] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const { session, userTeam } = useAuth(setAuthDialog, setAuthView)

  const filteredModels = modelsList.models.filter((model) => {
    if (process.env.NEXT_PUBLIC_HIDE_LOCAL_MODELS) {
      return model.providerId !== 'ollama'
    }
    return true
  })

  const currentModel = filteredModels.find(
    (model) => model.id === languageModel.model,
  )
  const currentTemplate =
    selectedTemplate === 'auto'
      ? templates
      : { [selectedTemplate]: templates[selectedTemplate] }
  const lastMessage = messages[messages.length - 1]

  const { object, submit, isLoading, stop, error } = useObject({
    api: '/api/chat',
    schema,
    onError: (error) => {
      console.error('Error submitting request:', error)
      if (error.message.includes('limit')) {
        setIsRateLimited(true)
      }

      setErrorMessage(error.message)
    },
    onFinish: async ({ object: fragment, error }) => {
      if (!error) {
        // Check if this is a conversational response
        if (fragment && fragment.responseText) {
          // Message is already added/updated by the useEffect hook
          // We just need to stop processing here
          return
        }

        // Proceed with fragment generation if it's not a conversational response
        if (fragment && fragment.code && fragment.template) {
          // send it to /api/sandbox
          console.log('fragment', fragment)
          setIsPreviewLoading(true)
          posthog.capture('fragment_generated', {
            template: fragment?.template,
          })

          const response = await fetch('/api/sandbox', {
            method: 'POST',
            body: JSON.stringify({
              fragment,
              userID: session?.user?.id,
              teamID: userTeam?.id,
              accessToken: session?.access_token,
            }),
          })

          const result = await response.json()
          console.log('result', result)
          posthog.capture('sandbox_created', { url: result.url })

          setResult(result)
          setCurrentPreview({ fragment, result })
          setCurrentTab('fragment')
          setIsPreviewLoading(false)
        }
      }
    },
  })

  useEffect(() => {
    if (object) {
      setFragment(object)

      let content: Message['content'] = []
      let isConversational = false

      // Handle conversational response
      if (object.responseText) {
        content = [{ type: 'text', text: object.responseText }]
        isConversational = true
      } 
      // Handle fragment generation response
      else if (object.commentary || object.code) {
        if (object.commentary) {
          content.push({ type: 'text', text: object.commentary })
        }
        if (object.code) {
          content.push({ type: 'code', text: object.code })
        }
      }

      // Use functional update to safely manage state transitions
      setMessages(prevMessages => {
        const currentLastMessage = prevMessages[prevMessages.length - 1];

        const messagePayload = {
          role: 'assistant' as const,
          content,
          object: isConversational ? undefined : object,
        }

        if (!currentLastMessage || currentLastMessage.role !== 'assistant') {
          // Add new message
          return [...prevMessages, messagePayload];
        } else {
          // Update last message
          const updatedMessages = [...prevMessages];
          updatedMessages[prevMessages.length - 1] = {
            ...currentLastMessage, // Preserve existing fields like result
            ...messagePayload, // Overwrite content and object
          };
          return updatedMessages;
        }
      });
    }
  }, [object, setFragment, setMessages])

  useEffect(() => {
    if (error) stop()
  }, [error])

  async function handleSubmitAuth(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()

    if (!session) {
      return setAuthDialog(true)
    }

    if (isLoading) {
      stop()
    }

    const content: Message['content'] = [{ type: 'text', text: chatInput }]
    const images = await toMessageImage(files)

    if (images.length > 0) {
      images.forEach((image) => {
        content.push({ type: 'image', image })
      })
    }

    // Add user message directly
    const userMessage: Message = { role: 'user', content }
    const updatedMessages = [...messages, userMessage]
    setMessages(updatedMessages)

    submit({
      userID: session?.user?.id,
      teamID: userTeam?.id,
      messages: toAISDKMessages(updatedMessages),
      template: currentTemplate,
      model: currentModel,
      config: languageModel,
    })

    setChatInput('')
    setFiles([])
    setCurrentTab('code')

    posthog.capture('chat_submit', {
      template: selectedTemplate,
      model: languageModel.model,
    })
  }

  function retry() {
    submit({
      userID: session?.user?.id,
      teamID: userTeam?.id,
      messages: toAISDKMessages(messages),
      template: currentTemplate,
      model: currentModel,
      config: languageModel,
    })
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

  function handleLanguageModelChange(e: LLMModelConfig) {
    setLanguageModel({ ...languageModel, ...e })
  }

  function handleSocialClick(target: 'github' | 'x' | 'discord') {
    if (target === 'github') {
      window.open('https://github.com/OmniS0FT', '_blank')
    } else if (target === 'x') {
      window.open('https://x.com/e2b_dev', '_blank')
    } else if (target === 'discord') {
      window.open('https://discord.gg/U7KEcGErtQ', '_blank')
    }

    posthog.capture(`${target}_click`)
  }

  function handleClearChat() {
    stop()
    setChatInput('')
    setFiles([])
    setMessages([])
    setFragment(undefined)
    setResult(undefined)
    setCurrentTab('code')
    setIsPreviewLoading(false)
  }

  function setCurrentPreview(preview: {
    fragment: DeepPartial<FragmentSchema> | undefined
    result: ExecutionResult | undefined
  }) {
    setFragment(preview.fragment)
    setResult(preview.result)
  }

  function handleUndo() {
    setMessages((previousMessages) => [...previousMessages.slice(0, -2)])
    setCurrentPreview({ fragment: undefined, result: undefined })
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
      <div className="grid w-full md:grid-cols-2">
        <div
          className={`flex flex-col w-full max-h-full max-w-[800px] mx-auto px-4 overflow-auto ${fragment ? 'col-span-1' : 'col-span-2'}`}
        >
          <NavBar
            session={session}
            showLogin={() => setAuthDialog(true)}
            signOut={logout}
            onSocialClick={handleSocialClick}
            onClear={handleClearChat}
            canClear={messages.length > 0}
            canUndo={messages.length > 1 && !isLoading}
            onUndo={handleUndo}
          />
          <Chat
            messages={messages}
            isLoading={isLoading}
            setCurrentPreview={setCurrentPreview}
          />
          <ChatInput
            retry={retry}
            isErrored={error !== undefined}
            errorMessage={errorMessage}
            isLoading={isLoading}
            isRateLimited={isRateLimited}
            stop={stop}
            input={chatInput}
            handleInputChange={handleSaveInputChange}
            handleSubmit={handleSubmitAuth}
            isMultiModal={currentModel?.multiModal || false}
            files={files}
            handleFileChange={handleFileChange}
          >
            <ChatPicker
              templates={templates}
              selectedTemplate={selectedTemplate}
              onSelectedTemplateChange={setSelectedTemplate}
              models={filteredModels}
              languageModel={languageModel}
              onLanguageModelChange={handleLanguageModelChange}
            />
            <ChatSettings
              languageModel={languageModel}
              onLanguageModelChange={handleLanguageModelChange}
              apiKeyConfigurable={!process.env.NEXT_PUBLIC_NO_API_KEY_INPUT}
              baseURLConfigurable={!process.env.NEXT_PUBLIC_NO_BASE_URL_INPUT}
            />
          </ChatInput>
        </div>
        <Preview
          teamID={userTeam?.id}
          accessToken={session?.access_token}
          selectedTab={currentTab}
          onSelectedTabChange={setCurrentTab}
          isChatLoading={isLoading}
          isPreviewLoading={isPreviewLoading}
          fragment={fragment}
          result={result as ExecutionResult}
          onClose={() => setFragment(undefined)}
        />
      </div>
    </main>
  )
}
