-- ImmoGest — protection definitive des donnees
-- A executer UNE FOIS dans Supabase > SQL Editor > New query > Run.
-- Sans danger : on peut le relancer plusieurs fois, il ne supprime aucune donnee.
--
-- Ce que ca fait :
--  1. Ajoute une colonne "deletedAt" (suppression douce : une ligne "supprimee" reste en base).
--  2. INTERDIT toute suppression definitive (DELETE) depuis le site / la cle publique.
--     => meme un ancien onglet encore ouvert avec du vieux code ne peut plus rien effacer.
--  3. Enregistre dans "audit_log" l'ancienne version de chaque ligne modifiee ou supprimee
--     (sauvegarde interne, lisible uniquement depuis le tableau de bord Supabase).

do $$
declare t text;
begin
  foreach t in array array['buildings','apartments','tenants','payments','maintenances','syndicCharges','charges','owner']
  loop
    if to_regclass('public.' || quote_ident(t)) is not null then
      -- 1. suppression douce
      execute format('alter table public.%I add column if not exists "deletedAt" timestamptz', t);

      -- 2. lecture / ajout / modification autorises, suppression definitive interdite
      execute format('alter table public.%I enable row level security', t);
      execute format('drop policy if exists %I on public.%I', 'allow all ' || t, t);
      execute format('drop policy if exists %I on public.%I', 'read ' || t, t);
      execute format('drop policy if exists %I on public.%I', 'insert ' || t, t);
      execute format('drop policy if exists %I on public.%I', 'update ' || t, t);
      execute format('create policy %I on public.%I for select using (true)', 'read ' || t, t);
      execute format('create policy %I on public.%I for insert with check (true)', 'insert ' || t, t);
      execute format('create policy %I on public.%I for update using (true) with check (true)', 'update ' || t, t);
      execute format('revoke delete on public.%I from anon, authenticated', t);
    end if;
  end loop;
end $$;

-- 3. journal de sauvegarde interne
create table if not exists public.audit_log (
  id bigserial primary key,
  at timestamptz not null default now(),
  table_name text not null,
  op text not null,
  row_data jsonb not null
);
alter table public.audit_log enable row level security;           -- aucune policy : invisible depuis le site
revoke all on public.audit_log from anon, authenticated;

create or replace function public.log_change() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.audit_log(table_name, op, row_data) values (TG_TABLE_NAME, TG_OP, to_jsonb(OLD));
  if TG_OP = 'DELETE' then return OLD; end if;
  return NEW;
end $$;

do $$
declare t text;
begin
  foreach t in array array['buildings','apartments','tenants','payments','maintenances','syndicCharges','charges','owner']
  loop
    if to_regclass('public.' || quote_ident(t)) is not null then
      execute format('drop trigger if exists audit_log_trigger on public.%I', t);
      execute format('create trigger audit_log_trigger after update or delete on public.%I for each row execute function public.log_change()', t);
    end if;
  end loop;
end $$;

-- Pour retrouver d'anciennes versions (exemple : locataires) :
--   select at, op, row_data->>'name' as nom, row_data from audit_log
--   where table_name = 'tenants' order by at desc;
