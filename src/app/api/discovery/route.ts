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

export async function POST() {
  try {
    const { data: existing } = await supabase.from('tools').select('name, vendor')
    // Limit to 50 names to keep prompt size manageable
    const existingNames = (existing ?? []).slice(0, 50).map(e => e.name).join(', ')

    const response = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1500,
      system: 'Vrať POUZE validní JSON array se 3 objekty, bez jakéhokoliv textu okolo, bez markdown backticks. Žádný úvod, žádné vysvětlení.',
      messages: [{
        role: 'user',
        content: `Navrhni přesně 3 AI nástroje pro firmy. Každý musí být od JINÉHO vendora, z JINÉ kategorie.
POVINNÉ kategorie z tohoto seznamu (vyber 3 různé): video/obraz, analýza dat, zákaznická podpora, HR/školení, účetnictví, právní dokumenty, SEO, design, překlad, projektové řízení, generování kódu, marketing.
ZAKÁZÁNO navrhnout: ChatGPT, Claude, Gemini, Copilot, Midjourney, DALL-E, Stable Diffusion, Notion, Slack, Zoom, nebo jakoukoliv variantu těchto nástrojů.
ZAKÁZÁNO navrhnout nástroje z tohoto seznamu (PŘESNĚ TYTO UŽ MÁME): ${existingNames}
Navrhni pouze méně známé nebo specializované nástroje.
Vrať POUZE JSON array: [{"name":"...","vendor":"...","website_url":"...","description":"...","category":"...","tags":["...","..."]}]`,
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

      const isDuplicate = existing?.some(e => normalize(e.name) === normalize(tool.name))

      if (isDuplicate) continue

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
