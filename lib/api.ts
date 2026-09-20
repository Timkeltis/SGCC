/**
 * 取数：直接读取 Home Assistant REST API 中的国家电网实体。
 * 数据链路：Scripting -> DDNSTO -> Home Assistant -> hass-state-grid。
 *
 * 该版本不再依赖 Loon / Surge / wsgw 重写。
 */
import { fetch } from 'scripting'
import { writeCache } from './cache'
import { buildViewModel, nowString } from './calc'
import type { BillViewModel, RawAccount, SGCCSettings } from './types'

const CACHE_KEY = 'BillData_HA.json'
const TIMEOUT_SEC = 15
const MAX_ATTEMPTS = 2

type HAState = {
  entity_id?: string
  state?: string
  attributes?: Record<string, unknown>
  last_changed?: string
  last_updated?: string
}

type AccountEntities = {
  key: string
  suffix: string
  address: string
  daily?: HAState
  currentMonth?: HAState
  settledMonthUsage?: HAState
  settledMonthCharge?: HAState
  yearUsage?: HAState
  yearCharge?: HAState
  balance?: HAState
  amountDue?: HAState
}

function cleanBaseUrl(url: string): string {
  return url.trim().replace(/\/+$/, '').replace(/\/api(?:\/states)?$/i, '')
}

function asNumber(value: unknown): number | null {
  if (value == null || value === '' || value === 'unknown' || value === 'unavailable') return null
  const n = Number(String(value).replace(/,/g, ''))
  return Number.isFinite(n) ? n : null
}

function stateNumber(entity?: HAState): number | null {
  return asNumber(entity?.state)
}

function dateCompact(value: unknown): string {
  return String(value ?? '').replace(/[^0-9]/g, '').slice(0, 8)
}

function monthCompact(value: unknown): string {
  return String(value ?? '').replace(/[^0-9]/g, '').slice(0, 6)
}

function formatUpdate(value?: string): string {
  if (!value) return nowString()
  const d = new Date(value)
  if (!Number.isFinite(d.getTime())) return nowString()
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`
}

/** 取该户所有国网实体中最近一次由 HA 更新的时间。 */
function latestEntityUpdate(group: AccountEntities): string {
  const entities = [
    group.daily,
    group.currentMonth,
    group.settledMonthUsage,
    group.settledMonthCharge,
    group.yearUsage,
    group.yearCharge,
    group.balance,
    group.amountDue,
  ]
  let latest = 0
  let latestText = ''
  for (const entity of entities) {
    const value = entity?.last_updated || entity?.last_changed
    if (!value) continue
    const time = new Date(value).getTime()
    if (Number.isFinite(time) && time > latest) {
      latest = time
      latestText = value
    }
  }
  return latestText ? formatUpdate(latestText) : nowString()
}

/**
 * 当前 hass-state-grid 不同版本的 entity_id 文案略有差异，
 * 所以同时兼容 latest/previous 两套命名，并优先通过历史属性识别关键实体。
 */
function classify(entity: HAState): { key: keyof Omit<AccountEntities, 'key' | 'suffix' | 'address'>; prefix: string } | null {
  const id = entity.entity_id ?? ''
  const attrs = entity.attributes ?? {}

  const candidates: Array<[keyof Omit<AccountEntities, 'key' | 'suffix' | 'address'>, string[]]> = [
    ['daily', ['_previous_daily_usage', '_latest_daily_usage']],
    ['currentMonth', ['_current_month_usage']],
    ['settledMonthUsage', ['_previous_settled_month_usage', '_latest_month_usage']],
    ['settledMonthCharge', ['_previous_settled_month_charge', '_latest_month_charge']],
    ['yearUsage', ['_current_year_usage']],
    ['yearCharge', ['_current_year_charge']],
    ['balance', ['_account_balance']],
    ['amountDue', ['_amount_due']],
  ]

  for (const [key, suffixes] of candidates) {
    for (const suffix of suffixes) {
      if (id.endsWith(suffix)) return { key, prefix: id.slice(0, -suffix.length) }
    }
  }

  // 历史属性是最稳定的兜底识别方式。
  if (Array.isArray(attrs.daily_history)) {
    return { key: 'daily', prefix: id.replace(/_[^_]+(?:_[^_]+){0,3}$/, '') }
  }
  if (Array.isArray(attrs.monthly_bill_history)) {
    return { key: 'settledMonthUsage', prefix: id.replace(/_[^_]+(?:_[^_]+){0,4}$/, '') }
  }

  return null
}

function discoverAccounts(states: HAState[]): AccountEntities[] {
  const groups = new Map<string, AccountEntities>()

  for (const entity of states) {
    if (!entity?.entity_id?.startsWith('sensor.')) continue
    const info = classify(entity)
    if (!info) continue

    const attrs = entity.attributes ?? {}
    const suffix = String(attrs.account_suffix ?? '')
    const address = String(attrs.address ?? '')
    // 使用实体前缀作为主键；同户号的所有国家电网传感器共享同一前缀。
    const groupKey = info.prefix
    const current = groups.get(groupKey) ?? {
      key: groupKey,
      suffix,
      address,
    }

    if (!current.suffix && suffix) current.suffix = suffix
    if (!current.address && address) current.address = address
    current[info.key] = entity
    groups.set(groupKey, current)
  }

  return [...groups.values()]
    .filter(group => group.daily || group.currentMonth || group.yearUsage || group.balance)
    .sort((a, b) => a.key.localeCompare(b.key))
}

function toRawAccount(group: AccountEntities, index: number): RawAccount {
  const dailyAttrs = group.daily?.attributes ?? {}
  const monthAttrs = group.settledMonthUsage?.attributes ?? {}
  const balanceAttrs = group.balance?.attributes ?? group.amountDue?.attributes ?? {}

  const dailyHistory = Array.isArray(dailyAttrs.daily_history) ? dailyAttrs.daily_history : []
  const dayList = dailyHistory
    .map(item => {
      const row = item && typeof item === 'object' ? item as Record<string, unknown> : {}
      const day = dateCompact(row.day)
      const usage = asNumber(row.usage ?? row.dayElePq)
      return day && usage != null ? { day, dayElePq: String(usage) } : null
    })
    .filter((item): item is { day: string; dayElePq: string } => item != null)
    .sort((a, b) => b.day.localeCompare(a.day))

  // 若 history 暂时为空，但实体本身已有最新日数据，也保证小组件至少能显示最新一天。
  if (dayList.length === 0) {
    const latestDay = dateCompact(dailyAttrs.latest_date)
    const latestUsage = stateNumber(group.daily)
    if (latestDay && latestUsage != null) {
      dayList.push({ day: latestDay, dayElePq: String(latestUsage) })
    }
  }

  const monthlyHistory = Array.isArray(monthAttrs.monthly_bill_history) ? monthAttrs.monthly_bill_history : []
  const monthList = monthlyHistory
    .map(item => {
      const row = item && typeof item === 'object' ? item as Record<string, unknown> : {}
      const month = monthCompact(row.month)
      const usage = asNumber(row.usage ?? row.monthEleNum)
      const charge = asNumber(row.charge ?? row.monthEleCost)
      return month
        ? {
            month,
            monthEleNum: String(usage ?? 0),
            monthEleCost: String(charge ?? 0),
          }
        : null
    })
    .filter((item): item is { month: string; monthEleNum: string; monthEleCost: string } => item != null)
    .sort((a, b) => a.month.localeCompare(b.month))

  // 同样为最近结算月做兜底，避免月历史属性短暂缺失时显示 0。
  if (monthList.length === 0) {
    const latestMonth = monthCompact(monthAttrs.latest_bill_month)
    const usage = stateNumber(group.settledMonthUsage)
    const charge = stateNumber(group.settledMonthCharge)
    if (latestMonth && (usage != null || charge != null)) {
      monthList.push({
        month: latestMonth,
        monthEleNum: String(usage ?? 0),
        monthEleCost: String(charge ?? 0),
      })
    }
  }

  const currentMonth = stateNumber(group.currentMonth)
  const yearUsage = stateNumber(group.yearUsage) ?? 0
  const yearCharge = stateNumber(group.yearCharge) ?? 0
  const balance = stateNumber(group.balance)
  const amountDue = stateNumber(group.amountDue)
  const accountType = String(balanceAttrs.account_type ?? '')
  const isPostPaid = accountType === 'postpaid' || amountDue != null
  const isOverdue = isPostPaid && (amountDue ?? 0) > 0

  // 没有完整户号属性时，用 HA 暴露的后四位作为稳定标识。
  const consNo = group.suffix || `HA-${index + 1}`
  const consName = group.suffix ? `国家电网 ${group.suffix}` : `国家电网 ${index + 1}`

  const eleBill: RawAccount['eleBill'] = {
    // 显示 HA 实体实际更新时间，不再使用 Scripting 本次请求时间。
    date: latestEntityUpdate(group),
    sumMoney: isPostPaid ? (amountDue ?? 0) : (balance ?? 0),
  }
  if (isPostPaid) {
    // calc.ts 以该字段是否存在判断后付费账户。
    eleBill.accountBalance = balance ?? 0
  }

  return {
    userInfo: {
      consNo_dst: consNo,
      consName_dst: consName,
    },
    arrearsOfFees: isOverdue,
    eleBill,
    dayElecQuantity31: {
      sevenEleList: dayList,
    },
    monthElecQuantity: {
      mothEleList: monthList,
      dataInfo: {
        totalEleNum: yearUsage,
        totalEleCost: yearCharge,
      },
    },
    stepElecQuantity: [
      {
        electricParticulars: {
          totalYearPq: yearUsage,
        },
      },
    ],
    haCurrentMonthUsage: currentMonth ?? undefined,
    haLatestDailyUsage: stateNumber(group.daily) ?? undefined,
  }
}

async function requestOnce(settings: SGCCSettings): Promise<RawAccount[]> {
  const haUrl = cleanBaseUrl(settings.haUrl)
  // 兼容用户粘贴完整的「Bearer xxx」、引号或换行，避免重复拼接 Bearer。
  const haToken = settings.haToken
    .trim()
    .replace(/^Bearer\s+/i, '')
    .replace(/^['"]|['"]$/g, '')
    .trim()
  if (!haUrl || !haToken) throw new Error('请先在设置页填写 Home Assistant 地址和 Token')
  const endpoint = `${haUrl}/api/states`
  console.log(`请求 Home Assistant API：${endpoint}`)
  const res = await fetch(endpoint, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${haToken}`,
      Accept: 'application/json',
      'Content-Type': 'application/json',
      'Cache-Control': 'no-cache',
      'User-Agent': 'HomeAssistant/2026.9',
    },
    handleRedirect: async newRequest => {
      if (!newRequest.url.startsWith(`${haUrl}/`)) return null
      return {
        ...newRequest,
        headers: {
          ...newRequest.headers,
          Authorization: `Bearer ${haToken}`,
          Accept: 'application/json',
          'Cache-Control': 'no-cache',
      'User-Agent': 'HomeAssistant/2026.9',
        },
      }
    },
    timeout: TIMEOUT_SEC,
  })

  if (!res.ok) throw new Error(`Home Assistant HTTP ${res.status}`)

  // 不直接使用 res.json()：部分网络层会给 JSON 前后附加 BOM/空白，
  // 也可能返回 HTML 错误页；先读文本并给出可诊断的错误。
  const body = (await res.text()).replace(/^\uFEFF/, '').trim()
  if (!body || body.startsWith('<')) {
    const contentType = res.headers.get('content-type') ?? 'unknown'
    throw new Error(`Home Assistant 返回的不是 JSON（${res.status}，${contentType}）：${body.slice(0, 80)}`)
  }

  let json: unknown
  try {
    json = JSON.parse(body)
  } catch {
    throw new Error(`Home Assistant JSON 解析失败：${body.slice(0, 120)}`)
  }
  if (!Array.isArray(json)) throw new Error('Home Assistant /api/states 返回格式无效')

  const accounts = discoverAccounts(json as HAState[]).map(toRawAccount)
  if (accounts.length === 0) {
    throw new Error('未发现国家电网实体，请确认 HA 中 hass-state-grid 正常工作')
  }
  return accounts
}

async function fetchAccounts(
  settings: SGCCSettings,
): Promise<{ accounts: RawAccount[]; fromCache: boolean; age: number }> {
  // 实时模式：每次脚本运行都直接请求 HA，不读取本地缓存作为数据源。
  // 本地缓存仅保留用于排障，不参与正常展示，避免任何时候显示旧数据。
  let lastError: unknown = null
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    try {
      const accounts = await requestOnce(settings)
      writeCache(CACHE_KEY, JSON.stringify(accounts))
      console.log(`Home Assistant 请求成功，共 ${accounts.length} 个户号`)
      return { accounts, fromCache: false, age: 0 }
    } catch (e) {
      lastError = e
      console.log(`Home Assistant 请求失败（第 ${attempt + 1}/${MAX_ATTEMPTS} 次）：${e}`)
      if (attempt + 1 < MAX_ATTEMPTS) {
        await new Promise(resolve => setTimeout(resolve, 2500))
      }
    }
  }

  // 实时模式下请求失败不回退旧缓存，直接显示错误，保证显示的数据不会冒充最新数据。
  throw new Error(`无法获取 HA 国家电网最新数据：${lastError instanceof Error ? lastError.message : lastError}`)
}

export async function getBillData(
  settings: SGCCSettings,
  accountIndex?: number,
): Promise<BillViewModel> {
  const { accounts, fromCache, age } = await fetchAccounts(settings)

  const index = Math.min(Math.max(accountIndex ?? settings.accountIndex, 0), accounts.length - 1)
  const account = accounts[index]
  if (!account) throw new Error(`账户下标 ${index} 不存在`)

  const update = account.eleBill?.date || nowString()
  return buildViewModel(account, {
    update,
    fromCache,
    cacheAgeMinutes: age,
    stepMode: settings.stepMode,
    step2: settings.step2,
    step3: settings.step3,
    stepPercentMode: settings.stepPercentMode,
  })
}

export async function listAccounts(
  settings: SGCCSettings,
): Promise<Array<{ index: number; consNo: string; consName: string }>> {
  const { accounts } = await fetchAccounts(settings)
  return accounts.map((item, index) => ({
    index,
    consNo: item.userInfo?.consNo_dst ?? '',
    consName: item.userInfo?.consName_dst ?? `账户 ${index + 1}`,
  }))
}

export { CACHE_KEY }
