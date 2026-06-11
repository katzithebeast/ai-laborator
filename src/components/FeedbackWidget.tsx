'use client'
import { useEffect } from 'react'
import { supabase } from '@/lib/supabase'

const SCRIPT_ID = 'wexia-feedback-script'

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

        const selector = payload.selectedElement?.selector as string | undefined
        const targetEl = selector ? document.querySelector<HTMLElement>(selector) : null
        let screenshotBase64: string | null = null

        try {
          // Flash efekt — uživatel vidí že se fotí
          const flash = document.createElement('div')
          flash.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:white;opacity:0.3;z-index:99998;pointer-events:none;transition:opacity 0.3s'
          document.body.appendChild(flash)

          // Červený outline na označeném prvku
          if (targetEl) {
            targetEl.style.outline = '4px solid #e02020'
            targetEl.style.outlineOffset = '3px'
          }

          // Skryj widget panel
          const widgetEl = document.getElementById('wexia-feedback-root')
          if (widgetEl) widgetEl.style.visibility = 'hidden'

          // Počkej 500ms aby outline byl zachycen
          await new Promise(r => setTimeout(r, 500))

          // Screenshot
          const html2canvas = (await import('html2canvas')).default
          const canvas = await html2canvas(document.body, { scale: 1, useCORS: true, logging: false })
          screenshotBase64 = canvas.toDataURL('image/png').split(',')[1]

          // Cleanup
          flash.remove()
          if (targetEl) { targetEl.style.outline = ''; targetEl.style.outlineOffset = '' }
          if (widgetEl) widgetEl.style.visibility = 'visible'
        } catch (e) {
          console.warn('Screenshot failed:', e)
        }

        const feedbackData = {
          user_id:           user?.id,
          user_email:        user?.email,
          category:          payload.category || 'bug',
          comment:           payload.comment  || '',
          element_selector:  selector         || '',
          screenshot_base64: screenshotBase64,
          url:               window.location.href,
          user_agent:        navigator.userAgent,
          timestamp:         new Date().toISOString(),
        }

        fetch('/api/feedback', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(feedbackData),
        }).catch(err => console.error('Feedback API error:', err))

        const webhookUrl = process.env.NEXT_PUBLIC_FEEDBACK_WEBHOOK_URL
        if (webhookUrl) {
          fetch(webhookUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(feedbackData),
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
    // Zabraní double init (React 18 Strict Mode)
    if (document.getElementById(SCRIPT_ID)) {
      initWidget()
      return
    }

    const script = document.createElement('script')
    script.id = SCRIPT_ID
    script.src = '/feedback-widget.min.js'
    script.async = true
    script.onload = initWidget
    document.body.appendChild(script)

    return () => {
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
