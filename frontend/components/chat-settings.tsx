import { Button } from './ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from './ui/dropdown-menu'
import { Input } from './ui/input'
import { Label } from './ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './ui/select'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from './ui/tooltip'
import { Settings2 } from 'lucide-react'

export type ResearchSettings = {
  breadth: number
  depth: number
  mode: 'answer' | 'report'
}

export function ChatSettings({
  settings,
  onSettingsChange,
}: {
  settings: ResearchSettings
  onSettingsChange: (settings: ResearchSettings) => void
}) {
  return (
    <DropdownMenu>
      <TooltipProvider>
        <Tooltip delayDuration={0}>
          <TooltipTrigger asChild>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="text-muted-foreground h-6 w-6 rounded-sm">
                <Settings2 className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
          </TooltipTrigger>
          <TooltipContent>Research settings</TooltipContent>
        </Tooltip>
      </TooltipProvider>
      <DropdownMenuContent align="start" className="w-64">
        <div className="flex flex-col gap-2 px-2 py-2">
          <Label htmlFor="research-mode">Output</Label>
          <Select
            value={settings.mode}
            onValueChange={(value: 'answer' | 'report') =>
              onSettingsChange({
                ...settings,
                mode: value,
              })
            }
          >
            <SelectTrigger id="research-mode">
              <SelectValue placeholder="Choose output type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="answer">Short answer</SelectItem>
              <SelectItem value="report">Full report</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <DropdownMenuSeparator />
        <div className="flex flex-col gap-2 px-2 py-2">
          <Label htmlFor="research-breadth">Breadth</Label>
          <Input
            id="research-breadth"
            type="number"
            min={1}
            max={10}
            step={1}
            value={settings.breadth}
            onChange={(e) =>
              onSettingsChange({
                ...settings,
                breadth: Math.min(10, Math.max(1, Number(e.target.value) || 1)),
              })
            }
          />
          <p className="text-xs text-muted-foreground">
            Higher breadth explores more search branches.
          </p>
        </div>
        <DropdownMenuSeparator />
        <div className="flex flex-col gap-2 px-2 py-2">
          <Label htmlFor="research-depth">Depth</Label>
          <Input
            id="research-depth"
            type="number"
            min={1}
            max={5}
            step={1}
            value={settings.depth}
            onChange={(e) =>
              onSettingsChange({
                ...settings,
                depth: Math.min(5, Math.max(1, Number(e.target.value) || 1)),
              })
            }
          />
          <p className="text-xs text-muted-foreground">
            Higher depth follows results further before finalizing.
          </p>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
