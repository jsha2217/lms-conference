import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { MemberScore } from '../lib/types'

// member_scores 조회 + passes/members 변경 시 실시간 재조회
export function useScores() {
  const [scores, setScores] = useState<MemberScore[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const timer = useRef<number | undefined>(undefined)

  const refresh = useCallback(async () => {
    const { data, error } = await supabase.from('member_scores').select('*').order('name')
    if (error) setError(error.message)
    else {
      setScores(data as MemberScore[])
      setError(null)
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    refresh()
    const queue = () => {
      window.clearTimeout(timer.current)
      timer.current = window.setTimeout(refresh, 250)
    }
    const channel = supabase
      .channel('scores')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'passes' }, queue)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'members' }, queue)
      .subscribe()
    return () => {
      window.clearTimeout(timer.current)
      supabase.removeChannel(channel)
    }
  }, [refresh])

  return { scores, loading, error, refresh }
}

export const teamScore = (scores: MemberScore[], team: number) =>
  scores.filter((s) => s.team === team).reduce((sum, s) => sum + s.score, 0)
