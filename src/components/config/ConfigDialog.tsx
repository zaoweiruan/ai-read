import { useState } from 'react'
import { useSettingsStore } from '@/stores/settings-store'
import { Dialog } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import type { ProviderKind } from '@/services/ai'

interface ConfigDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

const kinds: { value: ProviderKind; label: string }[] = [
  { value: 'openai-compatible', label: 'OpenAI 兼容' },
  { value: 'google', label: 'Google Gemini' },
]

export function ConfigDialog({ open, onOpenChange }: ConfigDialogProps) {
  const providers = useSettingsStore((s) => s.providers)
  const addProvider = useSettingsStore((s) => s.addProvider)
  const updateProvider = useSettingsStore((s) => s.updateProvider)
  const removeProvider = useSettingsStore((s) => s.removeProvider)
  const [draftKind, setDraftKind] = useState<ProviderKind>('openai-compatible')

  return (
    <Dialog open={open} onClose={() => onOpenChange(false)} title="配置 AI 服务">
      <div className="flex flex-col gap-4">
        {providers.map((p) => (
          <div key={p.id} className="flex flex-col gap-2 rounded-md border p-3">
            <Input
              value={p.name}
              placeholder="名称"
              onChange={(e) => updateProvider(p.id, { name: e.target.value })}
            />
            <Input
              value={p.baseUrl}
              placeholder="API 地址（可选）"
              onChange={(e) => updateProvider(p.id, { baseUrl: e.target.value })}
            />
            <Input
              value={p.apiKey}
              placeholder="API Key"
              onChange={(e) => updateProvider(p.id, { apiKey: e.target.value })}
            />
            <div className="flex items-center gap-2">
              <select
                className="h-9 rounded-md border bg-transparent px-2 text-sm"
                value={p.kind}
                onChange={(e) => updateProvider(p.id, { kind: e.target.value as ProviderKind })}
              >
                {kinds.map((k) => (
                  <option key={k.value} value={k.value}>
                    {k.label}
                  </option>
                ))}
              </select>
              <Input
                className="flex-1"
                value={p.model}
                placeholder="模型名称"
                onChange={(e) => updateProvider(p.id, { model: e.target.value })}
              />
            </div>
            <Button variant="destructive" size="sm" onClick={() => removeProvider(p.id)}>
              删除
            </Button>
          </div>
        ))}

        <div className="flex items-end gap-2">
          <select
            className="h-9 rounded-md border bg-transparent px-2 text-sm"
            value={draftKind}
            onChange={(e) => setDraftKind(e.target.value as ProviderKind)}
          >
            {kinds.map((k) => (
              <option key={k.value} value={k.value}>
                {k.label}
              </option>
            ))}
          </select>
          <Button
            size="sm"
            onClick={() =>
              addProvider({
                id: Math.random().toString(36).slice(2, 10),
                name: kinds.find((k) => k.value === draftKind)?.label ?? 'AI',
                kind: draftKind,
                baseUrl: '',
                apiKey: '',
                model: '',
              })
            }
          >
            添加服务
          </Button>
        </div>

        <div className="flex justify-end">
          <Button size="sm" onClick={() => onOpenChange(false)}>
            完成
          </Button>
        </div>
      </div>
    </Dialog>
  )
}