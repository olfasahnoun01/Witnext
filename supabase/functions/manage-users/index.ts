import { createClient } from 'npm:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
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

// Decode JWT payload without verification (verification is done by Supabase)
function decodeJwtPayload(token: string): any {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) {
      return null;
    }
    const payload = parts[1];
    const decoded = atob(payload.replace(/-/g, '+').replace(/_/g, '/'));
    return JSON.parse(decoded);
  } catch {
    return null;
  }
}

Deno.serve(async (req) => {

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    
    const authHeader = req.headers.get('Authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      console.log('No authorization header')
      return new Response(JSON.stringify({ error: 'Non autorisé' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const token = authHeader.replace('Bearer ', '')
    
    // Decode JWT to get user ID
    const payload = decodeJwtPayload(token)
    if (!payload || !payload.sub) {
      console.error('Invalid JWT payload')
      return new Response(JSON.stringify({ error: 'Non autorisé' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Check if token is expired
    const now = Math.floor(Date.now() / 1000)
    if (payload.exp && payload.exp < now) {
      console.error('Token expired')
      return new Response(JSON.stringify({ error: 'Session expirée' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const requestingUserId = payload.sub as string
    console.log('Authenticated user from JWT:', requestingUserId, payload.email)

    // Create admin client for user management
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey)

    // Check if requesting user is admin
    const { data: isAdmin, error: roleError } = await supabaseAdmin.rpc('has_role', {
      _user_id: requestingUserId,
      _role: 'admin'
    })

    if (roleError) {
      console.error('Role check error:', roleError.message)
    }

    if (!isAdmin) {
      console.log('User is not admin:', requestingUserId)
      return new Response(JSON.stringify({ error: 'Accès réservé aux administrateurs' }), {
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

        const usersWithRoles = users.users.map(user => ({
          id: user.id,
          email: user.email,
          full_name: user.user_metadata?.full_name || '',
          created_at: user.created_at,
          role: roles?.find(r => r.user_id === user.id)?.role || 'user'
        }))

        return new Response(JSON.stringify({ users: usersWithRoles }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }

      case 'create': {
        const { email, password, full_name, role } = params

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

        const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
          email: email.trim(),
          password,
          email_confirm: true,
          user_metadata: { full_name: full_name?.trim() || '' }
        })

        if (createError) {
          return new Response(JSON.stringify({ error: mapErrorToUserMessage(createError) }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          })
        }

        if (newUser.user) {
          const { error: profileError } = await supabaseAdmin.from('profiles').insert({
            user_id: newUser.user.id,
            email: email.trim(),
            full_name: full_name?.trim() || null
          })

          if (profileError) {
            console.error('Error creating profile:', profileError.code)
          } else {
            console.log('Profile created for user:', newUser.user.id)
          }

          const userRole = role || 'user'
          const { error: roleError } = await supabaseAdmin.from('user_roles').insert({
            user_id: newUser.user.id,
            role: userRole
          })

          if (roleError) {
            console.error('Error assigning role:', roleError.code)
          } else {
            console.log('Role assigned:', userRole, 'for user:', newUser.user.id)
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