import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
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
          return new Response(JSON.stringify({ error: error.message }), {
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

        // Create user
        const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
          email,
          password,
          email_confirm: true,
          user_metadata: { full_name }
        })

        if (createError) {
          console.error('Error creating user:', createError.message)
          return new Response(JSON.stringify({ error: createError.message }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          })
        }

        if (newUser.user) {
          // Explicitly insert into profiles table
          const { error: profileError } = await supabaseAdmin.from('profiles').insert({
            user_id: newUser.user.id,
            email: email,
            full_name: full_name || null
          })

          if (profileError) {
            console.error('Error creating profile:', profileError.message)
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
            console.error('Error assigning role:', roleError.message)
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

        // Update user
        const updateData: any = {}
        if (password) updateData.password = password
        if (full_name !== undefined) updateData.user_metadata = { full_name }

        if (Object.keys(updateData).length > 0) {
          const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
            user_id,
            updateData
          )

          if (updateError) {
            return new Response(JSON.stringify({ error: updateError.message }), {
              status: 400,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            })
          }
        }

        // Update role if specified
        if (role) {
          // Remove existing roles
          await supabaseAdmin.from('user_roles').delete().eq('user_id', user_id)
          
          // Add new role if not 'user'
          if (role !== 'user') {
            await supabaseAdmin.from('user_roles').insert({
              user_id,
              role
            })
          }
        }

        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }

      case 'delete': {
        const { user_id } = params

        // Prevent self-deletion
        if (user_id === requestingUser.id) {
          return new Response(JSON.stringify({ error: 'Vous ne pouvez pas supprimer votre propre compte' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          })
        }

        const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(user_id)

        if (deleteError) {
          return new Response(JSON.stringify({ error: deleteError.message }), {
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
    const message = error instanceof Error ? error.message : 'Une erreur est survenue';
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
