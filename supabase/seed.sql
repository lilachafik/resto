-- Synthetic customers for development (emails use the reserved example.com domain)
insert into public.customers (name, email, phone, address) values
  ('נועה כהן',      'noa.cohen@example.com',      '050-1234567', 'רחוב הרצל 12, תל אביב'),
  ('איתי לוי',      'itay.levi@example.com',      '052-2345678', 'שדרות רוטשילד 45, תל אביב'),
  ('מאיה מזרחי',    'maya.mizrahi@example.com',   '054-3456789', 'רחוב יפו 88, ירושלים'),
  ('יונתן פרץ',     'yonatan.peretz@example.com', '053-4567890', 'רחוב הנביאים 3, חיפה'),
  ('תמר ביטון',     'tamar.biton@example.com',    '058-5678901', 'רחוב ויצמן 21, כפר סבא'),
  ('אורי אברהם',    'uri.avraham@example.com',    '050-6789012', 'רחוב סוקולוב 7, הרצליה'),
  ('שירה פרידמן',   'shira.friedman@example.com', '052-7890123', 'רחוב ז''בוטינסקי 150, רמת גן'),
  ('דניאל שפירא',   'daniel.shapira@example.com', '054-8901234', 'רחוב העצמאות 33, אשדוד'),
  ('ליה אזולאי',    'lia.azulay@example.com',     '053-9012345', 'שדרות בן גוריון 5, באר שבע'),
  ('עידו גולן',     'ido.golan@example.com',      '050-0123456', 'רחוב הגפן 14, מודיעין'),
  ('רוני דהן',      'roni.dahan@example.com',     '052-1122334', 'רחוב אחוזה 101, רעננה'),
  ('אביגיל כץ',     'avigail.katz@example.com',   '054-2233445', 'רחוב הרב קוק 9, נתניה'),
  ('עומר חדד',      'omer.hadad@example.com',     '058-3344556', 'רחוב הדקל 2, אילת'),
  ('הילה רוזן',     'hila.rosen@example.com',     '050-4455667', 'רחוב בגין 60, פתח תקווה'),
  ('גיא אלון',      'guy.alon@example.com',       '053-5566778', 'רחוב הזית 18, ראשון לציון'),
  ('יעל ברק',       'yael.barak@example.com',     '052-6677889', 'רחוב הכרמל 27, זכרון יעקב'),
  ('נדב שלום',      'nadav.shalom@example.com',   '054-7788990', 'רחוב המייסדים 4, רחובות'),
  ('אלה וקנין',     'ella.vaknin@example.com',    null,          'רחוב התמר 11, חולון'),
  ('בן סויסה',      null,                         '050-8899001', 'רחוב הים 6, בת ים'),
  ('מיכל טל',       'michal.tal@example.com',     '058-9900112', null);

-- Synthetic restaurants
insert into public.restaurants (name, address, phone) values
  ('הפלאפל של שמעון', 'רחוב הכרמל 40, תל אביב',       '03-5123456'),
  ('פיצה נאפולי',      'רחוב דיזנגוף 180, תל אביב',     '03-5234567'),
  ('סושי יאמה',        'רחוב עמק רפאים 22, ירושלים',    '02-6345678'),
  ('המטבח של סבתא',    'רחוב מסדה 15, חיפה',            '04-8456789'),
  ('בורגר סטיישן',     'רחוב אחוזה 90, רעננה',          '09-7567890'),
  ('שיפודי הגליל',     'רחוב הבנים 8, כרמיאל',          '04-9678901'),
  ('קפה לימון',        'שדרות רגר 30, באר שבע',         '08-6789012'),
  ('נודלס בר',         'רחוב הרצל 55, ראשון לציון',     '03-9890123');

-- 50 synthetic orders spread over the last 60 days, random customer and restaurant
insert into public.orders (customer_id, restaurant_id, created_at, total_amount, status)
select
  c.ids[1 + floor(random() * array_length(c.ids, 1))::int],
  r.ids[1 + floor(random() * array_length(r.ids, 1))::int],
  now() - random() * interval '60 days',
  round((40 + random() * 360)::numeric, 2),
  (array['delivered', 'delivered', 'delivered', 'preparing', 'pending', 'cancelled'])[1 + floor(random() * 6)::int]
from generate_series(1, 50),
  (select array_agg(id) as ids from public.customers) c,
  (select array_agg(id) as ids from public.restaurants) r;
