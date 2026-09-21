/**
 * 配置读写。使用 Storage（脚本私有域），index.tsx 与 widget.tsx 共享。
 */
import { DEFAULT_SETTINGS, type SGCCSettings } from './types'

const KEY = 'sgcc.settings'

export function loadSettings(): SGCCSettings {
  const raw = Storage.get<Partial<SGCCSettings>>(KEY)
  // 与默认值合并，保证新增字段有兜底
  const merged = !raw || typeof raw !== 'object'
    ? { ...DEFAULT_SETTINGS }
    : { ...DEFAULT_SETTINGS, ...raw }
  // 阶梯口径仅保留「按年累计」；旧的按月配置退回年度
  merged.stepMode = '年'
  // 基础配置归一化，避免旧版本或异常 Storage 导致无效刷新间隔/布局参数。
  if (merged.dataSource !== 'ha' && merged.dataSource !== 'nas-api') merged.dataSource = DEFAULT_SETTINGS.dataSource
  if (typeof merged.nasApiBaseUrl !== 'string') merged.nasApiBaseUrl = ''
  if (typeof merged.nasApiToken !== 'string') merged.nasApiToken = ''
  if (typeof merged.haUrl !== 'string') merged.haUrl = ''
  if (typeof merged.haToken !== 'string') merged.haToken = ''
  if (!Number.isFinite(merged.interval) || ![60, 120, 240, 360, 720, 1440].includes(merged.interval)) merged.interval = DEFAULT_SETTINGS.interval
  if (!Number.isFinite(merged.dayAmount) || merged.dayAmount < 5 || merged.dayAmount > 14) merged.dayAmount = DEFAULT_SETTINGS.dayAmount
  if (!Number.isFinite(merged.accountIndex) || merged.accountIndex < 0) merged.accountIndex = 0
  if (!Array.isArray(merged.accNames)) merged.accNames = []
  if (!Number.isFinite(merged.step2) || merged.step2 < 0) merged.step2 = 0
  if (!Number.isFinite(merged.step3) || merged.step3 < 0) merged.step3 = 0
  if (merged.step2 > 0 && merged.step3 > 0 && merged.step3 <= merged.step2) {
    merged.step2 = 0
    merged.step3 = 0
  }
  return merged
}

export function saveSettings(settings: SGCCSettings): boolean {
  return Storage.set(KEY, settings)
}

export function resetSettings(): void {
  Storage.remove(KEY)
}
