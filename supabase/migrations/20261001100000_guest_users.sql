create table if not exists public.guest_users (
  id uuid primary key default gen_random_uuid(),
  first_name text not null,
  last_name text not null,
  contact_type text not null check (contact_type in ('email', 'phone')),
  contact_value text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint guest_users_contact_unique unique (contact_type, contact_value),
  constraint guest_users_first_name_length check (char_length(first_name) between 1 and 60),
  constraint guest_users_last_name_length check (char_length(last_name) between 1 and 60)
);

alter table public.guest_users enable row level security;
revoke all on public.guest_users from anon, authenticated;

create or replace function public.create_guest_user(
  p_first_name text,
  p_last_name text,
  p_contact text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  clean_first_name text := btrim(p_first_name);
  clean_last_name text := btrim(p_last_name);
  clean_contact text := btrim(p_contact);
  normalized_contact text;
  contact_kind text;
  guest_id uuid;
begin
  if clean_first_name is null or char_length(clean_first_name) not between 1 and 60 then
    raise exception 'First name must be between 1 and 60 characters';
  end if;

  if clean_last_name is null or char_length(clean_last_name) not between 1 and 60 then
    raise exception 'Last name must be between 1 and 60 characters';
  end if;

  if clean_contact is null or char_length(clean_contact) > 120 then
    raise exception 'Enter a valid email address or phone number';
  end if;

  if position('@' in clean_contact) > 1 then
    normalized_contact := lower(clean_contact);
    if normalized_contact !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then
      raise exception 'Enter a valid email address or phone number';
    end if;
    contact_kind := 'email';
  else
    if clean_contact !~ '^[0-9+().[:space:]-]+$' then
      raise exception 'Enter a valid email address or phone number';
    end if;
    normalized_contact := regexp_replace(clean_contact, '[^0-9]', '', 'g');
    if char_length(normalized_contact) not between 7 and 15 then
      raise exception 'Enter a valid email address or phone number';
    end if;
    contact_kind := 'phone';
  end if;

  insert into public.guest_users as guests (
    first_name, last_name, contact_type, contact_value
  ) values (
    clean_first_name, clean_last_name, contact_kind, normalized_contact
  )
  on conflict (contact_type, contact_value) do update
    set first_name = excluded.first_name,
        last_name = excluded.last_name,
        updated_at = now()
  returning id into guest_id;

  return guest_id;
end;
$$;

revoke all on function public.create_guest_user(text, text, text) from public;
grant execute on function public.create_guest_user(text, text, text) to anon, authenticated;
