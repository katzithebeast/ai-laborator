import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@supabase/supabase-js'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

type DiscoveredTool = {
  name: string
  vendor?: string
  website_url?: string
  description?: string
  category?: string
  tags?: string[]
}

const normalize = (n: string) =>
  n.toLowerCase().replace(/\b(ai|pro|plus|alpha|beta|gen|ml)\b/g, '').replace(/\s+/g, ' ').trim()

const ALL_CATEGORIES = [
  'právní dokumenty a smlouvy', 'fakturace a účetnictví', 'HR a nábor',
  'překlad a lokalizace', 'zákaznická podpora a chatboty', 'SEO a obsah',
  'analýza dat a reporty', 'plánování a projektové řízení', 'e-mail marketing',
  'sociální sítě a scheduling', 'prezentace a vizualizace', 'transkripce schůzek',
  'kybernetická bezpečnost', 'správa znalostní báze', 'code review a testování',
  'generování obrázků pro e-commerce', 'video editace a titulky', 'správa smluv',
]

function pickRandom<T>(arr: T[], n: number): T[] {
  return [...arr].sort(() => Math.random() - 0.5).slice(0, n)
}

export async function POST() {
  try {
    const { data: existingTools } = await supabase.from('tools').select('name')
    const existingNames = existingTools?.map(t => t.name) || []
    const pickedCategories = pickRandom(ALL_CATEGORIES, 3)

    const response = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 2000,
      system: 'Return ONLY a valid JSON array, no markdown, no explanation, no intro text.',
      messages: [{
        role: 'user',
        content: `Today is ${new Date().toISOString().split('T')[0]}.
We already have these tools in our database: ${existingNames.join(', ')}.
Find 10 NEW AI tools from 2024-2026 that are NOT in the list above.
Cover diverse categories: ${pickedCategories.join(', ')}, audio, video, code, design, data, productivity, research, etc.
Return only tools we don't have yet. Each from a different vendor.

Return ONLY JSON array: [{"name":"...","vendor":"...","website_url":"...","description":"...","category":"...","tags":["...","..."]}]`,
      }],
    })

    const text = response.content[0].type === 'text' ? response.content[0].text : '[]'
    const discovered: DiscoveredTool[] = JSON.parse(text.replace(/```json|```/g, '').trim())

    if (!Array.isArray(discovered)) {
      return NextResponse.json({ added: 0 })
    }

    let added = 0
    for (const tool of discovered) {
      if (!tool.name) continue

      const alreadyExists = existingNames.some(n =>
        n.toLowerCase().trim() === tool.name.toLowerCase().trim()
      )
      if (alreadyExists) continue

      console.log('Ukládám nástroj:', tool.name)
      await supabase.from('tools').insert({
        name: tool.name,
        vendor: tool.vendor ?? null,
        website_url: tool.website_url ?? null,
        description: tool.description ?? null,
        category: tool.category ?? null,
        tags: Array.isArray(tool.tags) ? tool.tags : [],
        status: 'new',
        source: 'discovery',
        is_new: true,
      })
      added++
    }

    return NextResponse.json({ added })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
