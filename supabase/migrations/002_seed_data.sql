-- =====================================================
-- Seed Data: Contractors, Projects, Rejection Reasons
-- =====================================================

-- Contractors
INSERT INTO contractors (name) VALUES
  ('Аксиома'),
  ('Войс'),
  ('РБО'),
  ('Мещеряков');

-- Projects → Contractor mapping
INSERT INTO projects (name, contractor_id) VALUES
  ('АЛХИМОВО',                   (SELECT id FROM contractors WHERE name = 'Аксиома')),
  ('Мытищи Парк',               (SELECT id FROM contractors WHERE name = 'Аксиома')),
  ('Эко Бунино',                (SELECT id FROM contractors WHERE name = 'Аксиома')),
  ('ТОМИЛИНО',                  (SELECT id FROM contractors WHERE name = 'Аксиома')),
  ('Егорово парк',              (SELECT id FROM contractors WHERE name = 'Аксиома')),
  ('ОСТАФЬЕВО',                 (SELECT id FROM contractors WHERE name = 'Аксиома')),
  ('Новоград Павлино',          (SELECT id FROM contractors WHERE name = 'Войс')),
  ('Тропарево Парк',            (SELECT id FROM contractors WHERE name = 'Войс')),
  ('Горки парк',                (SELECT id FROM contractors WHERE name = 'Войс')),
  ('Горки Парк',                (SELECT id FROM contractors WHERE name = 'Войс')),
  ('ЦВЕТОЧНЫЕ ПОЛЯНЫ ЭКОПАРК',  (SELECT id FROM contractors WHERE name = 'Войс')),
  ('ЛЮБЕРЦЫ',                   (SELECT id FROM contractors WHERE name = 'РБО')),
  ('Прибрежный Парк',           (SELECT id FROM contractors WHERE name = 'РБО')),
  ('Заречье Парк',              (SELECT id FROM contractors WHERE name = 'РБО')),
  ('Рублевский Квартал',        (SELECT id FROM contractors WHERE name = 'РБО')),
  ('НОВОЕ ВНУКОВО',             (SELECT id FROM contractors WHERE name = 'РБО')),
  ('ПУТИЛКОВО',                 (SELECT id FROM contractors WHERE name = 'РБО')),
  ('ПРИГОРОД',                  (SELECT id FROM contractors WHERE name = 'Мещеряков')),
  ('Квартал Ивакино',           (SELECT id FROM contractors WHERE name = 'Мещеряков')),
  ('Вереск',                    (SELECT id FROM contractors WHERE name = 'Мещеряков')),
  ('СПУТНИК',                   (SELECT id FROM contractors WHERE name = 'Мещеряков')),
  ('Квартал на воде',           (SELECT id FROM contractors WHERE name = 'Мещеряков')),
  ('МОЛЖАНИНОВО',               (SELECT id FROM contractors WHERE name = 'Мещеряков')),
  ('Пятницкое 58',              (SELECT id FROM contractors WHERE name = 'Мещеряков')),
  ('Пятницкие Луга',            (SELECT id FROM contractors WHERE name = 'Мещеряков')),
  ('Квартал Строгино',          (SELECT id FROM contractors WHERE name = 'Мещеряков')),
  ('Квартал Авиаторов',         (SELECT id FROM contractors WHERE name = 'Мещеряков')),
  ('НОВОЕ ВИДНОЕ',              (SELECT id FROM contractors WHERE name = 'Мещеряков'));

-- Normalized rejection reasons
INSERT INTO rejection_reasons (label, sort_order) VALUES
  ('Ключей нет',                 1),
  ('Живут люди',                 2),
  ('В аренде',                   3),
  ('Сломан замок',               4),
  ('Нет доступа',                5),
  ('Плесень',                    6),
  ('Территория закрыта',         7),
  ('Заставлена мебелью',         8),
  ('Корпус не сдан/строится',    9),
  ('Квартира не сдана',         10),
  ('Залив',                     11),
  ('Ремонт',                    12),
  ('Продана',                   13),
  ('Дверь не открывается',      14),
  ('Другое',                    15);
