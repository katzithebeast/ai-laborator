import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

export type Tool = {
  id: string
  name: string
  vendor: string
  website_url: string
  description: string
  category: string
  tags: string[]
  status: 'new' | 'claimed' | 'in_progress' | 'completed' | 'archived'
  legit_score: number
  fit_score: number
  novelty_score: number
  source: string
  claimed_by: string | null
  claimed_at: string | null
  created_at: string
  is_new?: boolean
}

export type UseCase = {
  id: string
  title: string
  description: string | null
  tool_id: string | null
  tool_name: string | null
  team: string | null
  problem: string | null
  solution: string | null
  benefits: string | null
  risks: string | null
  effort: 'low' | 'medium' | 'high' | null
  impact: 'low' | 'medium' | 'high' | null
  status: 'draft' | 'review' | 'published' | 'archived'
  confidence_score: number
  tags: string[]
  author_id: string | null
  author_name: string | null
  chat_history: Message[]
  created_at: string
  updated_at: string
  purpose: string | null
  similar_tools: string | null
  best_for_roles: string | null
  time_saved: string | null
  aha_moment: string | null
  output_quality: string | null
  hallucinates: string | null
  weaknesses: string | null
  security_risks: string | null
  limitations: string | null
  recommended: string | null
  pricing: string | null
  ui_intuitive: string | null
  onboarding_score: number | null
  rating: number | null
  category: string | null
}

export type Message = {
  role: 'user' | 'assistant'
  content: string
}
