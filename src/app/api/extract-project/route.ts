import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export async function POST(req: NextRequest) {
  try {
    const { messages } = await req.json()
    const response = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 2000,
      system: `Z konverzace extrahuj zpětnou analýzu projektu. Vrať POUZE validní JSON, bez markdown backticks:
{
  "title": "Název projektu nebo 'Projekt: hlavní téma' — konkrétní, nikdy generický",
  "description": "1–2 věty shrnutí",
  "client": "Klient nebo interní nebo null",
  "team": "Tým nebo null",
  "duration": "Délka projektu nebo null",
  "tools_used": "Seznam AI nástrojů použitých v projektu",
  "project_goal": "Cíl projektu",
  "what_worked": "Co fungovalo skvěle",
  "what_failed": "Největší výzvy nebo zklamání",
  "lessons_learned": "Poučení z projektu",
  "avoid_next_time": "Čemu se příště vyvarovat",
  "process_that_worked": "Postup který se osvědčil",
  "ai_contribution": "Jak AI přispěla k výsledku",
  "tool_ratings": [{"tool": "název", "rating": 8, "note": "komentář"}],
  "overall_rating": "číslo 1–10 nebo null",
  "would_repeat": "Zopakoval/a bys stejný přístup a co by bylo jinak",
  "status": "draft"
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
