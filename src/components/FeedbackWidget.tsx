'use client'
import { useEffect } from 'react'
import { supabase } from '@/lib/supabase'

const SCRIPT_ID = 'wexia-feedback-script'

// Poslední prvek na který uživatel klikl — fallback když widget.element chybí
let lastClicked: { selector: string; html: string } | null = null

function buildSelector(el: Element): string {
  let sel = el.tagName.toLowerCase()
  if (el.id) sel += `#${el.id}`
  el.classList.forEach(c => { sel += `.${c}` })
  return sel
}

function showToast(message: string) {
  document.getElementById('feedback-toast')?.remove()
  const el = document.createElement('div')
  el.id = 'feedback-toast'
  el.textContent = message
  el.style.cssText = [
    'position:fixed',
    'top:24px',
    'left:50%',
    'transform:translateX(-50%)',
    'background:#16a34a',
    'color:#fff',
    'padding:14px 28px',
    'border-radius:10px',
    'font-size:15px',
    'font-weight:600',
    'z-index:2147483647',
    'box-shadow:0 4px 16px rgba(0,0,0,0.3)',
    'pointer-events:none',
  ].join(';')
  document.body.appendChild(el)
  setTimeout(() => el.remove(), 3500)
}

function initWidget() {
  if (!window.WexiaFeedback) return

  window.WexiaFeedback.destroy?.()
  window.WexiaFeedback.init({
    branding: {
      accentColor: '#e02020',
      buttonIcon: 'bug',
      buttonLabel: 'Nahlásit',
      panelTitle: 'Nahlásit chybu',
      position: 'bottom-right',
      locale: 'cs',
      showLabel: false,
      launcherStyle: 'minimal'
    },
    categories: [
      { value: 'bug', label: 'Bug' },
      { value: 'design', label: 'Design' },
      { value: 'text', label: 'Text' },
      { value: 'feature', label: 'Funkce' },
      { value: 'ux', label: 'UX/Usability' }
    ],
    labels: {
      pickHint: 'Klikni na prvek který chceš nahlásit',
      category: 'Kategorie',
      comment: 'Komentář',
      commentPlaceholder: 'Co je špatně?',
      send: 'Odeslat',
      cancel: 'Zrušit',
      sending: 'Odesílám...',
      sent: 'Odesláno ✓',
      missingComment: 'Prosím napiš komentář'
    },
    screenshot: { enabled: true, maxScale: 2 },
    onSubmit: async (payload: any) => {
      showToast('✓ Feedback úspěšně odeslán')

      try {
        const { data: { user } } = await supabase.auth.getUser()
        const raw = payload.screenshot as string | null | undefined
        const screenshotBase64 = raw
          ? raw.replace(/^data:image\/\w+;base64,/, '')
          : null

        // Priorita: widget.element (uživatel klikl přes pick mode) → lastClicked (poslední klik)
        const elementSelector = payload.element?.selector || lastClicked?.selector || ''
        const elementHtml = payload.element
          ? document.querySelector(payload.element.selector)?.outerHTML || ''
          : lastClicked?.html || ''

        const feedbackData = {
          user_id: user?.id,
          user_email: user?.email,
          category: payload.category || 'bug',
          comment: payload.comment || '',
          element_selector: elementSelector,
          element_html: elementHtml,
          screenshot: screenshotBase64,
          screenshot_mime: raw ? (raw.match(/^data:(image\/\w+);base64,/)?.[1] ?? 'image/png') : null,
          url: window.location.href,
          user_agent: navigator.userAgent,
          timestamp: new Date().toISOString()
        }

        supabase.from('feedback').insert(feedbackData)
          .then((res) => { if (res.error) console.error('Feedback DB error:', res.error) })

        const webhookUrl = process.env.NEXT_PUBLIC_FEEDBACK_WEBHOOK_URL
        if (webhookUrl) {
          fetch(webhookUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(feedbackData)
          }).catch(err => console.error('Feedback webhook error:', err))
        }
      } catch (err) {
        console.error('Feedback submission error:', err)
      }
    }
  })
}

export function FeedbackWidget() {
  useEffect(() => {
    // Sleduj poslední kliknutý prvek (mimo widget tlačítko)
    const onMouseDown = (e: MouseEvent) => {
      const target = e.target as Element | null
      if (!target || target.closest('[id^="wexia"]') || target.closest('#feedback-toast')) return
      lastClicked = {
        selector: buildSelector(target),
        html: target.outerHTML.slice(0, 2000), // limit aby se neukládaly obří prvky
      }
    }
    document.addEventListener('mousedown', onMouseDown)

    // Zabrání double init (React 18 Strict Mode)
    if (document.getElementById(SCRIPT_ID)) {
      initWidget()
    } else {
      const script = document.createElement('script')
      script.id = SCRIPT_ID
      script.src = '/feedback-widget.min.js'
      script.async = true
      script.onload = initWidget
      document.body.appendChild(script)
    }

    return () => {
      document.removeEventListener('mousedown', onMouseDown)
      window.WexiaFeedback?.destroy?.()
    }
  }, [])

  return null
}

declare global {
  interface Window {
    WexiaFeedback?: {
      init: (config: any) => void
      destroy: () => void
      autoInit: () => void
      VERSION: string
    }
  }
}
