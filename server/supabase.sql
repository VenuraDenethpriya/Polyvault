-- Run once in Supabase: SQL Editor > New query > Run
create table users(id bigint generated always as identity primary key,name text not null,email text unique not null,
  role text not null default 'user' check(role in('admin','developer','user')),plan text not null default 'free' check(plan in('free','paid')),hash text not null);
create table assets(id bigint generated always as identity primary key,title text not null,category text,shape text default 'sphere',color text default '#7c5cff',
  price numeric default 0,owner bigint references users(id) on delete set null,downloads int default 0,created_at timestamptz default now());
alter table users enable row level security;alter table assets enable row level security; -- no public policies: only the server (service key) can access
