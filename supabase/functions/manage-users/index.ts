// @ts-nocheck
import { createClient } from 'npm:@supabase/supabase-js@2'
import { getCorsHeaders } from '../_shared/cors.ts'

function mapErrorToUserMessage(error: any): string {
  console.error('Operation error:', error?.code, error?.message)

  const code = error?.code
  const message = error?.message?.toLowerCase() || ''

  if (message.includes('email') && message.includes('already')) {
    return 'Cette adresse email est déjà utilisée'
  }
  if (message.includes('password') && message.includes('weak')) {
    return 'Le mot de passe est trop faible'
  }
  if (message.includes('invalid email')) {
    return "Format d'email invalide"
  }

  if (code === '23505') {
    if (message.includes('email')) {
      return 'Cette adresse email est déjà utilisée'
    }
    return 'Cette valeur existe déjà'
  }

  if (code === '23503') {
    return 'Impossible de supprimer: des données liées existent'
  }

  if (code === '23502') {
    return 'Tous les champs requis doivent être remplis'
  }

  if (code === 'PGRST301') {
    return "Vous n'avez pas les permissions nécessaires"
  }

  return 'Une erreur est survenue. Veuillez réessayer.'
}

function validateEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  return emailRegex.test(email) && email.length <= 255
}

function validatePassword(password: string): boolean {
  return !!password && password.length >= 12 && password.length <= 128
}

type RequesterContext = {
  isPlatformAdmin: boolean
  isAppAdmin: boolean
  tenantIds: string[]
  canManageUsers: boolean
}

async function getRequesterContext(
  supabaseAdmin: ReturnType<typeof createClient>,
  requestingUserId: string
): Promise<RequesterContext> {
  const [{ data: platformRow }, { data: roleRows }, { data: memberships }] = await Promise.all([
    supabaseAdmin.from('platform_admins').select('user_id').eq('user_id', requestingUserId).maybeSingle(),
    supabaseAdmin.from('user_roles').select('role').eq('user_id', requestingUserId),
    supabaseAdmin.from('tenant_members').select('tenant_id, role').eq('user_id', requestingUserId),
  ])

  const isPlatformAdmin = !!platformRow?.user_id
  const isAppAdmin = (roleRows || []).some((r: { role: string }) => r.role === 'admin')
  const tenantIds = [...new Set((memberships || []).map((m: { tenant_id: string }) => m.tenant_id))]

  // Platform operators, or company/tenant admins (legacy app admin role).
  const canManageUsers = isPlatformAdmin || isAppAdmin

  return { isPlatformAdmin, isAppAdmin, tenantIds, canManageUsers }
}

function forbidAdminRoleIfNotRequesterAdmin(
  roleToAssign: string | undefined | null,
  requesterIsAdmin: boolean,
  corsHeaders: Record<string, string>
): Response | null {
  const normalized = String(roleToAssign ?? 'user')
    .trim()
    .toLowerCase()
  if (normalized === 'admin' && !requesterIsAdmin) {
    return new Response(
      JSON.stringify({ error: 'Seuls les administrateurs peuvent attribuer le rôle administrateur' }),
      { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
  return null
}

async function getUserIdsInTenants(
  supabaseAdmin: ReturnType<typeof createClient>,
  tenantIds: string[]
): Promise<Set<string>> {
  if (tenantIds.length === 0) return new Set()
  const { data } = await supabaseAdmin
    .from('tenant_members')
    .select('user_id')
    .in('tenant_id', tenantIds)
  return new Set((data || []).map((r: { user_id: string }) => r.user_id))
}

async function assertTargetInScope(
  supabaseAdmin: ReturnType<typeof createClient>,
  ctx: RequesterContext,
  targetUserId: string,
  corsHeaders: Record<string, string>
): Promise<Response | null> {
  if (ctx.isPlatformAdmin) return null

  const scoped = await getUserIdsInTenants(supabaseAdmin, ctx.tenantIds)
  // Legacy single-tenant installs: admins with no tenant_members keep previous behaviour.
  if (ctx.tenantIds.length === 0) return null

  if (!scoped.has(targetUserId)) {
    return new Response(JSON.stringify({ error: 'Utilisateur hors de votre organisation' }), {
      status: 403,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
  return null
}

async function isTargetPlatformAdmin(
  supabaseAdmin: ReturnType<typeof createClient>,
  userId: string
): Promise<boolean> {
  const { data } = await supabaseAdmin
    .from('platform_admins')
    .select('user_id')
    .eq('user_id', userId)
    .maybeSingle()
  return !!data?.user_id
}

async function attachUserToTenant(
  supabaseAdmin: ReturnType<typeof createClient>,
  userId: string,
  tenantId: string,
  memberRole: 'owner' | 'admin' | 'member',
  companyId?: string | null
) {
  await supabaseAdmin.from('tenant_members').upsert(
    { tenant_id: tenantId, user_id: userId, role: memberRole },
    { onConflict: 'tenant_id,user_id' }
  )

  if (companyId) {
    await supabaseAdmin.from('user_companies').upsert(
      { user_id: userId, company_id: companyId },
      { onConflict: 'user_id,company_id' }
    )
  } else {
    const { data: companies } = await supabaseAdmin
      .from('companies')
      .select('id')
      .eq('tenant_id', tenantId)
    if (companies?.length) {
      await supabaseAdmin.from('user_companies').upsert(
        companies.map((c: { id: string }) => ({ user_id: userId, company_id: c.id })),
        { onConflict: 'user_id,company_id' }
      )
    }
  }
}

Deno.serve(async (req: Request) => {
  const origin = req.headers.get('Origin')
  const corsHeaders = getCorsHeaders(origin)

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
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const supabaseAuthClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader! } },
    })
    const { data: userData, error: userError } = await supabaseAuthClient.auth.getUser(token)

    if (userError || !userData?.user) {
      console.error('JWT verification failed:', userError?.message)
      return new Response(JSON.stringify({ error: 'Session invalide' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const requestingUserId = userData.user.id
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey)
    const ctx = await getRequesterContext(supabaseAdmin, requestingUserId)

    if (!ctx.canManageUsers) {
      return new Response(JSON.stringify({ error: 'Accès refusé : droits administrateur requis' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const requesterIsAdmin = ctx.isAppAdmin || ctx.isPlatformAdmin
    console.log('User management allowed for:', requestingUserId, {
      platform: ctx.isPlatformAdmin,
      tenants: ctx.tenantIds.length,
    })

    const { action, ...params } = await req.json()

    switch (action) {
      case 'list': {
        const perPage = 200
        const allAuthUsers: {
          id: string
          email?: string
          user_metadata?: Record<string, unknown>
          created_at?: string
        }[] = []
        let page = 1
        let listError: { message?: string; code?: string } | null = null

        while (true) {
          const { data: pageData, error } = await supabaseAdmin.auth.admin.listUsers({ page, perPage })
          if (error) {
            listError = error
            break
          }
          const batch = pageData?.users ?? []
          allAuthUsers.push(...batch)
          if (batch.length < perPage) break
          page += 1
        }

        if (listError) {
          return new Response(JSON.stringify({ error: mapErrorToUserMessage(listError) }), {
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          })
        }

        let scopedUsers = allAuthUsers
        if (!ctx.isPlatformAdmin && ctx.tenantIds.length > 0) {
          const allowed = await getUserIdsInTenants(supabaseAdmin, ctx.tenantIds)
          scopedUsers = allAuthUsers.filter((u) => allowed.has(u.id))
        }

        const { data: roles } = await supabaseAdmin.from('user_roles').select('user_id, role')

        const roleByUser = new Map<string, string>()
        for (const row of roles ?? []) {
          const uid = (row as { user_id: string }).user_id
          const r = (row as { role: string }).role
          const prev = roleByUser.get(uid)
          const rank = (x: string) => (x === 'admin' ? 3 : x === 'moderator' ? 2 : 1)
          if (!prev || rank(r) > rank(prev)) roleByUser.set(uid, r)
        }

        const usersWithRoles = scopedUsers.map((user: any) => ({
          id: user.id,
          email: user.email,
          full_name: user.user_metadata?.full_name || '',
          position: user.user_metadata?.position || '',
          created_at: user.created_at,
          role: roleByUser.get(user.id) || 'user',
        }))

        return new Response(JSON.stringify({ users: usersWithRoles }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      case 'create': {
        if (!requesterIsAdmin) {
          return new Response(
            JSON.stringify({ error: 'Seuls les administrateurs peuvent créer un compte' }),
            { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }

        const { email, password, full_name, position, role, tenant_id } = params
        console.log('Starting user creation for:', email)

        if (!email || !validateEmail(email)) {
          return new Response(JSON.stringify({ error: "Format d'email invalide" }), {
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          })
        }

        if (!password || !validatePassword(password)) {
          return new Response(
            JSON.stringify({ error: 'Le mot de passe doit contenir entre 12 et 128 caractères' }),
            {
              status: 200,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            }
          )
        }

        const userRole = role || 'user'
        const adminRoleDenied = forbidAdminRoleIfNotRequesterAdmin(userRole, requesterIsAdmin, corsHeaders)
        if (adminRoleDenied) return adminRoleDenied

        let targetTenantId: string | null = null
        if (ctx.isPlatformAdmin && tenant_id) {
          targetTenantId = tenant_id
        } else if (ctx.tenantIds.length > 0) {
          targetTenantId = ctx.tenantIds[0]
        }

        const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
          email: email.trim(),
          password,
          email_confirm: true,
          user_metadata: { full_name: full_name?.trim() || '', position: position?.trim() || '' },
        })

        if (createError) {
          console.error('Auth creation failed:', createError.message)
          return new Response(JSON.stringify({ error: mapErrorToUserMessage(createError) }), {
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          })
        }

        if (newUser.user) {
          const userId = newUser.user.id
          console.log('Auth user created:', userId)

          const { error: profileError } = await supabaseAdmin.from('profiles').upsert(
            {
              user_id: userId,
              email: email.trim(),
              full_name: full_name?.trim() || null,
            },
            { onConflict: 'user_id' }
          )

          if (profileError) {
            console.error('Profile upsert error:', profileError.code, profileError.message)
          }

          const { error: roleError } = await supabaseAdmin.from('user_roles').upsert(
            {
              user_id: userId,
              role: userRole,
            },
            { onConflict: 'user_id,role' }
          )

          if (roleError) {
            console.error('Role assignment error:', roleError.code, roleError.message)
          }

          if (targetTenantId) {
            const memberRole =
              userRole === 'admin' ? 'admin' : userRole === 'moderator' ? 'admin' : 'member'
            await attachUserToTenant(supabaseAdmin, userId, targetTenantId, memberRole)
          }
        }

        return new Response(JSON.stringify({ success: true, user: newUser.user }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      case 'create_tenant': {
        if (!ctx.isPlatformAdmin) {
          return new Response(
            JSON.stringify({ error: 'Réservé aux administrateurs plateforme' }),
            { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }

        const {
          company_name,
          owner_email,
          owner_password,
          owner_full_name,
          plan,
          max_companies,
          max_users,
          trial_days,
        } = params

        if (!company_name || String(company_name).trim().length < 2) {
          return new Response(JSON.stringify({ error: 'Nom de société requis (2 caractères min.)' }), {
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          })
        }

        if (!owner_email || !validateEmail(owner_email)) {
          return new Response(JSON.stringify({ error: "Format d'email invalide" }), {
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          })
        }

        if (!owner_password || !validatePassword(owner_password)) {
          return new Response(
            JSON.stringify({ error: 'Le mot de passe doit contenir entre 12 et 128 caractères' }),
            {
              status: 200,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            }
          )
        }

        // Create shell via RPC as the platform user (JWT), then attach owner with service role.
        const { data: shell, error: shellError } = await supabaseAuthClient.rpc(
          'platform_create_tenant_shell',
          {
            p_company_name: String(company_name).trim(),
            p_plan: plan || 'trial',
            p_max_companies: max_companies ?? 1,
            p_max_users: max_users ?? 5,
            p_trial_days: trial_days ?? 14,
          }
        )

        if (shellError) {
          console.error('platform_create_tenant_shell failed:', shellError.message)
          const msg = shellError.message.includes('platform_admin_required')
            ? 'Réservé aux administrateurs plateforme'
            : shellError.message.includes('company_name_required')
              ? 'Nom de société requis (2 caractères min.)'
              : mapErrorToUserMessage(shellError)
          return new Response(JSON.stringify({ error: msg }), {
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          })
        }

        const tenantId = shell?.tenant_id as string
        const companyId = shell?.company_id as string

        const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
          email: owner_email.trim().toLowerCase(),
          password: owner_password,
          email_confirm: true,
          user_metadata: {
            full_name: owner_full_name?.trim() || '',
            company_name: String(company_name).trim(),
            position: 'Administrateur',
          },
        })

        if (createError || !newUser.user) {
          // Best-effort cleanup of empty tenant shell
          await supabaseAdmin.from('companies').delete().eq('id', companyId)
          await supabaseAdmin.from('tenants').delete().eq('id', tenantId)
          return new Response(JSON.stringify({ error: mapErrorToUserMessage(createError) }), {
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          })
        }

        const ownerId = newUser.user.id

        await supabaseAdmin.from('profiles').upsert(
          {
            user_id: ownerId,
            email: owner_email.trim().toLowerCase(),
            full_name: owner_full_name?.trim() || null,
          },
          { onConflict: 'user_id' }
        )

        await supabaseAdmin.from('user_roles').upsert(
          { user_id: ownerId, role: 'admin' },
          { onConflict: 'user_id,role' }
        )

        await attachUserToTenant(supabaseAdmin, ownerId, tenantId, 'owner', companyId)

        return new Response(
          JSON.stringify({
            success: true,
            tenant_id: tenantId,
            company_id: companyId,
            slug: shell?.slug,
            owner_user_id: ownerId,
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      case 'update': {
        const { user_id, password, full_name, position, role } = params

        if (!user_id) {
          return new Response(JSON.stringify({ error: 'ID utilisateur requis' }), {
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          })
        }

        const outOfScope = await assertTargetInScope(supabaseAdmin, ctx, user_id, corsHeaders)
        if (outOfScope) return outOfScope

        if ((await isTargetPlatformAdmin(supabaseAdmin, user_id)) && !ctx.isPlatformAdmin) {
          return new Response(
            JSON.stringify({ error: 'Impossible de modifier un administrateur plateforme' }),
            { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }

        console.log('Updating user:', user_id, 'password provided:', !!password)

        const updateData: any = {}
        if (password) {
          if (!requesterIsAdmin) {
            return new Response(
              JSON.stringify({ error: 'Seuls les administrateurs peuvent réinitialiser un mot de passe' }),
              { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
          }
          if (!validatePassword(password)) {
            return new Response(
              JSON.stringify({ error: 'Le mot de passe doit contenir entre 12 et 128 caractères' }),
              {
                status: 200,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
              }
            )
          }
          updateData.password = password
        }

        if ('full_name' in params || 'position' in params) {
          const { data: existingAuth, error: getUserErr } = await supabaseAdmin.auth.admin.getUserById(
            user_id
          )
          if (getUserErr || !existingAuth?.user) {
            return new Response(
              JSON.stringify({ error: mapErrorToUserMessage(getUserErr) || 'Utilisateur introuvable' }),
              {
                status: 200,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
              }
            )
          }
          const prevMeta = { ...(existingAuth.user.user_metadata || {}) }
          if ('full_name' in params) prevMeta.full_name = String(full_name ?? '').trim()
          if ('position' in params) prevMeta.position = String(position ?? '').trim()
          updateData.user_metadata = prevMeta
        }

        if (Object.keys(updateData).length > 0) {
          const { data: updatedUser, error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
            user_id,
            updateData
          )

          if (updateError) {
            return new Response(JSON.stringify({ error: mapErrorToUserMessage(updateError) }), {
              status: 200,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            })
          }
          console.log('Auth user updated successfully:', updatedUser?.user?.id)
        }

        if ('full_name' in params) {
          const { error: profileError } = await supabaseAdmin
            .from('profiles')
            .update({ full_name: String(full_name ?? '').trim(), updated_at: new Date().toISOString() })
            .eq('user_id', user_id)

          if (profileError) {
            console.error('Error updating profile:', profileError.code)
          }
        }

        if ('role' in params && params.role != null && params.role !== '') {
          if (!requesterIsAdmin) {
            return new Response(
              JSON.stringify({ error: 'Seuls les administrateurs peuvent modifier les rôles' }),
              { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
          }
          const adminRoleDenied = forbidAdminRoleIfNotRequesterAdmin(role, requesterIsAdmin, corsHeaders)
          if (adminRoleDenied) return adminRoleDenied

          const { error: deleteRoleError } = await supabaseAdmin
            .from('user_roles')
            .delete()
            .eq('user_id', user_id)
          if (deleteRoleError) {
            return new Response(JSON.stringify({ error: mapErrorToUserMessage(deleteRoleError) }), {
              status: 200,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            })
          }

          const { error: insertRoleError } = await supabaseAdmin.from('user_roles').insert({
            user_id,
            role,
          })
          if (insertRoleError) {
            return new Response(JSON.stringify({ error: mapErrorToUserMessage(insertRoleError) }), {
              status: 200,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            })
          }
        }

        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      case 'delete': {
        const { user_id } = params

        if (!requesterIsAdmin) {
          return new Response(JSON.stringify({ error: 'Seuls les administrateurs peuvent supprimer un compte' }), {
            status: 403,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          })
        }

        if (!user_id) {
          return new Response(JSON.stringify({ error: 'ID utilisateur requis' }), {
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          })
        }

        if (user_id === requestingUserId) {
          return new Response(JSON.stringify({ error: 'Vous ne pouvez pas supprimer votre propre compte' }), {
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          })
        }

        const outOfScope = await assertTargetInScope(supabaseAdmin, ctx, user_id, corsHeaders)
        if (outOfScope) return outOfScope

        if (await isTargetPlatformAdmin(supabaseAdmin, user_id)) {
          return new Response(
            JSON.stringify({ error: 'Impossible de supprimer un administrateur plateforme' }),
            { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }

        const { data: targetRoles } = await supabaseAdmin
          .from('user_roles')
          .select('role')
          .eq('user_id', user_id)

        const targetIsAdmin = (targetRoles ?? []).some((r: { role: string }) => r.role === 'admin')
        if (targetIsAdmin && !ctx.isPlatformAdmin) {
          const scopedIds = await getUserIdsInTenants(supabaseAdmin, ctx.tenantIds)
          const { data: adminRows } = await supabaseAdmin
            .from('user_roles')
            .select('user_id')
            .eq('role', 'admin')
          const adminsInTenant = (adminRows ?? []).filter((r: { user_id: string }) =>
            scopedIds.has(r.user_id)
          )
          if (adminsInTenant.length <= 1) {
            return new Response(
              JSON.stringify({ error: 'Impossible de supprimer le dernier administrateur' }),
              { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
          }
        } else if (targetIsAdmin && ctx.isPlatformAdmin) {
          const { count: adminCount, error: countErr } = await supabaseAdmin
            .from('user_roles')
            .select('id', { count: 'exact', head: true })
            .eq('role', 'admin')
          if (countErr) {
            return new Response(JSON.stringify({ error: 'Impossible de vérifier les administrateurs' }), {
              status: 200,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            })
          }
          if ((adminCount ?? 0) <= 1) {
            return new Response(
              JSON.stringify({ error: 'Impossible de supprimer le dernier administrateur' }),
              { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
          }
        }

        const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(user_id)

        if (deleteError) {
          return new Response(JSON.stringify({ error: mapErrorToUserMessage(deleteError) }), {
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          })
        }

        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      default:
        return new Response(JSON.stringify({ error: 'Action non reconnue' }), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
    }
  } catch (error: unknown) {
    console.error('Manage users error:', error instanceof Error ? error.message : 'Unknown error')
    return new Response(JSON.stringify({ error: 'Une erreur est survenue. Veuillez réessayer.' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
