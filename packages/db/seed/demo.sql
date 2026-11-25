-- Demo wedding used in the video. Vendors are teammates with scripted prices; replace phone numbers before running.
with w as (
  insert into weddings (couple, city, main_date, guests, total_budget, call_languages)
  values ('Riya and Arjun', 'Nagpur', '2026-12-12', 250, null, '{hi,mr}') returning id
)
insert into vendors (wedding_id, name, category, phone, area, language)
select w.id, v.name, v.category, v.phone, v.area, 'hi' from w, (values
  ('Sharma Caterers', 'food', '+91XXXXXXXXXX', 'Sitabuldi'),
  ('Annapurna Foods', 'food', '+91XXXXXXXXXX', 'Dharampeth'),
  ('Gupta Caterers', 'food', '+91XXXXXXXXXX', 'Sadar'),
  ('Royal Decor', 'decor', '+91XXXXXXXXXX', 'Civil Lines'),
  ('DJ Vicky', 'music', '+91XXXXXXXXXX', 'Sitabuldi')
) as v(name, category, phone, area);
