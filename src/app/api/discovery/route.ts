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
    // 1. Load existing tools from DB
    const { data: existing } = await supabase.from('tools').select('name')
    const existingNames = existing?.map(t => t.name.toLowerCase()) || []

    // 2. Tavily search for new AI tools
    const tavilyRes = await fetch('https://api.tavily.com/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        api_key: process.env.TAVILY_API_KEY,
        query: 'new AI tools 2025 product launch startup',
        search_depth: 'advanced',
        max_results: 20,
        include_answer: true,
      }),
    })

    if (!tavilyRes.ok) {
      throw new Error(`Tavily error: ${tavilyRes.status}`)
    }

    const tavilyData = await tavilyRes.json()

    // 3. Send Tavily results to Claude for structured extraction
    const response = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 2000,
      system: `You are an AI tool researcher. Extract structured AI tool information from web search results.
Return ONLY a valid JSON array, no markdown, no explanation.`,
      messages: [{
        role: 'user',
        content: `From these web search results, extract up to 10 distinct AI tools that were recently launched or updated.

Search answer: ${tavilyData.answer || ''}

Search results:
${(tavilyData.results || []).map((r: { title: string; url: string; content: string }) => `Title: ${r.title}\nURL: ${r.url}\nContent: ${r.content}`).join('\n\n')}

Rules:
- Skip any tool already in this list: ${existingNames.join(', ')}
- Only include real, specific AI tools (not articles or listicles)
- Each tool must have a clear name and description
- Focus on niche, specialized, or newly launched tools

Return ONLY JSON array:
[{"name":"...","vendor":"...","description":"...","tags":["..."],"url":"..."}]`,
      }],
    })

    const text = response.content[0].type === 'text' ? response.content[0].text : '[]'
    const discovered: DiscoveredTool[] = JSON.parse(text.replace(/```json|```/g, '').trim())

    if (!Array.isArray(discovered)) {
      return NextResponse.json({ added: 0 })
    }

    // 4. Insert non-duplicate tools
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
