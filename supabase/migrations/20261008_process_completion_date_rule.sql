create or replace function public.atlas_sync_process_completed_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.status = 'completed' then
    if tg_op = 'INSERT'
       or old.status is distinct from 'completed'
       or new.completed_at is null then
      new.completed_at := now();
    end if;
  else
    new.completed_at := null;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_atlas_sync_process_completed_at on public.processes;
create trigger trg_atlas_sync_process_completed_at
before insert or update of status on public.processes
for each row
execute function public.atlas_sync_process_completed_at();
