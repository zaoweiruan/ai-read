import { useState } from 'react';
import { usePromptStore } from '@/stores/prompt-store';
import type { CustomPrompt } from '@/stores/prompt-store';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';

interface Draft {
  id?: string;
  name: string;
  description: string;
  content: string;
}

const EMPTY: Draft = { name: '', description: '', content: '' };

export default function PromptManager() {
  const prompts = usePromptStore((s) => s.prompts);
  const activePromptId = usePromptStore((s) => s.activePromptId);
  const addPrompt = usePromptStore((s) => s.addPrompt);
  const updatePrompt = usePromptStore((s) => s.updatePrompt);
  const removePrompt = usePromptStore((s) => s.removePrompt);
  const setActivePrompt = usePromptStore((s) => s.setActivePrompt);

  const [draft, setDraft] = useState<Draft | null>(null);
  const onlyCustom = usePromptStore((s) => s.onlyCustom);
  const setOnlyCustom = usePromptStore((s) => s.setOnlyCustom);

  function startCreate() {
    setDraft({ ...EMPTY });
  }

  function startEdit(prompt: CustomPrompt) {
    setDraft({
      id: prompt.id,
      name: prompt.name,
      description: prompt.description,
      content: prompt.content,
    });
  }

  function duplicate(prompt: CustomPrompt) {
    addPrompt({
      name: `${prompt.name} 副本`,
      description: prompt.description,
      content: prompt.content,
    });
  }

  function save() {
    if (!draft) return;
    const name = draft.name.trim();
    if (!name) return;
    if (draft.id) {
      updatePrompt(draft.id, {
        name,
        description: draft.description.trim(),
        content: draft.content,
      });
    } else {
      addPrompt({
        name,
        description: draft.description.trim(),
        content: draft.content,
      });
    }
    setDraft(null);
  }

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">自定义提示词</h2>
        <Button size="sm" onClick={startCreate}>
          新建
        </Button>
      </div>

      <p className="text-sm text-muted-foreground">
        当前使用：
        {prompts.find((p) => p.id === activePromptId)?.name ?? '（未选择）'}。
        「仅使用自定义提示词」将替换系统提示词，仅在文字总结模式生效。
      </p>

      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={onlyCustom}
          onChange={(e) => setOnlyCustom(e.target.checked)}
        />
        仅使用自定义提示词（替换系统提示词，仅总结模式）
      </label>

      {draft ? (
        <div className="space-y-3 rounded-lg border border-border p-4">
          <Input
            placeholder="提示词名称"
            value={draft.name}
            onChange={(e) => setDraft({ ...draft, name: e.target.value })}
          />
          <Input
            placeholder="描述（可选）"
            value={draft.description}
            onChange={(e) => setDraft({ ...draft, description: e.target.value })}
          />
          <Textarea
            placeholder="提示词内容"
            rows={8}
            value={draft.content}
            onChange={(e) => setDraft({ ...draft, content: e.target.value })}
          />
          <div className="flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={() => setDraft(null)}>
              取消
            </Button>
            <Button size="sm" onClick={save}>
              保存
            </Button>
          </div>
        </div>
      ) : null}

      <ul className="space-y-2">
        {prompts.map((prompt) => (
          <li
            key={prompt.id}
            className="flex items-start justify-between gap-3 rounded-lg border border-border p-3"
          >
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="truncate font-medium">{prompt.name}</span>
                {prompt.id === activePromptId ? <Badge>使用中</Badge> : null}
              </div>
              {prompt.description ? (
                <p className="truncate text-sm text-muted-foreground">{prompt.description}</p>
              ) : null}
            </div>
            <div className="flex shrink-0 gap-1">
              <Button
                variant="ghost"
                size="sm"
                onClick={() =>
                  setActivePrompt(prompt.id === activePromptId ? undefined : prompt.id)
                }
              >
                {prompt.id === activePromptId ? '停用' : '使用'}
              </Button>
              <Button variant="ghost" size="sm" onClick={() => startEdit(prompt)}>
                编辑
              </Button>
              <Button variant="ghost" size="sm" onClick={() => duplicate(prompt)}>
                复制
              </Button>
              <Button variant="ghost" size="sm" onClick={() => removePrompt(prompt.id)}>
                删除
              </Button>
            </div>
          </li>
        ))}
        {prompts.length === 0 ? (
          <li className="text-sm text-muted-foreground">暂无提示词，点击「新建」创建。</li>
        ) : null}
      </ul>
    </section>
  );
}
