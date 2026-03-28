ALTER TABLE plan_prices DROP CONSTRAINT plan_prices_pkey;
ALTER TABLE plan_prices ADD PRIMARY KEY (plan, period);
INSERT INTO plan_prices (plan, price, period) VALUES 
  ('premium', '29,99€', '/an'),
  ('gold', '49,99€', '/an'),
  ('vip', '59,99€', '/an');