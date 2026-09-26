-- Plan matrix. `limits`: null = unlimited, 0 = not included in this plan.
-- Stripe price ids are filled in by scripts/provision-stripe.mjs (not run here).
INSERT INTO plans (id, name, blurb, sort_order, price_cents, seats_included, extra_seat_cents, limits) VALUES
  ('starter',  'Starter',  'Find high-performing stores and read their whole playbook.',        1,  5900, 1,    0,
   '{"shops":null,"ads":0,"emails":30,"advertisers":2000,"brandtrackers":2,"apiCredits":0,"seats":1}'::jsonb),
  ('pro',      'Pro',      'Full market visibility across shops, ads and advertisers.',         2,  8900, 1,    0,
   '{"shops":null,"ads":null,"emails":null,"advertisers":null,"brandtrackers":30,"apiCredits":10000,"seats":1}'::jsonb),
  ('business', 'Business', 'Unlimited tracking and shared workspaces for a whole team.',        3, 14900, 3, 2900,
   '{"shops":null,"ads":null,"emails":null,"advertisers":null,"brandtrackers":null,"apiCredits":10000,"seats":3}'::jsonb)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name, blurb = EXCLUDED.blurb, sort_order = EXCLUDED.sort_order,
  price_cents = EXCLUDED.price_cents, seats_included = EXCLUDED.seats_included,
  extra_seat_cents = EXCLUDED.extra_seat_cents, limits = EXCLUDED.limits;

-- 'free' is the state a workspace sits in before it ever subscribes. It is not
-- listed on the pricing page; it exists so a signed-up workspace always has a
-- valid plan_id FK and a defined (zero) allowance.
INSERT INTO plans (id, name, blurb, sort_order, price_cents, is_public, limits) VALUES
  ('free', 'Free', 'Read-only preview until a plan is chosen.', 0, 0, false,
   '{"shops":25,"ads":0,"emails":0,"advertisers":0,"brandtrackers":0,"apiCredits":0,"seats":1}'::jsonb)
ON CONFLICT (id) DO UPDATE SET limits = EXCLUDED.limits, is_public = EXCLUDED.is_public;
