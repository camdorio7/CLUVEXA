-- NADORIO v2.0 brand migration
-- Branding-only migration. Existing CLUVEXA-era table/column/function identifiers remain unchanged
-- intentionally for backward compatibility and to avoid destructive schema changes.

-- Update persisted portal labels that used the former product name when the optional
-- club_settings table/column is present. This block is safe across earlier installations.
do $$
begin
  if to_regclass('public.club_settings') is not null
     and exists (
       select 1 from information_schema.columns
       where table_schema='public' and table_name='club_settings' and column_name='member_portal_name'
     ) then
    execute $q$
      update public.club_settings
      set member_portal_name = replace(member_portal_name, 'CLUVEXA', 'NADORIO')
      where member_portal_name ilike '%CLUVEXA%'
    $q$;
  end if;
end $$;
