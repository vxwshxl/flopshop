-- New settings rows for the storefront controls. The settings form UPDATEs
-- existing rows, so they must exist first. Safe to re-run.
INSERT INTO public.settings (key, value, label) VALUES
  ('timezone', 'Asia/Kolkata', 'Timezone'),
  ('order_types_enabled', 'pickup,delivery', 'Enabled Order Types')
ON CONFLICT (key) DO NOTHING;
