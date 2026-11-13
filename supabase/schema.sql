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
alter table public.profiles add column if not exists wagered_since_rain bigint not null default 0;
alter table public.profiles add column if not exists rl_start timestamptz not null default now();
alter table public.profiles add column if not exists rl_wager bigint not null default 0;
alter table public.profiles add column if not exists rl_won bigint not null default 0;

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
  rs timestamptz; rw bigint; rv bigint; allowed bigint; won_eff bigint;
begin
  if uid is null then raise exception 'not_logged_in'; end if;
  if p_wagered < 0 or p_won < 0 or p_wagered > 1000000000000 or p_won > 1000000000000 then
    raise exception 'bad_values';
  end if;
  select coins, rl_start, rl_wager, rl_won into c, rs, rw, rv from profiles where id = uid for update;
  if c is null then raise exception 'no_account'; end if;
  -- Gewinn-Limit pro 60 Sekunden: hoechstens 500x der Einsaetze dieser Minute + 500 Basis.
  -- Ueberschuss wird abgeschnitten (kein Fehler), damit ehrliche Spieler nicht haengen bleiben.
  if now() - rs > interval '60 seconds' then rs := now(); rw := 0; rv := 0; end if;
  allowed := greatest(0, 500 * (rw + p_wagered) + 500 - rv);
  won_eff := least(p_won, allowed);
  if c - p_wagered + won_eff < 0 then raise exception 'insufficient'; end if;
  update profiles set coins = c - p_wagered + won_eff, updated_at = now(),
    wagered_since_rain = wagered_since_rain + p_wagered,
    rl_start = rs, rl_wager = rw + p_wagered, rl_won = rv + won_eff
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
declare d date; r record; i int; prizes bigint[] := array[1000000, 500000, 250000, 100000, 50000];
begin
  for d in select (public.vienna_today() - g)::date from generate_series(1, 7) g loop
    insert into daily_prizes (day) values (d) on conflict (day) do nothing;
    if found then
      i := 0;
      for r in select user_id from daily_stats
               where day = d and wagered > 0
               order by wagered desc limit 5 loop
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

-- 13) Automatische Tagespreise (pg_cron, stündlich, nachholend) ---------
-- settle_daily_prizes ist idempotent: fehlende Tage werden beim nächsten Lauf nachgeholt.
do $$ begin
  create extension if not exists pg_cron;
  begin perform cron.unschedule('settle-daily-prizes'); exception when others then null; end;
  perform cron.schedule('settle-daily-prizes', '5 * * * *', 'select public.settle_daily_prizes()');
exception when others then
  raise notice 'pg_cron nicht verfuegbar: %', sqlerrm;
end $$;

-- 14) Live-Chat (nur eingeloggt, max. 200 Zeichen, 1 Nachricht / 2 Sek.) -
create table if not exists public.chat_messages (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  username text not null,
  body text not null check (length(body) between 1 and 200),
  created_at timestamptz not null default now()
);
alter table public.chat_messages enable row level security;
drop policy if exists "chat_read" on public.chat_messages;
create policy "chat_read" on public.chat_messages for select to authenticated using (true);
revoke all on public.chat_messages from anon, authenticated;
grant select on public.chat_messages to authenticated;

create or replace function public.post_chat(p_body text)
returns void language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); uname text; msg text := trim(p_body); last_at timestamptz;
begin
  if uid is null then raise exception 'not_logged_in'; end if;
  if length(msg) < 1 or length(msg) > 200 then raise exception 'bad_message'; end if;
  select username into uname from profiles where id = uid;
  if uname is null then raise exception 'no_account'; end if;
  select max(created_at) into last_at from chat_messages where user_id = uid;
  if last_at is not null and now() - last_at < interval '2 seconds' then raise exception 'too_fast'; end if;
  insert into chat_messages (user_id, username, body) values (uid, uname, msg);
  delete from chat_messages where id in (select id from chat_messages order by id desc offset 200);
end $$;
revoke execute on function public.post_chat(text) from public, anon;
grant execute on function public.post_chat(text) to authenticated;

-- Echtzeit: Neue Nachrichten an alle eingeloggten Browser schicken
do $$ begin
  alter publication supabase_realtime add table public.chat_messages;
exception when others then
  raise notice 'Realtime-Publikation: %', sqlerrm;
end $$;

-- 15) Rakeback Rain: alle 10 Min (Wiener Zeit :00, :10, ...) 3 Min zum Joinen.
--     Pot = Spenden der Spieler. Auszahlung anteilig nach den Einsaetzen seit dem letzten Join.
create table if not exists public.rain_rounds (
  id bigint generated always as identity primary key,
  opens_at timestamptz not null,
  closes_at timestamptz not null,
  pool bigint not null default 0 check (pool >= 0),
  settled boolean not null default false
);
create table if not exists public.rain_joins (
  round_id bigint not null references public.rain_rounds(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  wager bigint not null default 0,
  payout bigint not null default 0,
  primary key (round_id, user_id)
);
alter table public.rain_rounds enable row level security;
alter table public.rain_joins enable row level security;
revoke all on public.rain_rounds, public.rain_joins from anon, authenticated;

-- Rain-Meldungen laufen ueber den Chat (kind = rain / rain_end, ohne Absender)
alter table public.chat_messages add column if not exists kind text not null default 'chat';
alter table public.chat_messages add column if not exists meta jsonb;
alter table public.chat_messages alter column user_id drop not null;

-- Status fuer den Browser: aktuelle Runde, eigene Basis, letzte Auszahlung
create or replace function public.rain_status()
returns json language plpgsql stable security definer set search_path = public as $$
declare uid uuid := auth.uid(); r rain_rounds; mine bigint; pay record; nxt timestamptz;
begin
  if uid is null then raise exception 'not_logged_in'; end if;
  select * into r from rain_rounds where not settled and closes_at > now() order by id desc limit 1;
  select wagered_since_rain into mine from profiles where id = uid;
  select rr.id as round_id, j.payout into pay from rain_joins j join rain_rounds rr on rr.id = j.round_id
    where j.user_id = uid and rr.settled and j.payout > 0 order by rr.id desc limit 1;
  nxt := date_trunc('hour', now()) + ((floor(extract(minute from now()) / 10) + 1) * 10) * interval '1 minute';
  return json_build_object(
    'server_now', extract(epoch from now()) * 1000,
    'open', r.id is not null,
    'round_id', r.id,
    'closes_at', extract(epoch from r.closes_at) * 1000,
    'next_at', extract(epoch from nxt) * 1000,
    'pool', coalesce(r.pool, 0),
    'joined', coalesce(exists(select 1 from rain_joins where round_id = r.id and user_id = uid), false),
    'my_wager', coalesce(mine, 0),
    'payout_round', pay.round_id,
    'payout', coalesce(pay.payout, 0)
  );
end $$;

-- Mitmachen: Einsaetze seit dem letzten Join werden als Basis gemerkt und zurueckgesetzt
create or replace function public.rain_join(p_round bigint)
returns bigint language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); w bigint;
begin
  if uid is null then raise exception 'not_logged_in'; end if;
  if not exists (select 1 from rain_rounds where id = p_round and not settled and closes_at > now()) then
    raise exception 'round_closed';
  end if;
  if exists (select 1 from rain_joins where round_id = p_round and user_id = uid) then raise exception 'already_joined'; end if;
  select wagered_since_rain into w from profiles where id = uid for update;
  if coalesce(w, 0) <= 0 then raise exception 'no_wager'; end if;
  insert into rain_joins (round_id, user_id, wager) values (p_round, uid, w);
  update profiles set wagered_since_rain = 0 where id = uid;
  return w;
exception when unique_violation then
  raise exception 'already_joined';
end $$;

-- Spenden: Coins wandern vom Konto in den Pot der offenen Runde
create or replace function public.rain_donate(p_round bigint, p_amount bigint)
returns bigint language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); c bigint;
begin
  if uid is null then raise exception 'not_logged_in'; end if;
  if p_amount is null or p_amount < 1 or p_amount > 1000000000000 then raise exception 'bad_values'; end if;
  if not exists (select 1 from rain_rounds where id = p_round and not settled and closes_at > now()) then
    raise exception 'round_closed';
  end if;
  select coins into c from profiles where id = uid for update;
  if c is null or c < p_amount then raise exception 'insufficient'; end if;
  update profiles set coins = coins - p_amount, updated_at = now() where id = uid returning coins into c;
  update rain_rounds set pool = pool + p_amount where id = p_round;
  return c;
end $$;

-- Minuetlich vom Cron aufgerufen: faellige Runden auszahlen, zur 10er-Marke neue Runde oeffnen
create or replace function public.rain_tick()
returns void language plpgsql security definer set search_path = public as $$
declare r record; j record; tot bigint; share bigint; nr rain_rounds;
begin
  for r in select * from rain_rounds where not settled and closes_at <= now() order by id loop
    select coalesce(sum(wager), 0) into tot from rain_joins where round_id = r.id;
    if tot > 0 and r.pool > 0 then
      for j in select user_id, wager from rain_joins where round_id = r.id and wager > 0 loop
        share := floor(r.pool * j.wager / tot);
        update rain_joins set payout = share where round_id = r.id and user_id = j.user_id;
        update profiles set coins = coins + share, updated_at = now() where id = j.user_id;
      end loop;
    end if;
    update rain_rounds set settled = true where id = r.id;
    insert into chat_messages (user_id, username, body, kind)
      values (null, 'Rain', '🌧️ Rain beendet: ' || r.pool || ' Coins an ' ||
        (select count(*) from rain_joins where round_id = r.id and payout > 0) || ' Spieler verteilt', 'rain_end');
  end loop;
  if extract(minute from now())::int % 10 = 0
     and not exists (select 1 from rain_rounds where opens_at > now() - interval '5 minutes') then
    insert into rain_rounds (opens_at, closes_at) values (now(), now() + interval '3 minutes') returning * into nr;
    insert into chat_messages (user_id, username, body, kind, meta)
      values (null, 'Rain', '🌧️ RAKEBACK RAIN! 3 Minuten zum Joinen', 'rain',
        jsonb_build_object('round_id', nr.id, 'closes_at', extract(epoch from nr.closes_at) * 1000));
  end if;
end $$;

revoke execute on function public.rain_status() from public, anon;
revoke execute on function public.rain_join(bigint) from public, anon;
revoke execute on function public.rain_donate(bigint, bigint) from public, anon;
revoke execute on function public.rain_tick() from public, anon, authenticated;
grant execute on function public.rain_status() to authenticated;
grant execute on function public.rain_join(bigint) to authenticated;
grant execute on function public.rain_donate(bigint, bigint) to authenticated;

do $$ begin
  begin perform cron.unschedule('rain-tick'); exception when others then null; end;
  perform cron.schedule('rain-tick', '* * * * *', 'select public.rain_tick()');
exception when others then
  raise notice 'pg_cron nicht verfuegbar: %', sqlerrm;
end $$;
