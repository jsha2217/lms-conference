export type Team = 1 | 2
export type Role = 'member' | 'lead' | 'admin'

export interface Member {
  id: string
  name: string
  team: Team | null
  role: Role
  user_id: string | null
}

export interface MemberScore {
  id: string
  name: string
  team: Team
  role: 'member' | 'lead'
  steps: number
  score: number
  achieved_at: string | null
}

export const TEAMS: Team[] = [1, 2]
export const ACHIEVE_STEPS = 7
export const TREE_FULL_SCORE = 40

export const teamLabel = (team: Team) => `${team}팀`
export const roleLabel = (role: Role) => (role === 'lead' ? '대표자' : role === 'admin' ? '총괄' : '맴버')
