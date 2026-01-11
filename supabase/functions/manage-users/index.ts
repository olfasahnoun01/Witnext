import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const ALLOWED_ORIGIN = Deno.env.get('ALLOWED_ORIGIN') || 'https://lptoakdzyuhkfvslgpsw.lovable.app';

const corsHeaders = {
  'Access-Control-Allow-Origin': ALLOWED_ORIGIN,
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Map database/auth errors to user-friendly messages
function mapErrorToUserMessage(error: any): string {
  // Log full error server-side for debugging
  console.error('Operation error:', error?.code, error?.message);
  
  const code = error?.code;
  const message = error?.message?.toLowerCase() || '';
  
  // Auth-specific errors
  if (message.includes('email') && message.includes('already')) {
    return 'Cette adresse email est déjà utilisée';
  }
  if (message.includes('password') && message.includes('weak')) {
    return 'Le mot de passe est trop faible';
  }
  if (message.includes('invalid email')) {
    return 'Format d\'email invalide';
  }
  
  // PostgreSQL error codes
  if (code === '23505') { // Unique violation
    if (message.includes('email')) {
      return 'Cette adresse email est déjà utilisée';
    }
    return 'Cette valeur existe déjà';
  }
  
  if (code === '23503') { // Foreign key violation
    return 'Impossible de supprimer: des données liées existent';
  }
  
  if (code === '23502') { // Not null violation
    return 'Tous les champs requis doivent être remplis';
  }
  
  if (code === 'PGRST301') { // RLS policy violation
    return 'Vous n\'avez pas les permissions nécessaires';
  }
  
  // Generic fallback
  return 'Une erreur est survenue. Veuillez réessayer.';
}

// Input validation
function validateEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email) && email.length <= 255;
}

function validatePassword(password: string): boolean {
  return !!password && password.length >= 6 && password.length <= 128;
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    
    // Get auth token from request
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Non autorisé' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Create client with user's token to check permissions
    const supabaseClient = createClient(supabaseUrl, supabaseServiceKey, {
      global: { headers: { Authorization: authHeader } }
    })

    // Get the user making the request
    const { data: { user: requestingUser }, error: userError } = await supabaseClient.auth.getUser(
      authHeader.replace('Bearer ', '')
    )

    if (userError || !requestingUser) {
      return new Response(JSON.stringify({ error: 'Non autorisé' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Check if requesting user is admin
    const { data: isAdmin } = await supabaseClient.rpc('has_role', {
      _user_id: requestingUser.id,
      _role: 'admin'
    })

    if (!isAdmin) {
      return new Response(JSON.stringify({ error: 'Accès réservé aux administrateurs' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Create admin client for user management
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey)

    const { action, ...params } = await req.json()

    switch (action) {
      case 'list': {
        // List all users with their profiles and roles
        const { data: users, error } = await supabaseAdmin.auth.admin.listUsers()
        
        if (error) {
          return new Response(JSON.stringify({ error: mapErrorToUserMessage(error) }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          })
        }

        // Get roles for all users
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

        // Validate inputs
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

        // Create user
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
          // Explicitly insert into profiles table
          const { error: profileError } = await supabaseAdmin.from('profiles').insert({
            user_id: newUser.user.id,
            email: email.trim(),
            full_name: full_name?.trim() || null
          })

          if (profileError) {
            console.error('Error creating profile:', profileError.code)
            // Don't fail the whole operation, profile might already exist from trigger
          } else {
            console.log('Profile created for user:', newUser.user.id)
          }

          // Assign role - always insert into user_roles table
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

        // Update auth user (password and metadata)
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

        // Update profiles table
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

        // Update role if specified
        if (role) {
          console.log('Updating role to:', role, 'for user:', user_id)
          // Remove existing roles
          const { error: deleteRoleError } = await supabaseAdmin.from('user_roles').delete().eq('user_id', user_id)
          if (deleteRoleError) {
            console.error('Error deleting old roles:', deleteRoleError.code)
          }
          
          // Always insert the role (including 'user')
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

        // Prevent self-deletion
        if (user_id === requestingUser.id) {
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