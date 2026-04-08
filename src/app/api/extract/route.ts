import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export async function POST(req: NextRequest) {
  try {
    const { messages } = await req.json()
    const response = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 2000,
      system: `Z konverzace extrahuj use case. Vrať POUZE validní JSON, bez markdown backticks:
{
  "title": "Název nástroje - hlavní use case (např. 'Notion AI - automatizace dokumentace'). Nikdy ne generický název.",
  "tool_name": "Název nástroje nebo null",
  "team": "Tým nebo oddělení nebo null",
  "description": "1–2 věty shrnující use case",
  "purpose": "Hlavní účel a schopnosti nástroje",
  "similar_tools": "Podobné nástroje na trhu nebo null",
  "best_for_roles": "Pro která oddělení nebo role je nástroj nejlepší",
  "time_saved": "Odhad úspory času oproti dosavadnímu způsobu nebo null",
  "aha_moment": "Hlavní wow moment nebo situace kdy nástroj překvapil nebo null",
  "onboarding_score": "číslo 1–5 nebo null",
  "ui_intuitive": "ano|ne|částečně nebo null",
  "output_quality": "Hodnocení kvality výstupů nebo null",
  "hallucinates": "ano|ne|občas nebo null",
  "weaknesses": "Největší slabiny nebo null",
  "security_risks": "Bezpečnostní rizika nebo null",
  "limitations": "Kde nástroj končí nebo co odmítá dělat nebo null",
  "recommended": "ano|ne|možná nebo null",
  "rating": "číslo 1–10 nebo null",
  "pricing": "Cena nebo free/freemium/placené nebo null",
  "effort": "low|medium|high",
  "impact": "low|medium|high",
  "confidence_score": "číslo 0–100",
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
