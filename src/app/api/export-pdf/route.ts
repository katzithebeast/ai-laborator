import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { google } from 'googleapis'
import PDFDocument from 'pdfkit'
import { Readable } from 'stream'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

function val(v: unknown): string {
  if (v === null || v === undefined || v === '') return ''
  return String(v)
}

function buildPdf(uc: Record<string, unknown>): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50, size: 'A4' })
    const chunks: Buffer[] = []
    doc.on('data', (chunk: Buffer) => chunks.push(chunk))
    doc.on('end', () => resolve(Buffer.concat(chunks)))
    doc.on('error', reject)

    const RED = '#e02020'
    const GRAY = '#555555'
    const LGRAY = '#888888'
    const pageWidth = doc.page.width - 100

    const section = (title: string) => {
      doc.moveDown(0.5)
      doc.fontSize(9).fillColor(LGRAY).font('Helvetica-Bold')
        .text(title.toUpperCase(), { characterSpacing: 0.8 })
      doc.moveTo(50, doc.y).lineTo(50 + pageWidth, doc.y)
        .strokeColor('#dddddd').lineWidth(0.5).stroke()
      doc.moveDown(0.3)
    }

    const field = (label: string, value: unknown) => {
      if (!val(value)) return
      doc.fontSize(9).fillColor(LGRAY).font('Helvetica-Bold').text(label.toUpperCase(), { characterSpacing: 0.5 })
      doc.fontSize(11).fillColor(GRAY).font('Helvetica').text(val(value), { lineGap: 2 })
      doc.moveDown(0.4)
    }

    // ── Hlavička ──
    doc.fontSize(22).fillColor(RED).font('Helvetica-Bold').text(val(uc.title))
    doc.moveDown(0.3)
    const meta: string[] = []
    if (uc.tool_name) meta.push(`Nástroj: ${val(uc.tool_name)}`)
    if (uc.team) meta.push(`Tým: ${val(uc.team)}`)
    if (uc.author_name) meta.push(`Autor: ${val(uc.author_name)}`)
    meta.push(`Datum: ${new Date(val(uc.created_at)).toLocaleDateString('cs-CZ')}`)
    doc.fontSize(10).fillColor(LGRAY).font('Helvetica').text(meta.join('   ·   '))

    if (val(uc.description)) {
      doc.moveDown(0.5)
      doc.fontSize(12).fillColor(GRAY).font('Helvetica-Oblique').text(val(uc.description))
    }

    // ── Hodnocení (prominentní) ──
    doc.moveDown(0.8)
    const rating = uc.rating ? `${val(uc.rating)}/10` : null
    const recommended = uc.recommended ? `Doporučení: ${val(uc.recommended)}` : null
    if (rating || recommended) {
      doc.fontSize(28).fillColor(RED).font('Helvetica-Bold').text(rating ?? '', { continued: !!recommended })
      if (recommended && rating) {
        doc.fontSize(12).fillColor(GRAY).font('Helvetica').text(`   ${recommended}`, { continued: false })
      } else if (recommended) {
        doc.fontSize(12).fillColor(GRAY).font('Helvetica').text(recommended)
      }
    }

    const badges: string[] = []
    if (uc.effort) badges.push(`Náročnost: ${val(uc.effort)}`)
    if (uc.impact) badges.push(`Dopad: ${val(uc.impact)}`)
    if (uc.category) badges.push(`Kategorie: ${val(uc.category)}`)
    if (badges.length) {
      doc.moveDown(0.3)
      doc.fontSize(10).fillColor(LGRAY).font('Helvetica').text(badges.join('   ·   '))
    }

    const tags = Array.isArray(uc.tags) ? (uc.tags as string[]) : []
    if (tags.length) {
      doc.moveDown(0.2)
      doc.fontSize(10).fillColor(LGRAY).font('Helvetica').text('Tagy: ' + tags.join(', '))
    }

    // ── Základní přehled ──
    section('Základní přehled')
    field('Účel nástroje', uc.purpose)
    field('Podobné nástroje', uc.similar_tools)
    field('Cena', uc.pricing)

    // ── Přínos pro byznys ──
    section('Přínos pro byznys')
    field('Pro která oddělení / role', uc.best_for_roles)
    field('Úspora času', uc.time_saved)
    field('Aha! moment', uc.aha_moment)

    // ── Uživatelská přívětivost ──
    section('Uživatelská přívětivost')
    field('Onboarding (1–5)', uc.onboarding_score)
    field('UI intuitivní?', uc.ui_intuitive)

    // ── Výkon AI ──
    section('Výkon AI')
    field('Kvalita výstupů', uc.output_quality)
    field('Halucinace', uc.hallucinates)

    // ── Rizika ──
    section('Rizika')
    field('Slabiny', uc.weaknesses)
    field('Bezpečnostní rizika', uc.security_risks)
    field('Limity nástroje', uc.limitations)

    // ── Patička ──
    doc.moveDown(1)
    doc.fontSize(8).fillColor(LGRAY).font('Helvetica')
      .text('Vygenerováno systémem AI Laboratoř · ' + new Date().toLocaleDateString('cs-CZ'))

    doc.end()
  })
}

async function uploadToDrive(pdfBuffer: Buffer, filename: string): Promise<string> {
  const keyJson = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_KEY!)
  const auth = new google.auth.GoogleAuth({
    credentials: keyJson,
    scopes: ['https://www.googleapis.com/auth/drive.file'],
  })
  const drive = google.drive({ version: 'v3', auth })
  const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID!

  const readable = Readable.from(pdfBuffer)

  const res = await drive.files.create({
    requestBody: {
      name: filename,
      parents: [folderId],
      mimeType: 'application/pdf',
    },
    media: {
      mimeType: 'application/pdf',
      body: readable,
    },
    fields: 'id,webViewLink',
  })

  return res.data.webViewLink ?? `https://drive.google.com/file/d/${res.data.id}/view`
}

export async function POST(req: NextRequest) {
  if (!process.env.GOOGLE_SERVICE_ACCOUNT_KEY || !process.env.GOOGLE_DRIVE_FOLDER_ID) {
    return NextResponse.json({ skipped: true, reason: 'Google Drive není nakonfigurován' })
  }

  try {
    const { useCaseId } = await req.json()
    if (!useCaseId) return NextResponse.json({ error: 'Chybí useCaseId' }, { status: 400 })

    const { data: uc, error } = await supabase
      .from('use_cases')
      .select('*')
      .eq('id', useCaseId)
      .single()

    if (error || !uc) return NextResponse.json({ error: 'Use case nenalezen' }, { status: 404 })

    const toolSlug = (uc.tool_name ?? 'UseCase').replace(/[^a-z0-9]/gi, '_')
    const dateStr = new Date().toISOString().slice(0, 10)
    const filename = `UseCase_${toolSlug}_${dateStr}.pdf`

    const pdfBuffer = await buildPdf(uc as Record<string, unknown>)
    const driveUrl = await uploadToDrive(pdfBuffer, filename)

    return NextResponse.json({ success: true, url: driveUrl, filename })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
