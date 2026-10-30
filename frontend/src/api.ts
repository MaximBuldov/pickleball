export type Role = 'admin' | 'member'

export interface User {
  id: number
  name: string
  email: string | null
  is_superadmin: boolean
}

export interface Group {
  id: number
  name: string
  role: Role
}

export interface Member {
  id: number
  name: string
  email: string | null
  role: Role
  status: 'active' | 'invited' | 'guest'
}

export interface PlayerRef {
  id: number
  name: string
}

export interface Match {
  id: number
  date: string
  court: number
  team_a: [PlayerRef, PlayerRef]
  team_b: [PlayerRef, PlayerRef]
  score_a: number
  score_b: number
  created_at: string
  edited_at: string | null
}

/** A pair has two player ids; a single id means that player is unpaired. */
export type Pair = number[]

export interface GameDay {
  date: string
  player_ids: number[]
  pairs: Pair[]
  pairs_manual: boolean
  matches: Match[]
}

export interface MatchSnapshot {
  date: string
  court: number
  team_a: [string, string]
  team_b: [string, string]
  score_a: number
  score_b: number
}

export interface MatchEdit {
  action: 'edit' | 'delete'
  edited_at: string
  edited_by: string
  before: MatchSnapshot
  after: MatchSnapshot | null
}

export interface Totals {
  games: number
  wins: number
  losses: number
  points_for: number
  points_against: number
}

export interface PairStat extends Totals {
  players: [PlayerRef, PlayerRef]
}

export interface PlayerStat extends Totals {
  player: PlayerRef
}

export interface MatchInput {
  date: string
  court?: number
  team_a: number[]
  team_b: number[]
  score_a: number
  score_b: number
}

const TOKEN_KEY = 'pb_token'

export const tokenStore = {
  get: () => localStorage.getItem(TOKEN_KEY),
  set: (token: string) => localStorage.setItem(TOKEN_KEY, token),
  clear: () => localStorage.removeItem(TOKEN_KEY),
}

export class ApiError extends Error {
  status: number

  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

/** Fired when the server rejects our token, so the app can return to the login screen. */
export const LOGOUT_EVENT = 'pb:logout'

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const headers: Record<string, string> = {}
  const token = tokenStore.get()
  if (token) headers.Authorization = `Bearer ${token}`
  if (body !== undefined) headers['Content-Type'] = 'application/json'

  let res: Response
  try {
    res = await fetch(`/api${path}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) })
  } catch {
    throw new ApiError(0, 'No connection. Check your internet and try again.')
  }
  const data = await res.json().catch(() => null)
  if (!res.ok) {
    if (res.status === 401 && token) {
      tokenStore.clear()
      window.dispatchEvent(new Event(LOGOUT_EVENT))
    }
    throw new ApiError(res.status, data?.error ?? `Request failed (${res.status})`)
  }
  return data as T
}

const query = (params: Record<string, string | undefined>) => {
  const q = new URLSearchParams(Object.entries(params).filter((e): e is [string, string] => !!e[1]))
  return q.size ? `?${q}` : ''
}

export interface DateRange {
  from?: string
  to?: string
}

export const api = {
  login: (email: string, password: string) => request<{ token: string }>('POST', '/auth/login', { email, password }),
  me: () => request<{ user: User; groups: Group[] }>('GET', '/auth/me'),
  inviteInfo: (token: string) => request<{ name: string; email: string | null }>('GET', `/invites/${token}`),
  acceptInvite: (token: string, email: string, password: string) =>
    request<{ token: string }>('POST', `/invites/${token}/accept`, { email, password }),

  members: (gid: number) => request<Member[]>('GET', `/groups/${gid}/members`),
  createGuest: (gid: number, name: string) => request<{ id: number }>('POST', `/groups/${gid}/members`, { name }),
  addExistingMember: (gid: number, userId: number) => request('POST', `/groups/${gid}/members/existing`, { user_id: userId }),
  updateMember: (gid: number, uid: number, data: { name?: string; role?: Role }) =>
    request('PATCH', `/groups/${gid}/members/${uid}`, data),
  removeMember: (gid: number, uid: number) => request('DELETE', `/groups/${gid}/members/${uid}`),
  invite: (gid: number, uid: number) =>
    request<{ url: string; expires_in_days: number }>('POST', `/groups/${gid}/members/${uid}/invite`),

  day: (gid: number, date: string) => request<GameDay>('GET', `/groups/${gid}/days/${date}`),
  setDayPlayers: (gid: number, date: string, playerIds: number[]) =>
    request<GameDay>('PUT', `/groups/${gid}/days/${date}/players`, { player_ids: playerIds }),
  roulette: (gid: number, date: string) => request<GameDay>('POST', `/groups/${gid}/days/${date}/roulette`),
  setPairs: (gid: number, date: string, pairs: Pair[]) => request<GameDay>('PUT', `/groups/${gid}/days/${date}/pairs`, { pairs }),

  matches: (gid: number, range: DateRange) => request<Match[]>('GET', `/groups/${gid}/matches${query({ ...range })}`),
  createMatch: (gid: number, data: MatchInput) => request<Match>('POST', `/groups/${gid}/matches`, data),
  updateMatch: (gid: number, id: number, data: Omit<MatchInput, 'date'>) =>
    request<Match>('PATCH', `/groups/${gid}/matches/${id}`, data),
  deleteMatch: (gid: number, id: number) => request('DELETE', `/groups/${gid}/matches/${id}`),
  matchEdits: (gid: number, id: number) => request<MatchEdit[]>('GET', `/groups/${gid}/matches/${id}/edits`),

  pairStats: (gid: number, range: DateRange) => request<PairStat[]>('GET', `/groups/${gid}/stats/pairs${query({ ...range })}`),
  playerStats: (gid: number, range: DateRange) =>
    request<PlayerStat[]>('GET', `/groups/${gid}/stats/players${query({ ...range })}`),

  adminGroups: () => request<{ id: number; name: string; members: number }[]>('GET', '/admin/groups'),
  createGroup: (name: string) => request<{ id: number }>('POST', '/admin/groups', { name }),
  renameGroup: (id: number, name: string) => request('PATCH', `/admin/groups/${id}`, { name }),
  adminUsers: () =>
    request<{ id: number; name: string; email: string | null; has_account: boolean; groups: string[] }[]>('GET', '/admin/users'),
}

/** Mirrors backend Score::validate: game to 11, win by 2. */
export function scoreError(a: number | null, b: number | null): string | null {
  if (a === null || b === null) return 'Enter both scores'
  if (a === b) return 'A game cannot end in a draw'
  const winner = Math.max(a, b)
  const loser = Math.min(a, b)
  if (winner < 11) return 'The winner must reach 11 points'
  if (winner === 11 && loser > 9) return 'Win by 2: at 10:10 keep playing (e.g. 12:10)'
  if (winner > 11 && winner - loser !== 2) return 'Past 11 the margin must be exactly 2 (e.g. 12:10)'
  return null
}
