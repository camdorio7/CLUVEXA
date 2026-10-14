-- NADORIO v11: Optional organization-owned hero photography.
-- Existing organization_sites RLS policies continue to control access.
ALTER TABLE public.organization_sites
 ADD COLUMN IF NOT EXISTS hero_image_url text NOT NULL DEFAULT '';
ALTER TABLE public.organization_sites
 DROP CONSTRAINT IF EXISTS organization_sites_hero_image_url_check;
ALTER TABLE public.organization_sites
 ADD CONSTRAINT organization_sites_hero_image_url_check
 CHECK (hero_image_url = '' OR (length(hero_image_url) <= 2048 AND hero_image_url ~ '^https://[^[:space:]]+$'));
