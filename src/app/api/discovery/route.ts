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
    const { data: existing } = await supabase.from('tools').select('name, vendor')
    const existingNames = (existing ?? []).map(e => e.name).join(', ')
    const existingVendors = [...new Set((existing ?? []).map(e => e.vendor).filter(Boolean))].join(', ')
    const pickedCategories = pickRandom(ALL_CATEGORIES, 3)

    const response = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1500,
      system: 'Vrať POUZE validní JSON array se 3 objekty, bez jakéhokoliv textu okolo, bez markdown backticks. Žádný úvod, žádné vysvětlení.',
      messages: [{
        role: 'user',
        content: `Navrhni přesně 3 AI nástroje — každý přesně z jedné z těchto kategorií (v tomto pořadí):
1. ${pickedCategories[0]}
2. ${pickedCategories[1]}
3. ${pickedCategories[2]}

PŘÍSNÁ PRAVIDLA:
- Každý nástroj musí být od JINÉHO vendora
- ZAKÁZANÍ vendoři (tyto firmy už máme): ${existingVendors}
- ZAKÁZANÉ nástroje (přesně tyto už máme): ${existingNames}
- ZAKÁZÁNO: OpenAI, Google, Microsoft, Anthropic, Adobe, Notion, Slack, Zoom a jejich produkty
- Hledej MÉNĚ ZNÁMÉ a SPECIALIZOVANÉ nástroje, ne mainstream

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

      const isDuplicate = existing?.some(e =>
        normalize(e.name) === normalize(tool.name) ||
        (tool.vendor && e.vendor && e.vendor.toLowerCase().trim() === tool.vendor.toLowerCase().trim())
      )

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
