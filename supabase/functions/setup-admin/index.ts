import { createClient } from 'npm:@supabase/supabase-js@2'

const ALLOWED_ORIGIN = Deno.env.get('ALLOWED_ORIGIN') || '*';

const corsHeaders = {
  'Access-Control-Allow-Origin': ALLOWED_ORIGIN,
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-setup-token',
}

// Input validation
const MAX_EMAIL_LENGTH = 255;
const MAX_PASSWORD_LENGTH = 128;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function validateInput(email: string, password: string): string | null {
  if (!email || typeof email !== 'string') {
    return 'Email requis';
  }
  if (!password || typeof password !== 'string') {
    return 'Mot de passe requis';
  }
  if (email.length > MAX_EMAIL_LENGTH) {
    return `Email trop long (max ${MAX_EMAIL_LENGTH} caractères)`;
  }
  if (password.length < 6) {
    return 'Le mot de passe doit contenir au moins 6 caractères';
  }
  if (password.length > MAX_PASSWORD_LENGTH) {
    return `Mot de passe trop long (max ${MAX_PASSWORD_LENGTH} caractères)`;
  }
  if (!EMAIL_REGEX.test(email)) {
    return 'Format d\'email invalide';
  }
  return null;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const setupToken = Deno.env.get('SETUP_ADMIN_TOKEN')
    
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey)

    // Check if any admin already exists
    const { data: existingAdmins } = await supabaseAdmin
      .from('user_roles')
      .select('id')
      .eq('role', 'admin')
      .limit(1)

    if (existingAdmins && existingAdmins.length > 0) {
      return new Response(JSON.stringify({ error: 'Un administrateur existe déjà' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    if (!setupToken) {
      console.error('SETUP_ADMIN_TOKEN is not configured — refusing bootstrap')
      return new Response(JSON.stringify({ error: 'Configuration serveur incomplète' }), {
        status: 503,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const providedToken = req.headers.get('X-Setup-Token')
    if (!providedToken || providedToken !== setupToken) {
      console.warn('Invalid setup token attempt')
      return new Response(JSON.stringify({ error: 'Token de configuration invalide' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const body = await req.json()
    const email = body.email?.trim()
    const password = body.password

    // Validate inputs
    const validationError = validateInput(email, password)
    if (validationError) {
      return new Response(JSON.stringify({ error: validationError }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Create admin user
    const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: 'Administrateur' }
    })

    if (createError) {
      console.error('Error creating user:', createError.code)
      // Map error to user-friendly message
      let userMessage = 'Erreur lors de la création du compte';
      if (createError.message?.includes('email')) {
        userMessage = 'Cette adresse email est déjà utilisée';
      }
      return new Response(JSON.stringify({ error: userMessage }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Assign admin role
    const { error: roleError } = await supabaseAdmin.from('user_roles').insert({
      user_id: newUser.user.id,
      role: 'admin'
    })

    if (roleError) {
      console.error('Error assigning role:', roleError.code)
      return new Response(JSON.stringify({ error: 'Erreur lors de l\'attribution du rôle' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    console.log('Admin user created successfully:', email)

    return new Response(JSON.stringify({ 
      success: true, 
      message: 'Compte administrateur créé avec succès' 
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (error: unknown) {
    console.error('Setup admin error:', error instanceof Error ? error.message : 'Unknown error')
    return new Response(JSON.stringify({ error: 'Une erreur est survenue' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})