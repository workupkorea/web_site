begin;

alter table public.mate_activities
  add column if not exists product_image_version uuid,
  add column if not exists product_image_webp text check (char_length(product_image_webp) <= 900000);

commit;