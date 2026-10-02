create table if not exists public.product_like_counts (
  product_key text primary key,
  like_count integer not null default 0 check (like_count >= 0),
  updated_at timestamptz not null default now()
);

alter table public.product_like_counts enable row level security;

drop policy if exists "Product like counts are publicly readable"
  on public.product_like_counts;
create policy "Product like counts are publicly readable"
  on public.product_like_counts
  for select
  to anon, authenticated
  using (true);

grant select on public.product_like_counts to anon, authenticated;
revoke insert, update, delete on public.product_like_counts from anon, authenticated;

create or replace function public.adjust_product_like_count(
  p_product_key text,
  p_delta integer
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  next_count integer;
begin
  if p_product_key is null or length(trim(p_product_key)) = 0 or length(p_product_key) > 255 then
    raise exception 'Invalid product key';
  end if;

  if p_delta is null or p_delta not in (-1, 1) then
    raise exception 'Like count changes must be +1 or -1';
  end if;

  insert into public.product_like_counts as counts (product_key, like_count, updated_at)
  values (p_product_key, greatest(p_delta, 0), now())
  on conflict (product_key) do update
    set like_count = greatest(0, counts.like_count + p_delta),
        updated_at = now()
  returning like_count into next_count;

  return next_count;
end;
$$;

revoke all on function public.adjust_product_like_count(text, integer) from public;
grant execute on function public.adjust_product_like_count(text, integer) to anon, authenticated;
