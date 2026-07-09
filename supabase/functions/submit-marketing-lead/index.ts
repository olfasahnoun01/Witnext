// @ts-nocheck
import { createClient } from 'npm:@supabase/supabase-js@2'
import { getCorsHeaders } from '../_shared/cors.ts'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const MAX_REQUESTS_PER_EMAIL_PER_HOUR = 3

type LeadType = 'trial' | 'license'
type Deployment = 'web' | 'desktop' | 'both'

interface LeadPayload {
  type: LeadType
  companyName: string
  contactName: string
  email: string
  phone?: string
  teamSize?: string
  userCount?: number
  deployment?: Deployment
  planCode?: string
  modules?: string[]
  message?: string
  sourcePath?: string
  captchaToken?: string
}

async function verifyHcaptcha(token: string, remoteIp?: string): Promise<boolean> {
  const secret = Deno.env.get('HCAPTCHA_SECRET_KEY') || Deno.env.get('HCAPTCHA_SECRET')
  if (!secret) {
    console.warn('HCAPTCHA_SECRET_KEY not set — skipping captcha verification (dev only)')
    const isProd = (Deno.env.get('DENO_ENV') || Deno.env.get('ENVIRONMENT') || '').toLowerCase() === 'production'
    return !isProd
  }

  const body = new URLSearchParams({
    secret,
    response: token,
  })
  if (remoteIp) body.set('remoteip', remoteIp)

  const res = await fetch('https://hcaptcha.com/siteverify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  })
  const data = await res.json()
  return data?.success === true
}

function sanitizeString(value: unknown, maxLen: number): string {
  return String(value ?? '').trim().slice(0, maxLen)
}

function validatePayload(raw: unknown): { ok: true; data: LeadPayload } | { ok: false; error: string } {
  if (!raw || typeof raw !== 'object') {
    return { ok: false, error: 'Corps de requête invalide' }
  }

  const p = raw as Record<string, unknown>
  const type = p.type
  if (type !== 'trial' && type !== 'license') {
    return { ok: false, error: 'Type de demande invalide' }
  }

  const email = sanitizeString(p.email, 255).toLowerCase()
  if (!EMAIL_RE.test(email)) {
    return { ok: false, error: 'Adresse email invalide' }
  }

  const companyName = sanitizeString(p.companyName, 200)
  const contactName = sanitizeString(p.contactName, 120)
  if (!companyName || !contactName) {
    return { ok: false, error: 'Société et nom du contact sont requis' }
  }

  let deployment: Deployment | undefined
  if (p.deployment != null && p.deployment !== '') {
    if (p.deployment !== 'web' && p.deployment !== 'desktop' && p.deployment !== 'both') {
      return { ok: false, error: 'Option de déploiement invalide' }
    }
    deployment = p.deployment
  }

  let userCount: number | undefined
  if (p.userCount != null && p.userCount !== '') {
    const n = Number(p.userCount)
    if (!Number.isFinite(n) || n < 1 || n > 10000) {
      return { ok: false, error: 'Nombre d\'utilisateurs invalide' }
    }
    userCount = Math.round(n)
  }

  const modules = Array.isArray(p.modules)
    ? p.modules.map((m) => sanitizeString(m, 80)).filter(Boolean).slice(0, 20)
    : []

  return {
    ok: true,
    data: {
      type,
      companyName,
      contactName,
      email,
      phone: sanitizeString(p.phone, 40) || undefined,
      teamSize: sanitizeString(p.teamSize, 40) || undefined,
      userCount,
      deployment,
      planCode: sanitizeString(p.planCode, 40) || undefined,
      modules,
      message: sanitizeString(p.message, 2000) || undefined,
      sourcePath: sanitizeString(p.sourcePath, 200) || undefined,
      captchaToken: sanitizeString(p.captchaToken, 4000) || undefined,
    },
  }
}

Deno.serve(async (req) => {
  const origin = req.headers.get('Origin')
  const corsHeaders = getCorsHeaders(origin, { extraHeaders: 'authorization, x-client-info, apikey, content-type' })

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Méthode non autorisée' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  try {
    const raw = await req.json()
    const validated = validatePayload(raw)
    if (!validated.ok) {
      return new Response(JSON.stringify({ error: validated.error }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const payload = validated.data
    const siteKey = Deno.env.get('VITE_HCAPTCHA_SITE_KEY') || Deno.env.get('HCAPTCHA_SITE_KEY')
    const captchaRequired = !!siteKey || !!(Deno.env.get('HCAPTCHA_SECRET_KEY') || Deno.env.get('HCAPTCHA_SECRET'))

    if (captchaRequired) {
      if (!payload.captchaToken) {
        return new Response(JSON.stringify({ error: 'Captcha requis' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }
      const remoteIp = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
      const captchaOk = await verifyHcaptcha(payload.captchaToken, remoteIp)
      if (!captchaOk) {
        return new Response(JSON.stringify({ error: 'Vérification captcha échouée' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabaseAdmin = createClient(supabaseUrl, serviceKey)

    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString()
    const { count, error: countError } = await supabaseAdmin
      .from('marketing_leads')
      .select('id', { count: 'exact', head: true })
      .eq('email', payload.email)
      .gte('created_at', oneHourAgo)

    if (countError) {
      console.error('rate limit check:', countError.message)
    } else if ((count ?? 0) >= MAX_REQUESTS_PER_EMAIL_PER_HOUR) {
      return new Response(
        JSON.stringify({ error: 'Trop de demandes récentes. Réessayez plus tard.' }),
        { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const { data, error } = await supabaseAdmin
      .from('marketing_leads')
      .insert({
        type: payload.type,
        status: 'new',
        company_name: payload.companyName,
        contact_name: payload.contactName,
        email: payload.email,
        phone: payload.phone ?? null,
        team_size: payload.teamSize ?? null,
        user_count: payload.userCount ?? null,
        deployment: payload.deployment ?? null,
        plan_code: payload.planCode ?? null,
        modules: payload.modules ?? [],
        message: payload.message ?? null,
        source_path: payload.sourcePath ?? null,
      })
      .select('id')
      .single()

    if (error) {
      console.error('insert marketing_leads:', error.message)
      return new Response(JSON.stringify({ error: 'Enregistrement impossible' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    return new Response(JSON.stringify({ success: true, id: data.id }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    console.error('submit-marketing-lead:', err)
    return new Response(JSON.stringify({ error: 'Erreur serveur' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
