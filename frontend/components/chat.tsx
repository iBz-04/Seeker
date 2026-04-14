import { Message } from '@/lib/messages'
import { FragmentSchema } from '@/lib/schema'
import { ExecutionResult } from '@/lib/types'
import { DeepPartial } from 'ai'
import { LoaderIcon, Terminal, FileText, MoreHorizontal, Download, Share, Eye } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

export function Chat({
  messages,
  isLoading,
  setCurrentPreview,
}: {
  messages: Message[]
  isLoading: boolean
  setCurrentPreview: (preview: {
    fragment: DeepPartial<FragmentSchema> | undefined
    result: ExecutionResult | undefined
  }) => void
}) {
  const loadingStatuses = [
    "Reading requirements...",
    "Searching the web...",
    "Analyzing search results...",
    "Gathering learnings...",
    "Researching...",
    "Drafting content...",
  ];
  const [loadingText, setLoadingText] = useState(loadingStatuses[0]);

  useEffect(() => {
    if (isLoading) {
      let index = 0;
      setLoadingText(loadingStatuses[index]);
      const interval = setInterval(() => {
        index = (index + 1) % loadingStatuses.length;
        setLoadingText(loadingStatuses[index]);
      }, 3000);
      return () => clearInterval(interval);
    }
  }, [isLoading]);

  useEffect(() => {
    const chatContainer = document.getElementById('chat-container')
    if (chatContainer) {
      chatContainer.scrollTop = chatContainer.scrollHeight
    }
  }, [messages])

  return (
    <div
      id="chat-container"
      className="flex flex-col pb-12 gap-2 overflow-y-auto max-h-full"
    >
      {messages.map((message: Message, index: number) => (
        <div
          className={`flex flex-col px-4 shadow-sm whitespace-pre-wrap ${message.role !== 'user' ? 'bg-accent dark:bg-white/5 border text-accent-foreground dark:text-muted-foreground py-4 rounded-2xl gap-4 w-full' : 'bg-gradient-to-b from-black/5 to-black/10 dark:from-black/30 dark:to-black/50 py-2 rounded-xl gap-2 w-fit'} font-serif`}
          key={index}
        >
          {message.content.map((content, id) => {
            if (content.type === 'text') {
              return content.text
            }
            if (content.type === 'image') {
              return (
                <img
                  key={id}
                  src={content.image}
                  alt="fragment"
                  className="mr-2 inline-block w-12 h-12 object-cover rounded-lg bg-white mb-2"
                />
              )
            }
          })}
          {message.reportFile && (
            <div className="w-full md:w-[600px] mt-4 flex flex-col gap-2 rounded-xl dark:bg-[#1d1d1d] bg-white border dark:border-[#333] shadow-sm relative overflow-hidden font-sans">
              <div className="flex flex-row items-center justify-between p-3 border-b dark:border-[#333]">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded shrink-0 bg-blue-500/10 flex items-center justify-center">
                    <FileText className="text-blue-400 w-5 h-5 fill-blue-500/20" />
                  </div>
                  <span className="font-semibold text-base line-clamp-1">{message.reportFile.title}</span>
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-8 w-8 rounded-md text-muted-foreground outline-none focus-visible:ring-0">
                      <MoreHorizontal className="h-5 w-5" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-48 font-sans">
                    <DropdownMenuItem className="cursor-pointer">
                      <Eye className="mr-2 h-4 w-4" /> 
                      <span>Preview</span>
                    </DropdownMenuItem>
                    <DropdownMenuItem className="cursor-pointer">
                      <Share className="mr-2 h-4 w-4" /> 
                      <span>Share</span>
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      className="cursor-pointer"
                      onClick={() =>
                        window.open(
                          `/api/download?file=${message.reportFile?.mdPath}`,
                          '_blank'
                        )
                      }
                    >
                      <Download className="mr-2 h-4 w-4" />
                      <span>Download .md</span>
                    </DropdownMenuItem>
                    {message.reportFile.docxPath && (
                      <DropdownMenuItem
                        className="cursor-pointer"
                        onClick={() =>
                          window.open(
                            `/api/download?file=${message.reportFile?.docxPath}`,
                            '_blank'
                          )
                        }
                      >
                        <Download className="mr-2 h-4 w-4" />
                        <span>Download Word (.docx)</span>
                      </DropdownMenuItem>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
              {message.reportFile.previewText && (
                <div className="p-4 text-sm text-muted-foreground line-clamp-3">
                  <div className="font-semibold text-foreground mb-1 text-base">Introduction</div>
                  {message.reportFile.previewText.replace(/^#+.*$/m, '').trim()}
                </div>
              )}
              {message.reportFile.sources && message.reportFile.sources.length > 0 && (
                <div className="px-4 pb-4 flex flex-col gap-2">
                  <div className="text-sm font-semibold text-foreground flex items-center justify-between">
                    <span>Sources</span>
                    <span className="text-xs text-muted-foreground">
                      {message.reportFile.sources.length} link{message.reportFile.sources.length === 1 ? '' : 's'}
                    </span>
                  </div>
                  <div className="flex flex-col gap-1 text-sm text-muted-foreground">
                    {message.reportFile.sources.slice(0, 3).map((source) => (
                      <a
                        key={source}
                        href={source}
                        target="_blank"
                        rel="noreferrer"
                        className="truncate hover:text-foreground hover:underline"
                      >
                        {source}
                      </a>
                    ))}
                    {message.reportFile.sources.length > 3 && (
                      <span className="text-xs text-muted-foreground">
                        +{message.reportFile.sources.length - 3} more sources in the downloaded report
                      </span>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
          {message.object && (
            <div
              onClick={() =>
                setCurrentPreview({
                  fragment: message.object,
                  result: message.result,
                })
              }
              className="py-2 pl-2 w-full md:w-max flex items-center border rounded-xl select-none hover:bg-white dark:hover:bg-white/5 hover:cursor-pointer"
            >
              <div className="rounded-[0.5rem] w-10 h-10 bg-black/5 dark:bg-white/5 self-stretch flex items-center justify-center">
                <Terminal strokeWidth={2} className="text-[#FF8800]" />
              </div>
              <div className="pl-2 pr-4 flex flex-col">
                <span className="font-bold font-sans text-sm text-primary">
                  {message.object.title}
                </span>
                <span className="font-sans text-sm text-muted-foreground">
                  Click to see fragment
                </span>
              </div>
            </div>
          )}
        </div>
      ))}
      {isLoading && (
        <div className="flex items-center gap-1 text-sm text-muted-foreground animate-pulse transition-all">
          <LoaderIcon strokeWidth={2} className="animate-spin w-4 h-4" />
          <span>{loadingText}</span>
        </div>
      )}
    </div>
  )
}
