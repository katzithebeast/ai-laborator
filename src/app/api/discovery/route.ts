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

function isSimilar(a: string, b: string): boolean {
  const na = a.toLowerCase().trim()
  const nb = b.toLowerCase().trim()
  if (na === nb) return true
  if (na.includes(nb) || nb.includes(na)) return true
  if (
    Math.abs(na.length - nb.length) < 3 &&
    na.replace(/\s/g, '') === nb.replace(/\s/g, '')
  ) return true
  return false
}

export async function POST() {
  try {
    const response = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1500,
      system: 'Vrať POUZE validní JSON array, bez jakéhokoliv textu okolo, bez markdown backticks.',
      messages: [{
        role: 'user',
        content: 'Navrhni 5 nejnovějších a nejzajímavějších AI nástrojů které stojí za vyzkoušení ve firmě. Navrhni pouze nástroje které jsou velmi nové (2024-2026), co nejaktuálnější. Každý nástroj musí mít unikátní přesný název. Pro každý vrať objekt s klíči: name (string), vendor (string), website_url (string), description (string), category (string), tags (string array).',
      }],
    })

    const text = response.content[0].type === 'text' ? response.content[0].text : '[]'
    const discovered: DiscoveredTool[] = JSON.parse(text.replace(/```json|```/g, '').trim())

    if (!Array.isArray(discovered)) {
      return NextResponse.json({ added: 0 })
    }

    const { data: existing } = await supabase.from('tools').select('name, vendor')

    let added = 0
    for (const tool of discovered) {
      if (!tool.name) continue

      const isDuplicate = existing?.some(e =>
        isSimilar(e.name, tool.name) ||
        (e.vendor && tool.vendor && isSimilar(e.vendor, tool.vendor) && isSimilar(e.name, tool.name))
      )

      if (isDuplicate) continue

      await supabase.from('tools').insert({
        name: tool.name,
        vendor: tool.vendor ?? null,
        website_url: tool.website_url ?? null,
        description: tool.description ?? null,
        category: tool.category ?? null,
        tags: Array.isArray(tool.tags) ? tool.tags : [],
        status: 'new',
        source: 'discovery',
      })
      added++
    }

    return NextResponse.json({ added })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
