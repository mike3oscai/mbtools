-- Tabla de programas (cabecera)
CREATE TABLE IF NOT EXISTS programs (
  id TEXT PRIMARY KEY,
  createdAt TEXT NOT NULL,
  programNumber TEXT NOT NULL,
  programType TEXT NOT NULL,
  geo TEXT NOT NULL,
  country TEXT NOT NULL,
  vertical TEXT NOT NULL,
  customer TEXT NOT NULL,
  startDay TEXT NOT NULL,
  endDay TEXT
);

-- Líneas de programa (detalle)
CREATE TABLE IF NOT EXISTS program_lines (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  program_id TEXT NOT NULL,
  pn TEXT NOT NULL,
  description TEXT,
  rrp REAL,
  promoRrp REAL,
  vatOnRrp TEXT,
  rebate REAL,
  maxQty REAL,
  totalProgramRebate REAL,
  lineProgramNumber TEXT,
  FOREIGN KEY(program_id) REFERENCES programs(id)
);

-- Índices útiles
CREATE INDEX IF NOT EXISTS idx_programs_programNumber ON programs(programNumber);
CREATE INDEX IF NOT EXISTS idx_lines_program_id ON program_lines(program_id);
