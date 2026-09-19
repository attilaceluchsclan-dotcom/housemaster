-- Housemaster schema — Phase 1
-- Run this in Supabase SQL editor (Database > SQL Editor > New query)

create extension if not exists vector;

create table if not exists boxes (
  id serial primary key,
  name text unique not null
);

insert into boxes (name) values
  ('Kitchen'), ('Bathroom'), ('Bedroom'), ('Office / Desk'),
  ('Tools'), ('Donate'), ('Trash'), ('Miscellaneous')
on conflict (name) do nothing;

create table if not exists items (
  id uuid primary key default gen_random_uuid(),
  name text,
  description text,
  box_id int references boxes(id),
  status text not null default 'later' check (status in ('confirmed','misc','later')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists item_photos (
  id uuid primary key default gen_random_uuid(),
  item_id uuid references items(id) on delete cascade,
  image_path text not null,
  embedding vector(1536), -- unused for now, pre-wired for Phase 3 if it happens later
  created_at timestamptz not null default now()
);

-- Storage bucket for photos (run once; ignore error if it already exists)
insert into storage.buckets (id, name, public)
values ('item-photos', 'item-photos', true)
on conflict (id) do nothing;

-- Public read/write policies (fine for a single-user personal tool; tighten later if needed)
create policy "public read boxes" on boxes for select using (true);
create policy "public read items" on items for select using (true);
create policy "public write items" on items for insert with check (true);
create policy "public update items" on items for update using (true);
create policy "public read item_photos" on item_photos for select using (true);
create policy "public write item_photos" on item_photos for insert with check (true);

alter table boxes enable row level security;
alter table items enable row level security;
alter table item_photos enable row level security;

create policy "public upload photos" on storage.objects for insert
  with check (bucket_id = 'item-photos');
create policy "public read photos" on storage.objects for select
  using (bucket_id = 'item-photos');
