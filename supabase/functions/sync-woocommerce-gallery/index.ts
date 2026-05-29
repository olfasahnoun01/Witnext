// @ts-nocheck
import { createClient } from 'npm:@supabase/supabase-js@2'

const STATIC_ALLOWED_ORIGINS = [
  'https://grosafe-stock-website.lovable.app',
  'https://grosafe-stock.lovable.app',
  'https://lptoakdzyuhkfvslgpsw.lovable.app',
  'http://localhost:8080',
  'http://localhost:5173',
  'http://127.0.0.1:8080',
  'http://127.0.0.1:5173',
]

function isAllowedOrigin(origin: string): boolean {
  const projectUrl = Deno.env.get('SUPABASE_URL') || ''
  return (
    (!!projectUrl && origin === projectUrl) ||
    STATIC_ALLOWED_ORIGINS.includes(origin) ||
    origin.startsWith('http://localhost:') ||
    origin.startsWith('http://127.0.0.1:') ||
    origin.endsWith('.lovable.app') ||
    origin.endsWith('.lovableproject.com')
  )
}

function getCorsHeaders(origin: string | null): Record<string, string> {
  const allowedOrigin = origin && isAllowedOrigin(origin) ? origin : (origin ?? '*')

  return {
    'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Allow-Headers':
      'authorization, x-client-info, apikey, content-type, x-supabase-client-platform',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  }
}

function normalizeStoreUrl(raw: string): string {
  return raw.replace(/\/+$/, '')
}

function wcAuthHeader(key: string, secret: string): string {
  const token = btoa(`${key}:${secret}`)
  return `Basic ${token}`
}

type WcCategory = { id: number; name: string; slug?: string }
type WcImage = { src: string }
type WcProduct = {
  id: number
  name: string
  status: string
  type: string
  categories?: { id: number; name: string }[]
  images?: WcImage[]
}

async function fetchWcPaginated<T>(
  baseUrl: string,
  path: string,
  auth: string,
): Promise<T[]> {
  const all: T[] = []
  let page = 1
  const perPage = 100

  while (true) {
    const url = `${baseUrl}/wp-json/wc/v3/${path}?per_page=${perPage}&page=${page}`
    const res = await fetch(url, {
      headers: { Authorization: auth, Accept: 'application/json' },
    })

    if (!res.ok) {
      const body = await res.text()
      throw new Error(`WooCommerce ${path} page ${page}: ${res.status} ${body.slice(0, 200)}`)
    }

    const batch = (await res.json()) as T[]
    all.push(...batch)

    const totalPages = parseInt(res.headers.get('X-WP-TotalPages') || '1', 10)
    if (page >= totalPages || batch.length === 0) break
    page += 1
  }

  return all
}

function categoryNameForProduct(
  product: WcProduct,
  categoryById: Map<number, string>,
): string {
  const cats = product.categories || []
  if (cats.length === 0) return 'Sans catégorie'
  const first = cats[0]
  const name = first.name?.trim() || categoryById.get(first.id) || ''
  if (!name || name === 'Général' || name.toLowerCase() === 'uncategorized') {
    return 'Sans catégorie'
  }
  return name
}

Deno.serve(async (req: Request) => {
  const origin = req.headers.get('Origin')
  const corsHeaders = getCorsHeaders(origin)

  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders })
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  try {
    const storeUrl = Deno.env.get('WOOCOMMERCE_URL')
    const consumerKey = Deno.env.get('WOOCOMMERCE_CONSUMER_KEY')
    const consumerSecret = Deno.env.get('WOOCOMMERCE_CONSUMER_SECRET')

    if (!storeUrl || !consumerKey || !consumerSecret) {
      return new Response(
        JSON.stringify({
          error:
            'Configuration WooCommerce manquante (WOOCOMMERCE_URL, WOOCOMMERCE_CONSUMER_KEY, WOOCOMMERCE_CONSUMER_SECRET).',
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

    const authHeader = req.headers.get('Authorization')
    const token = authHeader?.replace('Bearer ', '')
    if (!token) {
      return new Response(JSON.stringify({ error: 'Non authentifié' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const supabaseUser = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    })

    const {
      data: { user },
      error: userError,
    } = await supabaseUser.auth.getUser()
    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Session invalide' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const { data: canVentes, error: permError } = await supabaseUser.rpc('user_has_app_section', {
      p_section_key: 'ventes',
    })
    if (permError || !canVentes) {
      return new Response(JSON.stringify({ error: 'Accès refusé : section Ventes requise' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const baseUrl = normalizeStoreUrl(storeUrl)
    const auth = wcAuthHeader(consumerKey, consumerSecret)

    const wcCategories = await fetchWcPaginated<WcCategory>(baseUrl, 'products/categories', auth)
    const wcProducts = await fetchWcPaginated<WcProduct>(baseUrl, 'products', auth)

    const published = wcProducts.filter(
      (p) => p.status === 'publish' && p.type !== 'variation',
    )

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey)

    const categoryById = new Map<number, string>()
    let categoriesUpserted = 0

    for (const cat of wcCategories) {
      const name = cat.name?.trim()
      if (!name || name === 'Général') continue

      const { data: byWc } = await supabaseAdmin
        .from('gallery_categories')
        .select('id')
        .eq('woocommerce_id', cat.id)
        .maybeSingle()

      if (byWc) {
        await supabaseAdmin.from('gallery_categories').update({ name }).eq('id', byWc.id)
      } else {
        const { data: byName } = await supabaseAdmin
          .from('gallery_categories')
          .select('id')
          .eq('name', name)
          .maybeSingle()

        if (byName) {
          await supabaseAdmin
            .from('gallery_categories')
            .update({ woocommerce_id: cat.id })
            .eq('id', byName.id)
        } else {
          await supabaseAdmin.from('gallery_categories').insert({ name, woocommerce_id: cat.id })
        }
      }
      categoryById.set(cat.id, name)
      categoriesUpserted += 1
    }

    const { data: existingItems } = await supabaseAdmin
      .from('gallery_items')
      .select('id, woocommerce_id, description, prix_vente_ttc, fiches_techniques')
      .not('woocommerce_id', 'is', null)

    const existingByWcId = new Map(
      (existingItems || []).map((row: { woocommerce_id: number; id: number; description: unknown; prix_vente_ttc: unknown; fiches_techniques: unknown }) => [
        row.woocommerce_id,
        row,
      ]),
    )

    let itemsCreated = 0
    let itemsUpdated = 0

    for (const product of published) {
      const name = product.name?.trim()
      if (!name) continue

      const category = categoryNameForProduct(product, categoryById)
      const photos = (product.images || [])
        .map((img) => img.src)
        .filter((src): src is string => typeof src === 'string' && src.length > 0)

      const existing = existingByWcId.get(product.id)

      if (existing) {
        const { error } = await supabaseAdmin
          .from('gallery_items')
          .update({
            name,
            category,
            photos,
            updated_at: new Date().toISOString(),
          })
          .eq('id', existing.id)

        if (error) {
          console.error('gallery_items update', product.id, error.message)
          continue
        }
        itemsUpdated += 1
      } else {
        const { error } = await supabaseAdmin.from('gallery_items').insert({
          name,
          category,
          photos,
          description: null,
          prix_vente_ttc: null,
          prix_achat_ttc: null,
          fiches_techniques: [],
          devis_fichiers: [],
          woocommerce_id: product.id,
          created_by: user.id,
        })

        if (error) {
          console.error('gallery_items insert', product.id, error.message)
          continue
        }
        itemsCreated += 1
      }
    }

    return new Response(
      JSON.stringify({
        ok: true,
        categories: categoriesUpserted,
        products: published.length,
        created: itemsCreated,
        updated: itemsUpdated,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  } catch (err) {
    console.error('sync-woocommerce-gallery', err)
    const message = err instanceof Error ? err.message : 'Erreur inconnue'
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
