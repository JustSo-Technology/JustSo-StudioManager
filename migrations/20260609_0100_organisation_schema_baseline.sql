create extension if not exists pgcrypto;

create table if not exists studios (
  id varchar primary key,
  name text not null,
  slug text not null unique,
  description text,
  created_at timestamp without time zone default now(),
  updated_at timestamp without time zone default now()
);

insert into studios (id, name, slug, description)
values ('justso-studios', 'JustSo. Studios', 'justso-studios', 'Default StudioManager studio')
on conflict (id) do update set
  name = excluded.name,
  slug = excluded.slug,
  description = excluded.description,
  updated_at = now();

alter table users add column if not exists username varchar;
alter table users add column if not exists full_name varchar;
alter table users add column if not exists app_role varchar not null default 'member';
alter table users add column if not exists authentik_issuer varchar;
alter table users add column if not exists authentik_subject varchar;
alter table users add column if not exists last_login_at timestamp without time zone;

update users
set
  username = coalesce(nullif(username, ''), split_part(email, '@', 1), id),
  full_name = coalesce(nullif(full_name, ''), nullif(trim(coalesce(first_name, '') || ' ' || coalesce(last_name, '')), ''), email),
  app_role = case
    when lower(email) in ('cam@justso.cloud', 'cam@justsocreative.com') then 'admin'
    else coalesce(nullif(app_role, ''), 'member')
  end;

alter table users alter column username set not null;
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'users_username_unique'
  ) then
    alter table users add constraint users_username_unique unique (username);
  end if;
end $$;

create table if not exists organisations (
  id varchar primary key,
  studio_id varchar not null default 'justso-studios',
  name text not null,
  display_name text,
  public_slug text,
  tagline text,
  hero_title text,
  hero_description text,
  bio text,
  contact_email text,
  contact_phone text,
  website_url text,
  instagram_url text,
  logo_url text,
  cover_image_url text,
  brand_color text default '#111827',
  booking_notes text,
  booking_terms text,
  created_by_user_id varchar,
  created_at timestamp without time zone default now(),
  updated_at timestamp without time zone default now()
);

do $$
begin
  if to_regclass('public.user_profiles') is not null then
    execute $migrate_user_profiles$
      insert into organisations (
        id,
        studio_id,
        name,
        display_name,
        public_slug,
        tagline,
        hero_title,
        hero_description,
        bio,
        contact_email,
        contact_phone,
        website_url,
        instagram_url,
        logo_url,
        cover_image_url,
        brand_color,
        booking_notes,
        booking_terms,
        created_by_user_id
      )
      select
        user_id,
        'justso-studios',
        coalesce(nullif(tenant_name, ''), nullif(display_name, ''), user_id),
        display_name,
        public_slug,
        tagline,
        hero_title,
        hero_description,
        bio,
        contact_email,
        contact_phone,
        website_url,
        instagram_url,
        logo_url,
        cover_image_url,
        coalesce(brand_color, '#111827'),
        booking_notes,
        booking_terms,
        case when exists (select 1 from users where users.id = user_profiles.user_id) then user_id else null end
      from user_profiles
      on conflict (id) do update set
        name = excluded.name,
        display_name = excluded.display_name,
        public_slug = excluded.public_slug,
        tagline = excluded.tagline,
        hero_title = excluded.hero_title,
        hero_description = excluded.hero_description,
        bio = excluded.bio,
        contact_email = excluded.contact_email,
        contact_phone = excluded.contact_phone,
        website_url = excluded.website_url,
        instagram_url = excluded.instagram_url,
        logo_url = excluded.logo_url,
        cover_image_url = excluded.cover_image_url,
        brand_color = excluded.brand_color,
        booking_notes = excluded.booking_notes,
        booking_terms = excluded.booking_terms,
        created_by_user_id = excluded.created_by_user_id,
        updated_at = now()
    $migrate_user_profiles$;
  end if;
end $$;

create unique index if not exists organisations_public_slug_unique
  on organisations (public_slug)
  where public_slug is not null;

create table if not exists studio_memberships (
  id serial primary key,
  studio_id varchar not null,
  user_id varchar not null,
  role text not null default 'STUDIO_MEMBER',
  created_at timestamp without time zone default now(),
  updated_at timestamp without time zone default now()
);

create unique index if not exists studio_memberships_studio_user_unique
  on studio_memberships (studio_id, user_id);

insert into studio_memberships (studio_id, user_id, role)
select
  'justso-studios',
  id,
  case when app_role = 'admin' then 'STUDIO_OWNER' else 'STUDIO_MEMBER' end
from users
on conflict (studio_id, user_id) do update set
  role = excluded.role,
  updated_at = now();

create table if not exists organisation_memberships (
  id serial primary key,
  organisation_id varchar not null,
  user_id varchar not null,
  role text not null default 'ORG_MEMBER',
  created_at timestamp without time zone default now(),
  updated_at timestamp without time zone default now()
);

create unique index if not exists organisation_memberships_org_user_unique
  on organisation_memberships (organisation_id, user_id);

insert into organisation_memberships (organisation_id, user_id, role)
select id, created_by_user_id, 'ORG_OWNER'
from organisations
where created_by_user_id is not null
on conflict (organisation_id, user_id) do update set
  role = excluded.role,
  updated_at = now();

insert into organisation_memberships (organisation_id, user_id, role)
select organisations.id, users.id, 'ORG_ADMIN'
from organisations
cross join users
where users.app_role = 'admin'
on conflict (organisation_id, user_id) do nothing;

update organisation_memberships
set role = case
  when upper(role) in ('OWNER', 'ORG_OWNER') then 'ORG_OWNER'
  when upper(role) in ('ADMIN', 'ORG_ADMIN') then 'ORG_ADMIN'
  when upper(role) in ('MEMBER', 'ORG_MEMBER') then 'ORG_MEMBER'
  else role
end;

create table if not exists organisation_invites (
  id serial primary key,
  organisation_id varchar not null,
  inviter_user_id varchar not null,
  email varchar not null,
  role text not null default 'ORG_MEMBER',
  token varchar not null,
  status text not null default 'pending',
  expires_at timestamp without time zone not null,
  accepted_at timestamp without time zone,
  created_at timestamp without time zone default now(),
  updated_at timestamp without time zone default now()
);

do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'bookings' and column_name = 'tenant_id'
  ) and not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'bookings' and column_name = 'organisation_id'
  ) then
    alter table bookings rename column tenant_id to organisation_id;
  end if;

  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'calendar_connections' and column_name = 'tenant_id'
  ) and not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'calendar_connections' and column_name = 'organisation_id'
  ) then
    alter table calendar_connections rename column tenant_id to organisation_id;
  end if;

  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'calendar_resources' and column_name = 'tenant_id'
  ) and not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'calendar_resources' and column_name = 'organisation_id'
  ) then
    alter table calendar_resources rename column tenant_id to organisation_id;
  end if;

  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'spaces' and column_name = 'tenant_id'
  ) and not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'spaces' and column_name = 'organisation_id'
  ) then
    alter table spaces rename column tenant_id to organisation_id;
  end if;

  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'services' and column_name = 'tenant_id'
  ) and not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'services' and column_name = 'organisation_id'
  ) then
    alter table services rename column tenant_id to organisation_id;
  end if;

  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'inventory_items' and column_name = 'owner_id'
  ) and not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'inventory_items' and column_name = 'organisation_id'
  ) then
    alter table inventory_items rename column owner_id to organisation_id;
  end if;
end $$;

alter table teams add column if not exists organisation_id varchar;

update teams
set organisation_id = coalesce(
  organisation_id,
  (select id from organisations where created_by_user_id = teams.owner_id limit 1),
  (select id from organisations order by created_at limit 1)
)
where organisation_id is null;

alter table teams alter column organisation_id set not null;

do $$
begin
  if to_regclass('public.team_memberships') is null and to_regclass('public.team_members') is not null then
    alter table team_members rename to team_memberships;
  end if;
end $$;

create table if not exists team_memberships (
  id serial primary key,
  team_id integer not null,
  user_id varchar not null,
  role text not null default 'TEAM_MEMBER'
);

create unique index if not exists team_memberships_team_user_unique
  on team_memberships (team_id, user_id);

create table if not exists team_calendar_access (
  id serial primary key,
  team_id integer not null,
  calendar_resource_id integer not null
);

create unique index if not exists team_calendar_access_unique
  on team_calendar_access (team_id, calendar_resource_id);

create table if not exists team_service_access (
  id serial primary key,
  team_id integer not null,
  service_id integer not null
);

create unique index if not exists team_service_access_unique
  on team_service_access (team_id, service_id);

create table if not exists team_space_access (
  id serial primary key,
  team_id integer not null,
  space_id integer not null
);

create unique index if not exists team_space_access_unique
  on team_space_access (team_id, space_id);

create table if not exists team_inventory_access (
  id serial primary key,
  team_id integer not null,
  inventory_item_id integer not null
);

create unique index if not exists team_inventory_access_unique
  on team_inventory_access (team_id, inventory_item_id);
