-- Users (operators, admins, accountants)
CREATE TABLE IF NOT EXISTS users (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  name          VARCHAR(100)  NOT NULL,
  email         VARCHAR(150)  UNIQUE NOT NULL,
  password_hash VARCHAR(255)  NOT NULL,
  role          ENUM('admin','agent','accountant') NOT NULL DEFAULT 'agent',
  is_active     TINYINT(1)    NOT NULL DEFAULT 1,
  created_at    TIMESTAMP     DEFAULT CURRENT_TIMESTAMP
);

-- Charger units
CREATE TABLE IF NOT EXISTS charger_units (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  charger_id    VARCHAR(50)   UNIQUE NOT NULL,
  display_name  VARCHAR(100),
  location      VARCHAR(255),
  last_seen     TIMESTAMP     NULL,
  status_a      ENUM('Available','Preparing','Charging','Finishing','Reserved','Unavailable','Faulted') DEFAULT 'Unavailable',
  status_b      ENUM('Available','Preparing','Charging','Finishing','Reserved','Unavailable','Faulted') DEFAULT 'Unavailable',
  created_at    TIMESTAMP     DEFAULT CURRENT_TIMESTAMP
);

-- Seed the two chargers
INSERT IGNORE INTO charger_units (charger_id, display_name, location)
VALUES
  ('KIGALI-DC160-001', 'Charger 1 — Bay A', 'Simple Charge, Kigali'),
  ('KIGALI-DC160-002', 'Charger 2 — Bay B', 'Simple Charge, Kigali');

-- kWh allocations (quota per agent)
CREATE TABLE IF NOT EXISTS kwh_allocations (
  id              INT AUTO_INCREMENT PRIMARY KEY,
  user_id         INT           NOT NULL,
  kwh_assigned    DECIMAL(10,3) NOT NULL DEFAULT 0,
  kwh_used        DECIMAL(10,3) NOT NULL DEFAULT 0,
  price_per_kwh   DECIMAL(10,2) NOT NULL DEFAULT 350.00,
  created_at      TIMESTAMP     DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id),
  INDEX idx_user (user_id)
);

-- Charging sessions
CREATE TABLE IF NOT EXISTS sessions (
  id              INT AUTO_INCREMENT PRIMARY KEY,
  user_id         INT           NOT NULL,
  charger_id      VARCHAR(50)   NOT NULL,
  connector       CHAR(1)       NOT NULL,
  connector_id    TINYINT       NOT NULL,
  transaction_id  INT           NULL,
  id_tag          VARCHAR(20)   NULL,
  kwh_consumed    DECIMAL(10,3) NOT NULL DEFAULT 0,
  total_frw       DECIMAL(12,2) NOT NULL DEFAULT 0,
  price_per_kwh   DECIMAL(10,2) NOT NULL,
  budget_frw      DECIMAL(12,2) NULL,
  status          ENUM('pending','active','completed','faulted') DEFAULT 'pending',
  start_time      TIMESTAMP     NULL,
  end_time        TIMESTAMP     NULL,
  created_at      TIMESTAMP     DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id),
  INDEX idx_charger_status (charger_id, status),
  INDEX idx_transaction   (transaction_id),
  INDEX idx_user_time     (user_id, start_time)
);

-- Invoices
CREATE TABLE IF NOT EXISTS invoices (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  session_id    INT           UNIQUE NOT NULL,
  user_id       INT           NOT NULL,
  customer_name VARCHAR(150)  NOT NULL DEFAULT 'Walk-in Customer',
  kwh           DECIMAL(10,3) NOT NULL,
  price_per_kwh DECIMAL(10,2) NOT NULL,
  total_frw     DECIMAL(12,2) NOT NULL,
  pdf_path      VARCHAR(255)  NULL,
  created_at    TIMESTAMP     DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (session_id) REFERENCES sessions(id),
  FOREIGN KEY (user_id)    REFERENCES users(id)
);

-- Inventory / kWh purchase log
CREATE TABLE IF NOT EXISTS inventory_log (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  type          ENUM('purchase','sale') NOT NULL,
  user_id       INT           NULL,
  session_id    INT           NULL,
  kwh           DECIMAL(10,3) NOT NULL,
  price_per_kwh DECIMAL(10,2) NOT NULL,
  total_frw     DECIMAL(12,2) NOT NULL,
  note          VARCHAR(255),
  created_at    TIMESTAMP     DEFAULT CURRENT_TIMESTAMP
);

-- RFID cards
CREATE TABLE IF NOT EXISTS rfid_cards (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  user_id     INT           NOT NULL,
  card_uid    VARCHAR(50)   UNIQUE NOT NULL,
  label       VARCHAR(100),
  is_active   TINYINT(1)    DEFAULT 1,
  issued_at   TIMESTAMP     DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id),
  UNIQUE INDEX idx_card_uid (card_uid)
);

-- Run `npm run db:seed` to insert the default admin user (admin@simplecharge.rw / Admin@1234)
