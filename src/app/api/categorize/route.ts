import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

const VALID_CATEGORIES = ['images', 'video', 'coding', 'chatbot', 'text', 'audio', 'data', 'design', 'productivity', 'other']

export async function POST(_req: NextRequest) {
  const supabase = createClient(supabaseUrl, supabaseAnonKey)

  const { data: items, error } = await supabase
    .from('use_cases')
    .select('id, tool_name, title, description, tags')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!items || items.length === 0) return NextResponse.json({ categorized: 0, errors: 0 })

  let categorized = 0
  const errorDetails: Array<{ id: string; title: string; stage: string; message: string }> = []

  for (const item of items) {
    try {
      const response = await client.messages.create({
        model: 'claude-sonnet-4-6',
        max_tokens: 50,
        system: `Přiřaď JEDNU kategorii AI nástroji. Vrať POUZE jedno slovo z: images, video, coding, chatbot, text, audio, data, design, productivity, other`,
        messages: [{
          role: 'user',
          content: `Nástroj: ${item.tool_name ?? ''}
Název: ${item.title ?? ''}
Popis: ${item.description ?? ''}
Tagy: ${(item.tags ?? []).join(', ')}`
        }]
      })

      const raw = response.content[0].type === 'text' ? response.content[0].text.trim().toLowerCase() : 'other'
      const category = VALID_CATEGORIES.includes(raw) ? raw : 'other'

      const { error: updateError } = await supabase
        .from('use_cases')
        .update({ category })
        .eq('id', item.id)

      if (updateError) {
        errorDetails.push({ id: item.id, title: item.title ?? '', stage: 'db_update', message: updateError.message })
        continue
      }
      categorized++
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err)
      errorDetails.push({ id: item.id, title: item.title ?? '', stage: 'claude_api', message })
    }
  }

  return NextResponse.json({ categorized, errors: errorDetails.length, errorDetails })
}
