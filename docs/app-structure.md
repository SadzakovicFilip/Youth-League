# App Structure (Role + Shared)

## Routing Structure

- `app/(auth)/` (planned) - authentication screens
- `app/login.tsx` - current login screen
- `app/(tabs)/index.tsx` - current test/admin create-user screen
- `app/(shared)/` - routes shared by all roles
  - `home.tsx`
  - `matches/[id].tsx`
  - `stats/top-scorers.tsx`
- `app/(roles)/` - role-specific dashboards
  - `admin/index.tsx`
  - `savez/index.tsx`
  - `delegat/index.tsx`
  - `klub-direktor/index.tsx`
  - `trener/index.tsx`
  - `igrac/index.tsx`
  - `scout/index.tsx`
  - `zapisnicar/index.tsx`
  - `spectator/index.tsx`

## Notes

- Route groups (folder names in parentheses) do not appear in URL.
- Shared home route is `/home`.
- Role home route mapping is centralized in `lib/role-home-route.ts`.
- Access permissions are still enforced by Supabase RLS + Edge Function checks.
