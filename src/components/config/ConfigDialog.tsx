import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { useSettingsStore } from '@/stores/settings-store'
import { useRecentFilesStore } from '@/stores/recent-files-store'
import { Dialog } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { verifyProvider, type VerifyResult } from '@/services/ai/verify'
import { MAX_RECENT_LIMIT } from '@/lib/recent-limit'
import type { ProviderKind } from '@/services/ai'
import type { ProviderSettings } from '@/types/settings'

interface ConfigDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

const kinds: { value: ProviderKind; label: string }[] = [
  { value: 'openai-compatible', label: 'OpenAI 兼容' },
  { value: 'google', label: 'Google Gemini' },
]

interface VerifyState {
  fingerprint: string
  running: boolean
  result: VerifyResult | null
}

function fingerprint(p: ProviderSettings): string {
  return JSON.stringify([p.kind, p.baseUrl.trim(), p.apiKey, p.model.trim()])
}

function verifyColor(r: VerifyResult): string {
  if (!r.ok) return 'text-red-600'
  if (r.status === 'ok') return 'text-green-600'
  return 'text-amber-600'
}

function genId(): string {
  return Math.random().toString(36).slice(2, 10)
}

export function ConfigDialog({ open, onOpenChange }: ConfigDialogProps) {
  const providers = useSettingsStore((s) => s.providers)
  const addProvider = useSettingsStore((s) => s.addProvider)
  const updateProvider = useSettingsStore((s) => s.updateProvider)
  const removeProvider = useSettingsStore((s) => s.removeProvider)
  const recentFilesLimit = useSettingsStore((s) => s.recentFilesLimit)
  const setRecentFilesLimit = useSettingsStore((s) => s.setRecentFilesLimit)
  const clearRecentFiles = useRecentFilesStore((s) => s.clearRecent)
  const trimRecentFiles = useRecentFilesStore((s) => s.trimTo)
  const [limitDraft, setLimitDraft] = useState(String(recentFilesLimit))
  const [draftKind, setDraftKind] = useState<ProviderKind>('openai-compatible')
  const [drafts, setDrafts] = useState<Record<string, ProviderSettings>>({})
  const [newDraft, setNewDraft] = useState<ProviderSettings | null>(null)
  const [verifies, setVerifies] = useState<Record<string, VerifyState>>({})

  useEffect(() => {
    if (open) setLimitDraft(String(useSettingsStore.getState().recentFilesLimit))
  }, [open])

  function onLimitChange(raw: string) {
    if (!/^\d{0,3}$/.test(raw)) return
    setLimitDraft(raw)
    const n = Number(raw)
    if (!raw || n < 1 || n > MAX_RECENT_LIMIT) return
    setRecentFilesLimit(n)
    trimRecentFiles(n)
  }

  function current(p: ProviderSettings): ProviderSettings {
    return drafts[p.id] ?? p
  }

  function isDirty(p: ProviderSettings): boolean {
    const d = drafts[p.id]
    return Boolean(d && fingerprint(d) !== fingerprint(p))
  }

  function patchDraft(p: ProviderSettings, patch: Partial<ProviderSettings>) {
    setDrafts((prev) => ({ ...prev, [p.id]: { ...current(p), ...patch } }))
  }

  function verified(key: string, value: ProviderSettings): boolean {
    const v = verifies[key]
    return Boolean(v && !v.running && v.result?.ok && v.fingerprint === fingerprint(value))
  }

  async function runVerify(key: string, value: ProviderSettings) {
    setVerifies((prev) => ({
      ...prev,
      [key]: { fingerprint: fingerprint(value), running: true, result: null },
    }))
    const result = await verifyProvider(value)
    setVerifies((prev) => ({
      ...prev,
      [key]: { fingerprint: fingerprint(value), running: false, result },
    }))
  }

  function clearDraft(id: string) {
    setDrafts((prev) => {
      const next = { ...prev }
      delete next[id]
      return next
    })
  }

  function clearVerify(key: string) {
    setVerifies((prev) => {
      const next = { ...prev }
      delete next[key]
      return next
    })
  }

  function saveExisting(p: ProviderSettings) {
    const d = drafts[p.id]
    if (!d || !verified(p.id, p)) return
    updateProvider(p.id, d)
    clearDraft(p.id)
  }

  function revert(p: ProviderSettings) {
    clearDraft(p.id)
    clearVerify(p.id)
  }

  function saveNew() {
    if (!newDraft || !verified('new', newDraft)) return
    addProvider(newDraft)
    setNewDraft(null)
    clearVerify('new')
  }

  function revertNew() {
    setNewDraft(null)
    clearVerify('new')
  }

  function startCreate() {
    if (newDraft) return
    setNewDraft({
      id: genId(),
      name: kinds.find((k) => k.value === draftKind)?.label ?? 'AI',
      kind: draftKind,
      baseUrl: '',
      apiKey: '',
      model: '',
    })
  }

  function remove(p: ProviderSettings) {
    removeProvider(p.id)
    clearDraft(p.id)
    clearVerify(p.id)
  }

  function fields(value: ProviderSettings, onChange: (patch: Partial<ProviderSettings>) => void) {
    return (
      <>
        <Input value={value.name} placeholder="名称" onChange={(e) => onChange({ name: e.target.value })} />
        <Input
          value={value.baseUrl}
          placeholder="API 地址（可选）"
          onChange={(e) => onChange({ baseUrl: e.target.value })}
        />
        <Input
          value={value.apiKey}
          placeholder="API Key"
          onChange={(e) => onChange({ apiKey: e.target.value })}
        />
        <div className="flex items-center gap-2">
          <select
            className="h-9 rounded-md border bg-transparent px-2 text-sm"
            value={value.kind}
            onChange={(e) => onChange({ kind: e.target.value as ProviderKind })}
          >
            {kinds.map((k) => (
              <option key={k.value} value={k.value}>
                {k.label}
              </option>
            ))}
          </select>
          <Input
            className="flex-1"
            value={value.model}
            placeholder="模型名称"
            onChange={(e) => onChange({ model: e.target.value })}
          />
        </div>
      </>
    )
  }

  function actions(
    key: string,
    value: ProviderSettings,
    opts: {
      dirty: boolean
      saveLabel: string
      onSave: () => void
      onRevert: () => void
      extra?: ReactNode
    },
  ) {
    const v = verifies[key]
    const busy = Boolean(v?.running)
    const canSave = opts.dirty && verified(key, value)
    return (
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            disabled={busy}
            onClick={() => void runVerify(key, value)}
          >
            {busy ? '验证中…' : '验证服务'}
          </Button>
          <Button size="sm" disabled={!canSave} onClick={opts.onSave}>
            {opts.saveLabel}
          </Button>
          {opts.dirty ? (
            <Button size="sm" variant="ghost" onClick={opts.onRevert}>
              放弃修改
            </Button>
          ) : null}
          {opts.extra}
          {!opts.dirty && !v?.result ? (
            <span className="text-xs text-muted-foreground">未修改</span>
          ) : null}
        </div>
        {v?.result ? (
          <p className={`text-xs ${verifyColor(v.result)}`}>{v.result.message}</p>
        ) : null}
        {opts.dirty && !canSave && !busy && !v?.result ? (
          <p className="text-xs text-muted-foreground">改动后需「验证服务」通过才能保存</p>
        ) : null}
      </div>
    )
  }

  return (
    <Dialog open={open} onClose={() => onOpenChange(false)} title="配置 AI 服务">
      <div className="flex flex-col gap-4">
        <p className="text-xs text-muted-foreground">
          新增或修改服务需先点「验证服务」确认连通且支持浏览器 CORS，通过后才能保存。
        </p>
        {providers.map((stored) => {
          const value = current(stored)
          const dirty = isDirty(stored)
          return (
            <div key={stored.id} className="flex flex-col gap-2 rounded-md border p-3">
              {fields(value, (patch) => patchDraft(stored, patch))}
              {actions(stored.id, value, {
                dirty,
                saveLabel: '保存',
                onSave: () => saveExisting(stored),
                onRevert: () => revert(stored),
                extra: (
                  <Button variant="destructive" size="sm" onClick={() => remove(stored)}>
                    删除
                  </Button>
                ),
              })}
            </div>
          )
        })}

        {newDraft ? (
          <div className="flex flex-col gap-2 rounded-md border border-primary/50 p-3">
            <p className="text-xs font-medium text-primary">新服务（未保存）</p>
            {fields(newDraft, (patch) =>
              setNewDraft((prev) => (prev ? { ...prev, ...patch } : prev)),
            )}
            {actions('new', newDraft, {
              dirty: true,
              saveLabel: '保存',
              onSave: saveNew,
              onRevert: revertNew,
            })}
          </div>
        ) : null}

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
          <Button size="sm" disabled={Boolean(newDraft)} onClick={startCreate}>
            添加服务
          </Button>
        </div>

        <div className="flex flex-col gap-2 rounded-md border border-border p-3">
          <p className="text-sm font-medium">最近打开文件</p>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">记录数量</span>
            <Input
              type="number"
              min={1}
              max={MAX_RECENT_LIMIT}
              className="w-24"
              value={limitDraft}
              onChange={(e) => onLimitChange(e.target.value)}
            />
            <span className="text-xs text-muted-foreground">
              条（1–{MAX_RECENT_LIMIT}，超出自动钳制）
            </span>
            <Button size="sm" variant="ghost" onClick={clearRecentFiles}>
              清空记录
            </Button>
          </div>
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
