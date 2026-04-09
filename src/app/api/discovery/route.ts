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
  url?: string
  website_url?: string
  description?: string
  category?: string
  tags?: string[]
}

const normalize = (n: string) => n.toLowerCase().replace(/[^a-z0-9]/g, '').trim()
const isDuplicate = (a: string, b: string) => {
  const na = normalize(a)
  const nb = normalize(b)
  return na === nb || na.includes(nb) || nb.includes(na)
}

export async function POST() {
  try {
    const { data: existing } = await supabase.from('tools').select('name')
    const existingNames = existing?.map(t => t.name.toLowerCase()) || []

    const response = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 2000,
      system: `You are an AI tool researcher. You MUST return exactly 10 AI tools as JSON array.
Rules:
- NEVER suggest tools already in the database (provided in user message)
- Only tools from 2024-2026
- Diverse categories: one per category max
- NO mainstream tools unless they have a brand new feature/product
- Focus on niche, specialized, emerging tools`,
      messages: [{
        role: 'user',
        content: `Already in database: ${existingNames.join(', ')}

Return JSON array only, no markdown:
[{"name":"...","vendor":"...","description":"...","tags":["..."],"url":"..."}]`,
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

      const alreadyExists = existingNames.some(n => isDuplicate(n, tool.name))
      if (alreadyExists) continue

      console.log('Ukládám nástroj:', tool.name)
      await supabase.from('tools').insert({
        name: tool.name,
        vendor: tool.vendor ?? null,
        website_url: tool.url ?? tool.website_url ?? null,
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
