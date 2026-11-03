import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { useSettingsStore } from '@/stores/settings-store'
import { useRecentFilesStore } from '@/stores/recent-files-store'
import { Dialog } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { verifyProvider, type VerifyResult } from '@/services/ai/verify'
import { verifyFreeTranslate } from '@/services/translate'
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
  const translation = useSettingsStore((s) => s.translation)
  const setTranslation = useSettingsStore((s) => s.setTranslation)
  const clearRecentFiles = useRecentFilesStore((s) => s.clearRecent)
  const trimRecentFiles = useRecentFilesStore((s) => s.trimTo)
  const [limitDraft, setLimitDraft] = useState(String(recentFilesLimit))
  const [draftKind, setDraftKind] = useState<ProviderKind>('openai-compatible')
  const [drafts, setDrafts] = useState<Record<string, ProviderSettings>>({})
  const [newDraft, setNewDraft] = useState<ProviderSettings | null>(null)
  const [verifies, setVerifies] = useState<Record<string, VerifyState>>({})
const [freeTest, setFreeTest] = useState<{ running: boolean; result: { ok: boolean; message: string } | null }>({
  running: false,
  result: null,
})

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
    if (!d) return
    updateProvider(p.id, d)
    clearDraft(p.id)
    clearVerify(p.id)
  }

  function revert(p: ProviderSettings) {
    clearDraft(p.id)
    clearVerify(p.id)
  }

  function saveNew() {
    if (!newDraft) return
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
    const passed = verified(key, value)
    const canSave = opts.dirty
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
          <div className="flex flex-col gap-0.5">
            <p className={`text-xs ${verifyColor(v.result)}`}>{v.result.message}</p>
            {!v.result.ok ? (
              <p className="text-xs text-muted-foreground">配置仍可保存，但实际请求会被浏览器拦截</p>
            ) : null}
          </div>
        ) : null}
        {opts.dirty && !passed && !busy && !v?.result ? (
          <p className="text-xs text-muted-foreground">
            未验证也可直接保存；建议先「验证服务」确认连通与 CORS
          </p>
        ) : null}
      </div>
    )
  }

  return (
    <Dialog open={open} onClose={() => onOpenChange(false)} title="配置 AI 服务">
      <div className="flex flex-col gap-4">
        <p className="text-xs text-muted-foreground">
          「验证服务」用于确认端点连通性与浏览器 CORS 支持情况，结果仅供参考；未通过也可直接保存。
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
          <p className="text-sm font-medium">翻译端点</p>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">方式</span>
            <select
              className="h-9 rounded-md border bg-transparent px-2 text-sm"
              value={translation.mode}
              onChange={(e) =>
                setTranslation({ mode: e.target.value as 'ai' | 'mymemory' | 'lara' | 'google' })
              }
            >
              <option value="mymemory">MyMemory 免费端点（无需 Key）</option>
              <option value="lara">Lara 翻译 API（需 Access Key）</option>
              <option value="google">Google 免费端点（无需 Key）</option>
              <option value="ai">使用已配置的 AI 提供商</option>
            </select>
          </div>
          {translation.mode === 'lara' ? (
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">Access Key ID</span>
                <Input
                  className="w-48"
                  value={translation.laraAccessKeyId}
                  onChange={(e) => setTranslation({ laraAccessKeyId: e.target.value })}
                  placeholder="Access Key ID"
                />
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">Access Key Secret</span>
                <Input
                  className="w-48"
                  type="password"
                  value={translation.laraAccessKeySecret}
                  onChange={(e) => setTranslation({ laraAccessKeySecret: e.target.value })}
                  placeholder="Access Key Secret"
                />
              </div>
            </div>
          ) : null}
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">源语言</span>
            <Input
              className="w-24"
              value={translation.sourceLang}
              onChange={(e) => setTranslation({ sourceLang: e.target.value })}
              placeholder="en"
            />
            <span className="text-xs text-muted-foreground">→ 目标语言</span>
            <Input
              className="w-24"
              value={translation.targetLang}
              onChange={(e) => setTranslation({ targetLang: e.target.value })}
              placeholder="zh-CN"
            />
          </div>
          <p className="text-xs text-muted-foreground">
            MyMemory 要求显式指定源语言（不支持 auto），默认 en → zh-CN。Google 端点需浏览器可直连 translate.googleapis.com；无法访问时请把浏览器/系统代理或扩展（如 SwitchyOmega）指向 127.0.0.1:10808 放行该域名。本应用请求始终直连，不内置代理。任一免费端点失败时自动回落到另一个免费端点，再回落 AI 提供商。
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={translation.mode === 'ai' || freeTest.running}
              onClick={async () => {
                setFreeTest({ running: true, result: null });
                let r: { ok: boolean; message: string };
                if (translation.mode === 'lara') {
                  const { verifyLara } = await import('@/services/lara');
                  r = await verifyLara(
                    translation.laraAccessKeyId,
                    translation.laraAccessKeySecret,
                    translation.sourceLang,
                    translation.targetLang,
                  );
                } else {
                  r = await verifyFreeTranslate(
                    translation.mode as 'mymemory' | 'google',
                    translation.sourceLang,
                    translation.targetLang,
                  );
                }
                setFreeTest({ running: false, result: r });
              }}
            >
              {freeTest.running ? '测试中…' : '测试端点'}
            </Button>
            {freeTest.result ? (
              <span
                className={`text-xs ${freeTest.result.ok ? 'text-green-600' : 'text-red-600'}`}
              >
                {freeTest.result.message}
              </span>
            ) : null}
          </div>
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
