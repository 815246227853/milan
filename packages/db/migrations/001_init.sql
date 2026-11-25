-- Milan schema: wedding → functions → vendors → jobs → calls → quotes → decisions → activity
create table weddings (
  id uuid primary key default gen_random_uuid(),
  couple text not null,
  city text not null,
  main_date date not null,
  guests int not null,
  total_budget numeric,
  call_languages text[] default '{hi}',
  created_at timestamptz default now()
);

create table functions (
  id uuid primary key default gen_random_uuid(),
  wedding_id uuid references weddings(id) on delete cascade,
  name text not null,              -- haldi, mehendi, sangeet, wedding, reception
  starts_at timestamptz
);

create table vendors (
  id uuid primary key default gen_random_uuid(),
  wedding_id uuid references weddings(id) on delete cascade,
  name text not null,
  category text not null,          -- food, decor, music, photos, rituals, band
  phone text not null,
  area text,
  language text default 'hi',
  status text default 'not_contacted', -- not_contacted, quoted, confirmed, needs_follow_up
  function_ids uuid[] default '{}'
);

create table jobs (
  id uuid primary key default gen_random_uuid(),
  wedding_id uuid references weddings(id) on delete cascade,
  request text not null,           -- what the family asked, in their words
  status text default 'planning',  -- planning, calling, comparing, needs_you, done
  plan jsonb default '[]',
  created_at timestamptz default now()
);

create table calls (
  id uuid primary key default gen_random_uuid(),
  job_id uuid references jobs(id) on delete cascade,
  vendor_id uuid references vendors(id),
  language text,
  status text default 'queued',    -- queued, ringing, live, done, no_answer, stopped
  transcript jsonb default '[]',   -- [{speaker, text, english}]
  started_at timestamptz,
  ended_at timestamptz
);

create table quotes (
  id uuid primary key default gen_random_uuid(),
  call_id uuid references calls(id) on delete cascade,
  vendor_id uuid references vendors(id),
  price_per_unit numeric,
  unit text,                       -- plate, event, hour
  date_available boolean,
  includes text,
  advance text,
  notes text
);

create table decisions (
  id uuid primary key default gen_random_uuid(),
  job_id uuid references jobs(id) on delete cascade,
  title text not null,
  what_changed text,
  cost_before numeric,
  cost_after numeric,
  budget numeric,
  rule text,                       -- which Flagsmith rule asked for approval
  status text default 'open',      -- open, approved, declined
  decided_at timestamptz
);

create table activity (
  id bigserial primary key,
  wedding_id uuid references weddings(id) on delete cascade,
  job_id uuid references jobs(id),
  text text not null,
  at timestamptz default now()
);
