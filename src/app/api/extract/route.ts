import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

export async function POST(req: NextRequest) {
  try {
    const { messages } = await req.json()
    const systemPrompt = `Z konverzace extrahuj use case. Vrať POUZE validní JSON, bez markdown backticks:
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
  "category": "jedna z hodnot: images|video|coding|chatbot|text|audio|data|design|productivity|other – vyber JEDNU nejvíce odpovídající, pokud si nejsi jistý zvol 'other'",
  "tags": ["tag1", "tag2"] – max 5 tagů, vždy lowercase, odvozuj z kontextu konverzace bez explicitního ptaní. Příklady: "generování obrázků", "video", "kódování", "chatbot", "psaní textu", "marketing", "automatizace", "analýza dat", "design", "prezentace", "výzkum", "překlad", "zákaznická podpora"
}`
    const conversationText = messages
      .map((m: { role: string; content: string }) =>
        `${m.role === 'user' ? 'Uživatel' : 'AI'}: ${m.content}`)
      .join('\n\n')
    const response = await client.chat.completions.create({
      model: 'gpt-4o-mini',
      max_tokens: 2000,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: conversationText },
      ],
    })
    const text = response.choices[0]?.message?.content ?? '{}'
    const data = JSON.parse(text.replace(/```json|```/g, '').trim())
    return NextResponse.json(data)
  } catch (err) {
    return NextResponse.json({ error: 'Extraction failed' }, { status: 500 })
  }
}
