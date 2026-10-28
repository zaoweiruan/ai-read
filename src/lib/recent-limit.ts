/** 最近打开文件记录数量的默认值与钳制规则（settings-store 与 recent-files-store 共用，避免循环依赖）。 */

export const DEFAULT_RECENT_LIMIT = 10
export const MAX_RECENT_LIMIT = 50

export function clampRecentLimit(v: number): number {
  if (!Number.isFinite(v)) return DEFAULT_RECENT_LIMIT
  return Math.min(MAX_RECENT_LIMIT, Math.max(1, Math.round(v)))
}
