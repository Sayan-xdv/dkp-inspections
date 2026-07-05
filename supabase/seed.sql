-- =====================================================
-- DKP Inspections — ДЕМО-СИД (полный пересев)
--
-- Идемпотентный: можно запускать сколько угодно раз.
-- ВНИМАНИЕ: таблицы данных (apartments, status_history,
-- notifications, import_batches) ОЧИЩАЮТСЯ и пересеиваются.
-- Справочники и пользователи — upsert без потерь.
--
-- Все даты — относительно CURRENT_DATE, графики дашборда
-- всегда «живые» независимо от дня запуска.
--
-- Запуск: целиком через SQL-редактор Supabase или MCP.
-- Демо-пароль всех пользователей: Demo2026!
-- =====================================================

-- ---------- 1. Справочники (upsert) ----------

INSERT INTO contractors (name) VALUES
  ('Аксиома'), ('Войс'), ('РБО'), ('Мещеряков')
ON CONFLICT (name) DO NOTHING;

INSERT INTO projects (name, contractor_id)
SELECT p.name, c.id FROM (VALUES
  ('АЛХИМОВО', 'Аксиома'), ('Мытищи Парк', 'Аксиома'), ('Эко Бунино', 'Аксиома'),
  ('ТОМИЛИНО', 'Аксиома'), ('Егорово парк', 'Аксиома'), ('ОСТАФЬЕВО', 'Аксиома'),
  ('Новоград Павлино', 'Войс'), ('Тропарево Парк', 'Войс'), ('Горки парк', 'Войс'),
  ('Горки Парк', 'Войс'), ('ЦВЕТОЧНЫЕ ПОЛЯНЫ ЭКОПАРК', 'Войс'),
  ('ЛЮБЕРЦЫ', 'РБО'), ('Прибрежный Парк', 'РБО'), ('Заречье Парк', 'РБО'),
  ('Рублевский Квартал', 'РБО'), ('НОВОЕ ВНУКОВО', 'РБО'), ('ПУТИЛКОВО', 'РБО'),
  ('ПРИГОРОД', 'Мещеряков'), ('Квартал Ивакино', 'Мещеряков'), ('Вереск', 'Мещеряков'),
  ('СПУТНИК', 'Мещеряков'), ('Квартал на воде', 'Мещеряков'), ('МОЛЖАНИНОВО', 'Мещеряков'),
  ('Пятницкое 58', 'Мещеряков'), ('Пятницкие Луга', 'Мещеряков'),
  ('Квартал Строгино', 'Мещеряков'), ('Квартал Авиаторов', 'Мещеряков'),
  ('НОВОЕ ВИДНОЕ', 'Мещеряков')
) AS p(name, contractor)
JOIN contractors c ON c.name = p.contractor
ON CONFLICT (name) DO NOTHING;

INSERT INTO rejection_reasons (label, sort_order) VALUES
  ('Ключей нет', 1), ('Живут люди', 2), ('В аренде', 3), ('Сломан замок', 4),
  ('Нет доступа', 5), ('Плесень', 6), ('Территория закрыта', 7),
  ('Заставлена мебелью', 8), ('Корпус не сдан/строится', 9), ('Квартира не сдана', 10),
  ('Залив', 11), ('Ремонт', 12), ('Продана', 13), ('Дверь не открывается', 14),
  ('Другое', 15)
ON CONFLICT (label) DO NOTHING;

-- ---------- 2. Демо-пользователи (создать недостающих, пароль Demo2026!) ----------

DO $$
DECLARE
  u RECORD;
  new_id UUID;
  inst UUID;
BEGIN
  SELECT COALESCE(
    (SELECT instance_id FROM auth.users LIMIT 1),
    '00000000-0000-0000-0000-000000000000'::uuid
  ) INTO inst;

  FOR u IN
    SELECT * FROM (VALUES
      ('admin@dkp.samolet.ru',         'Администратор'),
      ('keys@dkp.samolet.ru',          'Офис заселения (ключи)'),
      ('aksioma@dkp.samolet.ru',       'Аксиома (подрядчик)'),
      ('voice@dkp.samolet.ru',         'Войс (подрядчик)'),
      ('rbo@dkp.samolet.ru',           'РБО (подрядчик)'),
      ('meshcheryakov@dkp.samolet.ru', 'Мещеряков (подрядчик)')
    ) AS t(email, full_name)
  LOOP
    IF NOT EXISTS (SELECT 1 FROM auth.users au WHERE au.email = u.email) THEN
      new_id := gen_random_uuid();
      INSERT INTO auth.users (
        instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
        raw_app_meta_data, raw_user_meta_data,
        created_at, updated_at, confirmation_token, recovery_token,
        email_change_token_new, email_change
      ) VALUES (
        inst, new_id, 'authenticated', 'authenticated',
        u.email, crypt('Demo2026!', gen_salt('bf', 10)), now(),
        '{"provider":"email","providers":["email"]}'::jsonb,
        jsonb_build_object('full_name', u.full_name),
        now(), now(), '', '', '', ''
      );
      INSERT INTO auth.identities (
        id, user_id, provider, provider_id, identity_data,
        last_sign_in_at, created_at, updated_at
      ) VALUES (
        gen_random_uuid(), new_id, 'email', new_id::text,
        jsonb_build_object('sub', new_id::text, 'email', u.email, 'email_verified', true),
        now(), now(), now()
      );
    ELSE
      -- юзер существует — сбрасываем демо-пароль (после wipe пароль выживает, но
      -- unified-пароль удобнее для демо)
      UPDATE auth.users
      SET encrypted_password = crypt('Demo2026!', gen_salt('bf', 10)),
          email_confirmed_at = COALESCE(email_confirmed_at, now()),
          updated_at = now()
      WHERE email = u.email;
      -- identity могла потеряться
      INSERT INTO auth.identities (id, user_id, provider, provider_id, identity_data, last_sign_in_at, created_at, updated_at)
      SELECT gen_random_uuid(), au.id, 'email', au.id::text,
             jsonb_build_object('sub', au.id::text, 'email', au.email, 'email_verified', true),
             now(), now(), now()
      FROM auth.users au
      WHERE au.email = u.email
        AND NOT EXISTS (SELECT 1 FROM auth.identities i WHERE i.user_id = au.id AND i.provider = 'email');
    END IF;
  END LOOP;
END $$;

-- ---------- 3. Профили (upsert по auth.users) ----------

INSERT INTO profiles (id, email, full_name, role, contractor_id)
SELECT au.id, au.email, m.full_name, m.role::app_role,
       (SELECT c.id FROM contractors c WHERE c.name = m.contractor)
FROM (VALUES
  ('admin@dkp.samolet.ru',         'Администратор',           'admin',      NULL),
  ('keys@dkp.samolet.ru',          'Офис заселения (ключи)',  'settlement', NULL),
  ('aksioma@dkp.samolet.ru',       'Аксиома (подрядчик)',     'contractor', 'Аксиома'),
  ('voice@dkp.samolet.ru',         'Войс (подрядчик)',        'contractor', 'Войс'),
  ('rbo@dkp.samolet.ru',           'РБО (подрядчик)',         'contractor', 'РБО'),
  ('meshcheryakov@dkp.samolet.ru', 'Мещеряков (подрядчик)',   'contractor', 'Мещеряков')
) AS m(email, full_name, role, contractor)
JOIN auth.users au ON au.email = m.email
ON CONFLICT (id) DO UPDATE
SET role = EXCLUDED.role,
    full_name = EXCLUDED.full_name,
    contractor_id = EXCLUDED.contractor_id;

-- ---------- 4. Очистка таблиц данных ----------

DELETE FROM status_history;
DELETE FROM notifications;
DELETE FROM apartments;
DELETE FROM import_batches;

-- ---------- 5. Импорт-батчи (3 шт., относительные даты) ----------

INSERT INTO import_batches (uploaded_by, filename, total_rows, imported_rows, skipped_rows, duplicate_rows, created_at)
SELECT
  (SELECT id FROM profiles WHERE role = 'admin' LIMIT 1),
  'Объект недвижимости расширенный поиск ' || to_char(CURRENT_DATE - offs, 'YYYY-MM-DD') || '.xlsx',
  total, imported, skipped, dup,
  (CURRENT_DATE - offs)::timestamptz + INTERVAL '9 hours'
FROM (VALUES
  (40, 184, 142, 28, 14),
  (20,  96,  78, 12,  6),
  ( 3, 120,  80, 31,  9)
) AS t(offs, total, imported, skipped, dup);

-- ---------- 6. 300 квартир + история статусов ----------

DO $$
DECLARE
  i INT;
  total INT := 300;
  status_val apartment_status;
  contractor_uuid UUID;
  contractor_choice INT;
  project_rec RECORD;
  receipt DATE;
  assigned_ts TIMESTAMPTZ;
  completed_ts TIMESTAMPTZ;
  uploaded_ts TIMESTAMPTZ;
  keys_ts TIMESTAMPTZ;
  apt_id UUID;
  area NUMERIC;
  finish TEXT;
  scheme TEXT;
  client TEXT;
  street TEXT;
  ovp TEXT;
  is_overdue BOOLEAN;
  rejection_uuid UUID;
  rejection_text TEXT;
  batch_uuid UUID;
  today DATE := CURRENT_DATE;
  names TEXT[] := ARRAY['Иванов И. С.','Петрова А. А.','Смирнова Л. В.','Кузнецов М. Е.','Соколова Ю. Н.','Попов В. К.','Лебедев Д. С.','Козлов Е. А.','Новикова О. Р.','Морозов А. И.','Волков С. Б.','Соловьёва И. К.','Васильев П. А.','Зайцева Н. С.','Павлова Е. В.','Семёнов Р. О.','Голубев К. Д.','Виноградова М. А.','Богданов Т. А.','Воробьёва Г. Н.','Фёдоров А. А.','Михайлов И. И.','Беляева В. С.','Тарасов О. К.','Белова Н. А.','Комарова Е. Е.','Орлов А. В.','Киселёв И. С.','Макарова Л. Г.','Андреев Д. М.'];
  streets TEXT[] := ARRAY['г. Москва, ул. Профсоюзная','г. Москва, Каширское ш.','МО, г. Мытищи, ул. Юбилейная','МО, г. Люберцы, пр. Победы','МО, г. Видное, ул. Зелёная','МО, г. Химки, ул. Молодёжная','г. Москва, ул. Лётчика Бабушкина','МО, г. Подольск, ул. Кирова','МО, г. Балашиха, ш. Энтузиастов','МО, г. Реутов, ул. Юбилейная','МО, г. Красногорск, ул. Ленина','МО, г. Одинцово, Можайское ш.','г. Москва, ул. Островитянова','г. Москва, ул. Адмирала Лазарева'];
  finishes TEXT[] := ARRAY['Стандарт','Стандарт','Стандарт','Стандарт','Евро','Евро','Евро','Евро','Премиум','Без отделки'];
  schemes TEXT[] := ARRAY['Ипотека','Ипотека','Ипотека','Полная оплата','Рассрочка'];
  rejection_notes TEXT[] := ARRAY['Подрядчик не смог попасть, дозвон до клиента не удался','Клиент перенёс встречу на следующую неделю','Доступ ограничен охраной ЖК','Соседи сказали, что квартира сдана в аренду','По адресу никого не оказалось дважды'];
  -- Кумулятивные пороги статусов: 38/22/6/68/52/28/41/45
  status_thresholds INT[] := ARRAY[38, 60, 66, 134, 186, 214, 255, 300];
BEGIN
  FOR i IN 1..total LOOP
    IF i <= status_thresholds[1] THEN status_val := 'pending_keys';
    ELSIF i <= status_thresholds[2] THEN status_val := 'keys_unavailable';
    ELSIF i <= status_thresholds[3] THEN status_val := 'keys_available';
    ELSIF i <= status_thresholds[4] THEN status_val := 'assigned';
    ELSIF i <= status_thresholds[5] THEN status_val := 'in_progress';
    ELSIF i <= status_thresholds[6] THEN status_val := 'rejected';
    ELSIF i <= status_thresholds[7] THEN status_val := 'completed';
    ELSE status_val := 'uploaded_to_crm';
    END IF;

    -- Распределение Аксиома/Войс/РБО/Мещеряков = 3/2/3/4 из каждых 12
    contractor_choice := i % 12;
    SELECT id INTO contractor_uuid FROM contractors WHERE name = (
      CASE
        WHEN contractor_choice IN (0,1,2) THEN 'Аксиома'
        WHEN contractor_choice IN (3,4) THEN 'Войс'
        WHEN contractor_choice IN (5,6,7) THEN 'РБО'
        ELSE 'Мещеряков'
      END
    );

    SELECT id, name INTO project_rec FROM projects
      WHERE contractor_id = contractor_uuid AND is_active = true
      ORDER BY md5((i::text || name)) LIMIT 1;

    -- ~20% assigned/in_progress — просрочены (SLA 7 дней)
    is_overdue := (status_val IN ('assigned','in_progress') AND (i % 5 = 0));

    IF status_val = 'pending_keys' THEN
      receipt := today - (1 + (i % 10));
      assigned_ts := NULL; completed_ts := NULL; uploaded_ts := NULL; keys_ts := NULL;
      contractor_uuid := NULL;
    ELSIF status_val = 'keys_unavailable' THEN
      receipt := today - (3 + (i % 14));
      keys_ts := (receipt + INTERVAL '1 day')::timestamptz;
      assigned_ts := NULL; completed_ts := NULL; uploaded_ts := NULL;
      contractor_uuid := NULL;
    ELSIF status_val = 'keys_available' THEN
      receipt := today - (1 + (i % 3));
      keys_ts := (receipt + INTERVAL '1 day')::timestamptz;
      assigned_ts := NULL; completed_ts := NULL; uploaded_ts := NULL;
    ELSIF status_val = 'assigned' THEN
      IF is_overdue THEN
        receipt := today - (10 + (i % 14));
        assigned_ts := (today - (8 + (i % 7)))::timestamptz;
      ELSE
        receipt := today - (2 + (i % 5));
        assigned_ts := (today - (1 + (i % 3)))::timestamptz;
      END IF;
      keys_ts := assigned_ts - INTERVAL '1 day';
      completed_ts := NULL; uploaded_ts := NULL;
    ELSIF status_val = 'in_progress' THEN
      IF is_overdue THEN
        receipt := today - (14 + (i % 14));
        assigned_ts := (today - (10 + (i % 5)))::timestamptz;
      ELSE
        receipt := today - (5 + (i % 7));
        assigned_ts := (today - (3 + (i % 4)))::timestamptz;
      END IF;
      keys_ts := assigned_ts - INTERVAL '1 day';
      completed_ts := NULL; uploaded_ts := NULL;
    ELSIF status_val = 'rejected' THEN
      receipt := today - (6 + (i % 18));
      assigned_ts := (receipt + INTERVAL '1 day')::timestamptz;
      keys_ts := assigned_ts - INTERVAL '12 hours';
      completed_ts := NULL; uploaded_ts := NULL;
    ELSIF status_val = 'completed' THEN
      receipt := today - (10 + (i % 22));
      assigned_ts := (receipt + INTERVAL '1 day')::timestamptz;
      keys_ts := assigned_ts - INTERVAL '12 hours';
      completed_ts := assigned_ts + INTERVAL '4 days' + ((i % 6) || ' days')::interval;
      uploaded_ts := NULL;
    ELSE -- uploaded_to_crm
      receipt := today - (14 + (i % 42));
      assigned_ts := (receipt + INTERVAL '1 day')::timestamptz;
      keys_ts := assigned_ts - INTERVAL '12 hours';
      completed_ts := assigned_ts + INTERVAL '5 days' + ((i % 8) || ' days')::interval;
      uploaded_ts := completed_ts + INTERVAL '1 day' + ((i % 4) || ' days')::interval;
    END IF;

    area := 28 + (i % 165) * 0.5;
    finish := finishes[1 + (i % array_length(finishes,1))];
    scheme := schemes[1 + (i % array_length(schemes,1))];
    client := names[1 + (i % array_length(names,1))];
    street := streets[1 + (i % array_length(streets,1))];
    ovp := CASE WHEN i % 10 = 0 THEN 'Принята ПК' ELSE 'Принята в ОВП' END;

    IF status_val = 'rejected' THEN
      SELECT id INTO rejection_uuid FROM rejection_reasons ORDER BY md5(i::text) LIMIT 1;
      rejection_text := rejection_notes[1 + (i % array_length(rejection_notes,1))];
    ELSE
      rejection_uuid := NULL;
      rejection_text := NULL;
    END IF;

    SELECT id INTO batch_uuid FROM import_batches
      ORDER BY ABS(created_at::date - receipt) LIMIT 1;

    apt_id := gen_random_uuid();

    INSERT INTO apartments (
      id, crm_code, project_name, project_id, address, building_number,
      apartment_number, area_sqm, finish_type, ovp_status, client_name,
      contract_number, contract_date, contract_amount, contract_expiry, sale_scheme,
      status, contractor_id, receipt_date, deadline,
      keys_confirmed_at, assigned_at, completed_at, uploaded_to_crm_at,
      keys_available, rejection_reason_id, rejection_note, import_batch_id,
      created_at, updated_at
    ) VALUES (
      apt_id,
      'СМ-' || to_char(today, 'YYYY') || '-' || lpad(i::text, 5, '0'),
      project_rec.name, project_rec.id,
      street || ', к. ' || (1 + (i % 7))::text,
      (1 + (i % 7))::text,
      (10 + (i * 7) % 420)::text,
      area, finish, ovp, client,
      'ДКП-' || to_char(today, 'YY') || '-' || lpad((1000 + i)::text, 4, '0'),
      (today - (30 + i % 90))::date,
      (area * (220000 + (i % 200) * 1000))::numeric,
      (today + INTERVAL '1 year')::date,
      scheme, status_val, contractor_uuid, receipt, receipt + 14,
      keys_ts, assigned_ts, completed_ts, uploaded_ts,
      CASE WHEN status_val = 'keys_unavailable' THEN false
           WHEN status_val IN ('keys_available','assigned','in_progress','rejected','completed','uploaded_to_crm') THEN true
           ELSE NULL END,
      rejection_uuid, rejection_text, batch_uuid,
      COALESCE(assigned_ts, keys_ts, receipt::timestamptz),
      COALESCE(uploaded_ts, completed_ts, assigned_ts, keys_ts, receipt::timestamptz)
    )
    ON CONFLICT (crm_code) DO NOTHING;

    -- Ретроспективная история статусов
    IF status_val IN ('keys_available','assigned','in_progress','rejected','completed','uploaded_to_crm') THEN
      INSERT INTO status_history (apartment_id, old_status, new_status, created_at)
      VALUES (apt_id, 'pending_keys', 'keys_available', keys_ts);
    ELSIF status_val = 'keys_unavailable' THEN
      INSERT INTO status_history (apartment_id, old_status, new_status, created_at)
      VALUES (apt_id, 'pending_keys', 'keys_unavailable', keys_ts);
    END IF;

    IF status_val IN ('assigned','in_progress','rejected','completed','uploaded_to_crm') THEN
      INSERT INTO status_history (apartment_id, old_status, new_status, created_at)
      VALUES (apt_id, 'keys_available', 'assigned', assigned_ts);
    END IF;

    IF status_val IN ('in_progress','completed','uploaded_to_crm') THEN
      INSERT INTO status_history (apartment_id, old_status, new_status, created_at)
      VALUES (apt_id, 'assigned', 'in_progress', assigned_ts + INTERVAL '1 day');
    END IF;

    IF status_val = 'rejected' THEN
      INSERT INTO status_history (apartment_id, old_status, new_status, reason, created_at)
      VALUES (apt_id, 'assigned', 'rejected', rejection_text, assigned_ts + INTERVAL '2 days');
    END IF;

    IF status_val IN ('completed','uploaded_to_crm') THEN
      INSERT INTO status_history (apartment_id, old_status, new_status, created_at)
      VALUES (apt_id, 'in_progress', 'completed', completed_ts);
    END IF;

    IF status_val = 'uploaded_to_crm' THEN
      INSERT INTO status_history (apartment_id, old_status, new_status, created_at)
      VALUES (apt_id, 'completed', 'uploaded_to_crm', uploaded_ts);
    END IF;
  END LOOP;
END $$;

-- ---------- 7. Уведомления (8 шт., относительные даты) ----------

INSERT INTO notifications (type, recipient_contractor_id, apartment_ids, subject, body, sent_by, sent_at)
SELECT
  'overdue_reminder',
  c.id,
  ARRAY(SELECT id FROM apartments WHERE contractor_id = c.id AND status IN ('assigned','in_progress') LIMIT 5),
  'Напоминание о просроченных экспертизах — ' || c.name,
  'Уважаемый партнёр «' || c.name || '», у вас числятся просроченные экспертизы. Просим сдать отчёты в ближайшее время. С уважением, департамент ДКП.',
  (SELECT id FROM profiles WHERE role = 'admin' LIMIT 1),
  now() - (t.days_ago || ' days')::interval - INTERVAL '3 hours'
FROM contractors c
JOIN (VALUES
  ('Аксиома', 1), ('Войс', 2), ('РБО', 3), ('Аксиома', 5), ('Мещеряков', 5)
) AS t(contractor, days_ago) ON t.contractor = c.name;

INSERT INTO notifications (type, recipient_contractor_id, apartment_ids, subject, body, sent_by, sent_at)
VALUES
  ('custom', (SELECT id FROM contractors WHERE name = 'Аксиома'), '{}',
   'Запрос обновления статусов',
   'Просим обновить статусы по квартирам в проекте «АЛХИМОВО» до конца недели.',
   (SELECT id FROM profiles WHERE role = 'admin' LIMIT 1), now() - INTERVAL '6 hours'),
  ('custom', NULL, '{}',
   'Информационная рассылка о новом регламенте',
   'Доводим до сведения подрядчиков обновлённые требования к фотофиксации актов осмотра.',
   (SELECT id FROM profiles WHERE role = 'admin' LIMIT 1), now() - INTERVAL '6 days'),
  ('overdue_reminder', (SELECT id FROM contractors WHERE name = 'РБО'), '{}',
   'Повторное напоминание — РБО',
   'Повторно просим обратить внимание на задержки в проекте «Прибрежный Парк».',
   (SELECT id FROM profiles WHERE role = 'admin' LIMIT 1), now() - INTERVAL '6 days 20 hours');

-- ---------- 8. Контроль ----------

SELECT 'apartments' AS entity, COUNT(*)::text AS cnt FROM apartments
UNION ALL SELECT 'status_history', COUNT(*)::text FROM status_history
UNION ALL SELECT 'notifications', COUNT(*)::text FROM notifications
UNION ALL SELECT 'import_batches', COUNT(*)::text FROM import_batches
UNION ALL SELECT 'profiles', COUNT(*)::text FROM profiles
UNION ALL SELECT 'contractors', COUNT(*)::text FROM contractors
UNION ALL SELECT 'projects', COUNT(*)::text FROM projects;
