-- Reverses PART 2 only (use if something on the site breaks after running it).
grant select on public.profiles to anon, authenticated;
update storage.buckets set public = true where id = 'documents';
drop trigger if exists protect_job_fields on public.jobs;
create or replace function public.consume_subscription_listing() returns json
language plpgsql security definer set search_path = public as $$
declare prof public.profiles%rowtype;
begin
  select * into prof from public.profiles where auth_id = auth.uid();
  if not found then return json_build_object('ok', false, 'reason', 'no_profile'); end if;
  if not coalesce(prof.subscription_active, false) then return json_build_object('ok', false, 'reason', 'no_subscription'); end if;
  if coalesce(prof.subscription_used, 0) >= coalesce(prof.subscription_limit, 0) then
    return json_build_object('ok', false, 'reason', 'limit_reached', 'used', coalesce(prof.subscription_used,0), 'limit', coalesce(prof.subscription_limit,0));
  end if;
  update public.profiles set subscription_used = coalesce(subscription_used, 0) + 1 where id = prof.id;
  return json_build_object('ok', true, 'used', coalesce(prof.subscription_used,0) + 1, 'limit', coalesce(prof.subscription_limit,0));
end $$;
