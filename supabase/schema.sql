-- =====================================================================
-- Maxi Timer: Konten, Kontostand (Server), Tagesrangliste, Codes
-- Einmal komplett im Supabase SQL Editor ausführen.
-- =====================================================================

-- 1) Tabellen -----------------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text unique not null,
  coins bigint not null default 0 check (coins >= 0),
  level int not null default 1,
  prestige int not null default 0,
  best_win bigint not null default 0,
  updated_at timestamptz not null default now()
);
alter table public.profiles add column if not exists last_login_day date;

create table if not exists public.daily_stats (
  user_id uuid not null references auth.users(id) on delete cascade,
  day date not null,
  wagered bigint not null default 0,
  primary key (user_id, day)
);

create table if not exists public.daily_prizes (
  day date primary key,
  awarded_at timestamptz not null default now()
);

create table if not exists public.redeem_codes (
  code text primary key,
  coins bigint not null,
  active boolean not null default true
);

create table if not exists public.redeemed_codes (
  user_id uuid not null references auth.users(id) on delete cascade,
  code text not null references public.redeem_codes(code),
  primary key (user_id, code)
);

-- 2) Sicherheit (RLS) ---------------------------------------------------
-- Kontostand darf NICHT direkt vom Browser geändert werden.
-- Schreiben geht nur über die Funktionen unten (security definer).
alter table public.profiles enable row level security;
alter table public.daily_stats enable row level security;
alter table public.daily_prizes enable row level security;
alter table public.redeem_codes enable row level security;
alter table public.redeemed_codes enable row level security;

drop policy if exists "update_own" on public.profiles;
drop policy if exists "insert_own" on public.profiles;
drop policy if exists "read_all" on public.profiles;
create policy "read_all" on public.profiles for select using (true);

drop policy if exists "read_daily" on public.daily_stats;
create policy "read_daily" on public.daily_stats for select using (true);
-- redeem_codes / redeemed_codes / daily_prizes: keine Policy -> niemand liest direkt

-- 3) Hilfsfunktion: heutiger Tag in Wien --------------------------------
create or replace function public.vienna_today()
returns date language sql stable as $$
  select (now() at time zone 'Europe/Vienna')::date
$$;

-- 4) Konto anlegen nach Registrierung (Willkommensbonus 2000) -----------
create or replace function public.init_account(p_username text)
returns bigint language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); c bigint;
begin
  if uid is null then raise exception 'not_logged_in'; end if;
  if p_username is null or length(trim(p_username)) < 3 or length(trim(p_username)) > 16 then
    raise exception 'bad_username';
  end if;
  insert into profiles (id, username, coins) values (uid, trim(p_username), 2000)
    on conflict (id) do nothing;
  select coins into c from profiles where id = uid;
  return c;
exception when unique_violation then
  raise exception 'username_taken';
end $$;

-- 5) Kontostand anwenden: Einsätze abziehen, Gewinne gutschreiben ------
-- Der Server prüft nur: Werte plausibel, Kontostand reicht nicht ins Minus.
create or replace function public.apply_delta(p_wagered bigint, p_won bigint)
returns bigint language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); c bigint; today date := public.vienna_today();
begin
  if uid is null then raise exception 'not_logged_in'; end if;
  if p_wagered < 0 or p_won < 0 or p_wagered > 1000000000000 or p_won > 1000000000000 then
    raise exception 'bad_values';
  end if;
  select coins into c from profiles where id = uid for update;
  if c is null then raise exception 'no_account'; end if;
  if c - p_wagered + p_won < 0 then raise exception 'insufficient'; end if;
  update profiles set coins = c - p_wagered + p_won, updated_at = now()
    where id = uid returning coins into c;
  if p_wagered > 0 then
    insert into daily_stats (user_id, day, wagered) values (uid, today, p_wagered)
      on conflict (user_id, day) do update set wagered = daily_stats.wagered + excluded.wagered;
  end if;
  return c;
end $$;

-- 6) Fortschritt speichern (Level/Prestige/Rekord steigen nur, sinken nie)
create or replace function public.save_progress(p_level int, p_prestige int, p_best_win bigint)
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'not_logged_in'; end if;
  update profiles set
    level = greatest(level, least(p_level, 9999)),
    prestige = greatest(prestige, least(p_prestige, 9999)),
    best_win = greatest(best_win, p_best_win),
    updated_at = now()
  where id = auth.uid();
end $$;

-- 7) Täglicher Login-Bonus (+500, einmal pro Wiener Tag) ----------------
create or replace function public.claim_daily_login()
returns bigint language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); today date := public.vienna_today(); c bigint;
begin
  if uid is null then raise exception 'not_logged_in'; end if;
  update profiles set coins = coins + 500, last_login_day = today, updated_at = now()
    where id = uid and (last_login_day is null or last_login_day < today)
    returning coins into c;
  if c is null then raise exception 'already_claimed'; end if;
  return c;
end $$;

-- 8) Bonus-Codes (Groß-/Kleinschreibung zählt, einmal pro Konto) -------
create or replace function public.redeem_code(p_code text)
returns bigint language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); rc record; c bigint;
begin
  if uid is null then raise exception 'not_logged_in'; end if;
  select * into rc from redeem_codes where code = p_code and active;  -- "=" ist case-sensitiv
  if not found then raise exception 'invalid_code'; end if;
  begin
    insert into redeemed_codes (user_id, code) values (uid, rc.code);
  exception when unique_violation then
    raise exception 'already_redeemed';
  end;
  update profiles set coins = coins + rc.coins, updated_at = now()
    where id = uid returning coins into c;
  return c;
end $$;

-- 9) Tagespreise: Platz 1-3 nach Umsatz (100k / 50k / 20k) --------------
-- Verteilt alle abgeschlossenen Tage der letzten 7 Tage, die noch nicht
-- ausgezahlt wurden. Wird beim Laden der Rangliste aufgerufen, ist idempotent.
create or replace function public.settle_daily_prizes()
returns void language plpgsql security definer set search_path = public as $$
declare d date; r record; i int; prizes bigint[] := array[100000, 50000, 20000];
begin
  for d in select (public.vienna_today() - g)::date from generate_series(1, 7) g loop
    insert into daily_prizes (day) values (d) on conflict (day) do nothing;
    if found then
      i := 0;
      for r in select user_id from daily_stats
               where day = d and wagered > 0
               order by wagered desc limit 3 loop
        i := i + 1;
        update profiles set coins = coins + prizes[i], updated_at = now() where id = r.user_id;
      end loop;
    end if;
  end loop;
end $$;

-- 10) Tagesrangliste nach Umsatz ---------------------------------------
create or replace function public.leaderboard_today()
returns table(username text, wagered bigint, coins bigint)
language sql stable security definer set search_path = public as $$
  select p.username, s.wagered, p.coins
  from daily_stats s join profiles p on p.id = s.user_id
  where s.day = public.vienna_today() and s.wagered > 0
  order by s.wagered desc
  limit 20
$$;

-- 11) Startcodes (Beispiel, hier neue Codes eintragen) ------------------
insert into redeem_codes (code, coins, active) values ('MAXIREICH50K', 50000, true)
  on conflict (code) do nothing;

-- 12) Rechte: Browser darf nur lesen, Schreiben nur über die Funktionen ----
revoke all on all tables in schema public from anon, authenticated;
grant select on public.profiles, public.daily_stats, public.daily_prizes to anon, authenticated;
grant execute on function public.init_account(text) to authenticated;
grant execute on function public.apply_delta(bigint, bigint) to authenticated;
grant execute on function public.save_progress(int, int, bigint) to authenticated;
grant execute on function public.claim_daily_login() to authenticated;
grant execute on function public.redeem_code(text) to authenticated;
grant execute on function public.leaderboard_today() to anon, authenticated;
-- Auszahlung nur serverseitig (SQL-Editor / pg_cron), nicht aus dem Browser
revoke execute on function public.settle_daily_prizes() from public, anon, authenticated;
