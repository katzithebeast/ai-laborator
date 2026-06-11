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
          const widgetEl = document.getElementById('wexia-feedback-root')
          if (widgetEl) widgetEl.style.visibility = 'hidden'

          // Overlay div s červeným rámečkem (border = html2canvas ho renderuje, outline ne)
          let overlay: HTMLDivElement | null = null
          if (targetEl) {
            const rect = targetEl.getBoundingClientRect()
            overlay = document.createElement('div')
            Object.assign(overlay.style, {
              position: 'fixed',
              left: `${rect.left - 4}px`,
              top: `${rect.top - 4}px`,
              width: `${rect.width + 8}px`,
              height: `${rect.height + 8}px`,
              border: '4px solid #e02020',
              borderRadius: '4px',
              background: 'rgba(224,32,32,0.07)',
              zIndex: '2147480000',
              pointerEvents: 'none',
              boxSizing: 'border-box',
            })
            document.body.appendChild(overlay)
          }

          // Flash efekt pro UX (odstraní se před screenshotem)
          const flash = document.createElement('div')
          Object.assign(flash.style, {
            position: 'fixed', top: '0', left: '0',
            width: '100%', height: '100%',
            background: 'white', opacity: '0.35',
            zIndex: '2147481000', pointerEvents: 'none',
          })
          document.body.appendChild(flash)

          // Flash trvá 200ms, pak zmizí a screenshot jde bez bílého přebarvení
          await new Promise(r => setTimeout(r, 200))
          flash.remove()

          // Krátká pauza aby browser překreslil (overlay viditelný, flash pryč)
          await new Promise(r => setTimeout(r, 100))

          // Screenshot — overlay div s border bude zachycen
          const html2canvas = (await import('html2canvas')).default
          const canvas = await html2canvas(document.body, { scale: 1, useCORS: true, logging: false })
          screenshotBase64 = canvas.toDataURL('image/png').split(',')[1]

          // Cleanup
          overlay?.remove()
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
