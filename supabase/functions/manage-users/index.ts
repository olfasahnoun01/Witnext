// @ts-nocheck
import { createClient } from 'npm:@supabase/supabase-js@2'

const ALLOWED_ORIGINS = [
  'https://rnujsdxbkndvppjqjkdu.supabase.co',
  'https://zfnhihbttwmrldcbaige.supabase.co',
  'https://grosafe-stock-website.lovable.app',
  'https://lptoakdzyuhkfvslgpsw.lovable.app',
  'https://grosafe-stock.lovable.app',
  'http://localhost:8080',
  'http://localhost:5173'
];

function getCorsHeaders(origin: string | null): Record<string, string> {
  const allowedOrigin = origin && (
    ALLOWED_ORIGINS.some(allowed => origin === allowed) || 
    origin.startsWith('http://localhost') ||
    origin.endsWith('.lovable.app') || 
    origin.endsWith('.lovableproject.com')
  ) ? origin : ALLOWED_ORIGINS[0];
  
  return {
    'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  };
}

// Map database/auth errors to user-friendly messages
function mapErrorToUserMessage(error: any): string {
  console.error('Operation error:', error?.code, error?.message);
  
  const code = error?.code;
  const message = error?.message?.toLowerCase() || '';
  
  if (message.includes('email') && message.includes('already')) {
    return 'Cette adresse email est déjà utilisée';
  }
  if (message.includes('password') && message.includes('weak')) {
    return 'Le mot de passe est trop faible';
  }
  if (message.includes('invalid email')) {
    return 'Format d\'email invalide';
  }
  
  if (code === '23505') {
    if (message.includes('email')) {
      return 'Cette adresse email est déjà utilisée';
    }
    return 'Cette valeur existe déjà';
  }
  
  if (code === '23503') {
    return 'Impossible de supprimer: des données liées existent';
  }
  
  if (code === '23502') {
    return 'Tous les champs requis doivent être remplis';
  }
  
  if (code === 'PGRST301') {
    return 'Vous n\'avez pas les permissions nécessaires';
  }
  
  return 'Une erreur est survenue. Veuillez réessayer.';
}

function validateEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email) && email.length <= 255;
}

function validatePassword(password: string): boolean {
  return !!password && password.length >= 6 && password.length <= 128;
}

Deno.serve(async (req: Request) => {
  const origin = req.headers.get('Origin');
  const corsHeaders = getCorsHeaders(origin);

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    
    const authHeader = req.headers.get('Authorization')
    const token = authHeader?.replace('Bearer ', '')

    if (!token || token === 'undefined' || token === 'null') {
      return new Response(JSON.stringify({ error: 'Token manquant' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Verify JWT cryptographically using Supabase auth (no manual decode!)
    const supabaseAuthClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader! } }
    });
    const { data: userData, error: userError } = await supabaseAuthClient.auth.getUser(token);

    if (userError || !userData?.user) {
      console.error('JWT verification failed:', userError?.message);
      return new Response(JSON.stringify({ error: 'Session invalide' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const requestingUserId = userData.user.id;

    // Use service key to bypass RLS for admin check
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey)

    // Check if requesting user is admin
    const { data: userRole, error: roleError } = await supabaseAdmin
      .from('user_roles')
      .select('role')
      .eq('user_id', requestingUserId)
      .eq('role', 'admin')
      .maybeSingle()

    if (roleError || !userRole) {
      console.log('User is not admin or role error:', requestingUserId, roleError)
      return new Response(JSON.stringify({ 
        error: 'Accès réservé aux administrateurs',
        debug: { userId: requestingUserId }
      }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    console.log('Admin access granted for:', requestingUserId)

    const { action, ...params } = await req.json()

    switch (action) {
      case 'list': {
        const { data: users, error } = await supabaseAdmin.auth.admin.listUsers()
        
        if (error) {
          return new Response(JSON.stringify({ error: mapErrorToUserMessage(error) }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          })
        }

        const { data: roles } = await supabaseAdmin
          .from('user_roles')
          .select('user_id, role')

        const usersWithRoles = users.users.map((user: any) => ({
          id: user.id,
          email: user.email,
          full_name: user.user_metadata?.full_name || '',
          created_at: user.created_at,
          role: roles?.find((r: any) => r.user_id === user.id)?.role || 'user'
        }))

        return new Response(JSON.stringify({ users: usersWithRoles }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }

      case 'create': {
        const { email, password, full_name, role } = params
        console.log('Starting user creation for:', email)

        if (!email || !validateEmail(email)) {
          return new Response(JSON.stringify({ error: 'Format d\'email invalide' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          })
        }

        if (!password || !validatePassword(password)) {
          return new Response(JSON.stringify({ error: 'Le mot de passe doit contenir entre 6 et 128 caractères' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          })
        }

        // 1. Create the Auth User
        const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
          email: email.trim(),
          password,
          email_confirm: true,
          user_metadata: { full_name: full_name?.trim() || '' }
        })

        if (createError) {
          console.error('Auth creation failed:', createError.message)
          return new Response(JSON.stringify({ error: mapErrorToUserMessage(createError) }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          })
        }

        if (newUser.user) {
          const userId = newUser.user.id
          console.log('Auth user created:', userId)

          // 2. Upsert the Profile (handles existing profiles with same email)
          const { error: profileError } = await supabaseAdmin.from('profiles').upsert({
            user_id: userId,
            email: email.trim(),
            full_name: full_name?.trim() || null
          }, { onConflict: 'user_id' })

          if (profileError) {
            console.error('Profile upsert error:', profileError.code, profileError.message)
          }

          // 3. Upsert the Role
          const userRole = role || 'user'
          const { error: roleError } = await supabaseAdmin.from('user_roles').upsert({
            user_id: userId,
            role: userRole
          }, { onConflict: 'user_id,role' })

          if (roleError) {
            console.error('Role assignment error:', roleError.code, roleError.message)
          }
        }

        return new Response(JSON.stringify({ success: true, user: newUser.user }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }

      case 'update': {
        const { user_id, password, full_name, role } = params
        
        if (!user_id) {
          return new Response(JSON.stringify({ error: 'ID utilisateur requis' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          })
        }

        console.log('Updating user:', user_id, 'password provided:', !!password)

        const updateData: any = {}
        if (password) {
          if (!validatePassword(password)) {
            return new Response(JSON.stringify({ error: 'Le mot de passe doit contenir entre 6 et 128 caractères' }), {
              status: 400,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            })
          }
          updateData.password = password
          console.log('Password will be updated for user:', user_id)
        }
        if (full_name !== undefined) {
          updateData.user_metadata = { full_name: full_name?.trim() || '' }
        }

        if (Object.keys(updateData).length > 0) {
          const { data: updatedUser, error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
            user_id,
            updateData
          )

          if (updateError) {
            return new Response(JSON.stringify({ error: mapErrorToUserMessage(updateError) }), {
              status: 400,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            })
          }
          console.log('Auth user updated successfully:', updatedUser?.user?.id)
        }

        if (full_name !== undefined) {
          const { error: profileError } = await supabaseAdmin
            .from('profiles')
            .update({ full_name: full_name?.trim() || '', updated_at: new Date().toISOString() })
            .eq('user_id', user_id)
          
          if (profileError) {
            console.error('Error updating profile:', profileError.code)
          } else {
            console.log('Profile updated for user:', user_id)
          }
        }

        if (role) {
          console.log('Updating role to:', role, 'for user:', user_id)
          const { error: deleteRoleError } = await supabaseAdmin.from('user_roles').delete().eq('user_id', user_id)
          if (deleteRoleError) {
            console.error('Error deleting old roles:', deleteRoleError.code)
          }
          
          const { error: insertRoleError } = await supabaseAdmin.from('user_roles').insert({
            user_id,
            role
          })
          if (insertRoleError) {
            console.error('Error inserting new role:', insertRoleError.code)
          } else {
            console.log('Role updated to:', role, 'for user:', user_id)
          }
        }

        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }

      case 'delete': {
        const { user_id } = params

        if (!user_id) {
          return new Response(JSON.stringify({ error: 'ID utilisateur requis' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          })
        }

        if (user_id === requestingUserId) {
          return new Response(JSON.stringify({ error: 'Vous ne pouvez pas supprimer votre propre compte' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          })
        }

        const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(user_id)

        if (deleteError) {
          return new Response(JSON.stringify({ error: mapErrorToUserMessage(deleteError) }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          })
        }

        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }

      default:
        return new Response(JSON.stringify({ error: 'Action non reconnue' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
    }
  } catch (error: unknown) {
    console.error('Manage users error:', error instanceof Error ? error.message : 'Unknown error');
    return new Response(JSON.stringify({ error: 'Une erreur est survenue. Veuillez réessayer.' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})