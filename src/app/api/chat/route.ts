import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

const SYSTEM = `Jsi AI asistent pro firemní laboratoř AI nástrojů.
Pomáháš vytvářet use cases pro AI nástroje, které firma testuje.

Workflow:
1. Nasloucháš popisu od uživatele
2. Pokládáš VŽDY jen jednu doplňující otázku
3. Zjišťuješ: Jaký problém? Kdo to použije? Jak zapadá do workflow? Přínosy? Rizika?
4. Po 3–5 výměnách nabídneš use case draft

Formát use case draftu (markdown):
## [Název]
**Nástroj:** ...
**Tým:** ...
**Problém:** ...
**Řešení:** ...
**Přínosy:** (seznam)
**Rizika:** (seznam)
**Náročnost:** Nízká / Střední / Vysoká
**Dopad:** Nízký / Střední / Vysoký

Pravidla: česky, přátelsky, jedna otázka najednou, buď konkrétní.`

export async function POST(req: NextRequest) {
  try {
    const { messages, mode } = await req.json()
    const response = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1500,
      system: mode === 'interview'
        ? SYSTEM + '\n\nJsi v INTERVIEW módu — buď strukturovanější, projdi všechny aspekty.'
        : SYSTEM,
      messages,
    })
    const text = response.content[0].type === 'text' ? response.content[0].text : ''
    return NextResponse.json({ content: text })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
