/**
 * Database schema for quotes with multi-window support
 * To be added to the main database schema
 */

const QUOTE_SCHEMA = `
-- Quotes table
CREATE TABLE IF NOT EXISTS quotes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  conversation_id INTEGER,           -- Link to WhatsApp conversation (optional)
  customer_id TEXT,                  -- Customer identifier (typically phone number)
  customer_name TEXT,                -- Customer's name
  customer_email TEXT,               -- Customer's email for sending quotes
  description TEXT,                  -- Project description
  status TEXT NOT NULL,              -- 'draft', 'complete', 'revision'
  quote_version INTEGER DEFAULT 1,   -- Version number of quote
  discount_rate REAL DEFAULT 0,      -- Overall discount rate (beyond quantity discount)
  tax_rate REAL DEFAULT 0.13,        -- Applied tax rate
  total_amount REAL,                 -- Pre-calculated total (for quick retrieval)
  sales_rep TEXT,                    -- Who created/owns this quote
  created_at TIMESTAMP NOT NULL,
  updated_at TIMESTAMP NOT NULL,
  expires_at TIMESTAMP,              -- Quote expiration date
  metadata TEXT,                     -- Additional metadata as JSON
  FOREIGN KEY (conversation_id) REFERENCES conversations (id) ON DELETE SET NULL
);

-- Quote Windows table - Each quote can have multiple windows
CREATE TABLE IF NOT EXISTS quote_windows (
  window_id INTEGER PRIMARY KEY AUTOINCREMENT,
  quote_id INTEGER NOT NULL,         -- Reference to parent quote
  location TEXT,                     -- Room/location like "Kitchen", "Master Bedroom"
  width REAL NOT NULL,
  height REAL NOT NULL,
  square_footage REAL NOT NULL,
  type TEXT NOT NULL,                -- 'standard', 'bay', 'shaped'
  operation_type TEXT NOT NULL,      -- 'Hung', 'Slider', 'Casement', 'Awning', 'Fixed'
  pane_count INTEGER NOT NULL,       -- 2 for double pane, 3 for triple pane
  glass_type TEXT NOT NULL,          -- 'clear', 'frosted', 'tinted'
  has_low_e BOOLEAN NOT NULL,
  has_grilles BOOLEAN NOT NULL,
  has_interior_color BOOLEAN NOT NULL DEFAULT 0,  -- True for non-white interior
  has_exterior_color BOOLEAN NOT NULL DEFAULT 0,  -- True for non-white exterior
  quantity INTEGER NOT NULL DEFAULT 1,
  base_price REAL NOT NULL,          -- Base window price
  options_price REAL NOT NULL,       -- Cost of all options
  bay_header_footer_cost REAL,       -- For bay windows only
  bay_siding_area REAL,              -- Square footage of bay window siding
  bay_siding_cost REAL,              -- Cost of bay window siding
  shaped_window_cost REAL,           -- Cost of arch section for shaped windows
  window_subtotal REAL NOT NULL,     -- Subtotal for this window
  installation_price REAL NOT NULL,  -- Installation cost for this window
  display_order INTEGER DEFAULT 0,   -- For controlling display sequence
  note TEXT,                         -- Special instructions for this window
  created_at TIMESTAMP NOT NULL,
  updated_at TIMESTAMP NOT NULL,
  FOREIGN KEY (quote_id) REFERENCES quotes (id) ON DELETE CASCADE
);

-- Quote Status History table - Tracks changes to quote status
CREATE TABLE IF NOT EXISTS quote_status_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  quote_id INTEGER NOT NULL,
  previous_status TEXT,
  new_status TEXT NOT NULL,
  changed_at TIMESTAMP NOT NULL,
  changed_by TEXT,                   -- User who changed the status
  notes TEXT,                        -- Reason for status change
  FOREIGN KEY (quote_id) REFERENCES quotes (id) ON DELETE CASCADE
);

-- Quote Files table - Tracks generated files for quotes
CREATE TABLE IF NOT EXISTS quote_files (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  quote_id INTEGER NOT NULL,
  file_type TEXT NOT NULL,           -- 'html', 'pdf', etc.
  file_path TEXT NOT NULL,           -- Relative path to file
  file_url TEXT NOT NULL,            -- URL for accessing file
  is_current BOOLEAN DEFAULT 1,      -- Whether this is the current version
  created_at TIMESTAMP NOT NULL,
  FOREIGN KEY (quote_id) REFERENCES quotes (id) ON DELETE CASCADE
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_quotes_customer_id ON quotes (customer_id);
CREATE INDEX IF NOT EXISTS idx_quotes_conversation_id ON quotes (conversation_id);
CREATE INDEX IF NOT EXISTS idx_quote_windows_quote_id ON quote_windows (quote_id);
CREATE INDEX IF NOT EXISTS idx_quote_status_history_quote_id ON quote_status_history (quote_id);
CREATE INDEX IF NOT EXISTS idx_quote_files_quote_id ON quote_files (quote_id);
`;

module.exports = QUOTE_SCHEMA;