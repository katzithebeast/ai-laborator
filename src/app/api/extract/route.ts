import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export async function POST(req: NextRequest) {
  try {
    const { messages } = await req.json()
    const response = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1000,
      system: `Z konverzace extrahuj use case. Vrať POUZE validní JSON, bez markdown backticks:
{
  "title": "Krátký výstižný název",
  "tool_name": "Název nástroje nebo null",
  "team": "Tým nebo null",
  "description": "1–2 věty",
  "problem": "Popis problému",
  "solution": "Popis řešení",
  "benefits": "Klíčové přínosy",
  "risks": "Rizika",
  "effort": "low|medium|high",
  "impact": "low|medium|high",
  "confidence_score": 0-100,
  "tags": ["tag1", "tag2"]
}`,
      messages: [{
        role: 'user',
        content: messages
          .map((m: { role: string; content: string }) =>
            `${m.role === 'user' ? 'Uživatel' : 'AI'}: ${m.content}`)
          .join('\n\n')
      }]
    })
    const text = response.content[0].type === 'text' ? response.content[0].text : '{}'
    const data = JSON.parse(text.replace(/```json|```/g, '').trim())
    return NextResponse.json(data)
  } catch (err) {
    return NextResponse.json({ error: 'Extraction failed' }, { status: 500 })
  }
}
