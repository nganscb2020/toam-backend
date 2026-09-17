const Database = require('better-sqlite3'); 
const path = require('path'); 

const fs = require('fs'); const dataDir = path.join(__dirname, 'data'); if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
const dbPath = path.join(dataDir, 'toam.db'); const db = new Database(dbPath);  

db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// Bảng người dùng
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    phone TEXT,
    password_hash TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now'))
  )
`);

// Bảng tin đăng
db.exec(`
  CREATE TABLE IF NOT EXISTS listings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    listing_type TEXT NOT NULL,
    category TEXT NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    price REAL NOT NULL,
    price_unit TEXT DEFAULT 'ty',
    address TEXT NOT NULL,
    bedrooms INTEGER,
    bathrooms INTEGER,
    area REAL,
    image_path TEXT,
    status TEXT DEFAULT 'active' CHECK(status IN ('active','hidden')),
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  )
`);

// Di trú an toàn: nếu bảng listings cũ còn giới hạn CHECK(listing_type IN ('sale','rent'))
// (từ phiên bản trước khi có loại 'transfer' - sang nhượng), dựng lại bảng mà không mất dữ liệu.
const listingsTableInfo = db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='listings'").get();
if (listingsTableInfo && listingsTableInfo.sql.includes("CHECK(listing_type IN ('sale','rent'))")) {
  db.pragma('foreign_keys = OFF');
  const migrate = db.transaction(() => {
    db.exec(`
      CREATE TABLE listings_new (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        listing_type TEXT NOT NULL,
        category TEXT NOT NULL,
        title TEXT NOT NULL,
        description TEXT,
        price REAL NOT NULL,
        price_unit TEXT DEFAULT 'ty',
        address TEXT NOT NULL,
        bedrooms INTEGER,
        bathrooms INTEGER,
        area REAL,
        image_path TEXT,
        status TEXT DEFAULT 'active' CHECK(status IN ('active','hidden')),
        created_at TEXT DEFAULT (datetime('now')),
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `);
    db.exec(`INSERT INTO listings_new SELECT * FROM listings`);
    db.exec(`DROP TABLE listings`);
    db.exec(`ALTER TABLE listings_new RENAME TO listings`);
  });
  migrate();
  db.pragma('foreign_keys = ON');
}

db.exec(`CREATE INDEX IF NOT EXISTS idx_listings_type ON listings(listing_type)`);
db.exec(`CREATE INDEX IF NOT EXISTS idx_listings_user ON listings(user_id)`);

// Di trú an toàn: thêm các cột địa điểm chi tiết + tiện ích nếu bảng cũ chưa có
const listingColumns = db.prepare("PRAGMA table_info(listings)").all().map(c => c.name);
const listingColumnsToAdd = [
  ['province', "TEXT"],
  ['ward', "TEXT"],
  ['street', "TEXT"],
  ['width', "REAL"],
  ['length', "REAL"],
  ['has_income', "INTEGER DEFAULT 0"],
  ['has_furniture', "INTEGER DEFAULT 0"],
  ['has_elevator', "INTEGER DEFAULT 0"],
  ['car_alley', "INTEGER DEFAULT 0"],
  ['is_vip', "INTEGER DEFAULT 0"]
];
for (const [col, def] of listingColumnsToAdd) {
  if (!listingColumns.includes(col)) {
    db.exec(`ALTER TABLE listings ADD COLUMN ${col} ${def}`);
  }
}
db.exec(`CREATE INDEX IF NOT EXISTS idx_listings_province ON listings(province)`);

// Bảng media (nhiều ảnh/video cho mỗi tin đăng)
db.exec(`
  CREATE TABLE IF NOT EXISTS listing_media (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    listing_id INTEGER NOT NULL,
    media_type TEXT NOT NULL CHECK(media_type IN ('image','video')),
    file_path TEXT NOT NULL,
    sort_order INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (listing_id) REFERENCES listings(id) ON DELETE CASCADE
  )
`);
db.exec(`CREATE INDEX IF NOT EXISTS idx_media_listing ON listing_media(listing_id)`);

// Bảng tin tức bất động sản (dùng chung cho: Tin tức, Tư vấn luật, Thiết kế kiến trúc — phân biệt qua cột category)
db.exec(`
  CREATE TABLE IF NOT EXISTS news (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    title TEXT NOT NULL,
    excerpt TEXT,
    content TEXT NOT NULL,
    image_path TEXT,
    category TEXT NOT NULL DEFAULT 'tin-tuc',
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  )
`);
// Di trú an toàn: nếu bảng news đã tồn tại từ trước (chưa có cột category) thì thêm vào
const newsColumns = db.prepare("PRAGMA table_info(news)").all().map(c => c.name);
if (!newsColumns.includes('category')) {
  db.exec(`ALTER TABLE news ADD COLUMN category TEXT NOT NULL DEFAULT 'tin-tuc'`);
}
db.exec(`CREATE INDEX IF NOT EXISTS idx_news_created ON news(created_at)`);
db.exec(`CREATE INDEX IF NOT EXISTS idx_news_category ON news(category)`);

// Bảng dự án bất động sản
db.exec(`
  CREATE TABLE IF NOT EXISTS projects (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    location TEXT,
    description TEXT,
    image_path TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  )
`);
db.exec(`CREATE INDEX IF NOT EXISTS idx_projects_created ON projects(created_at)`);

// Bảng tin sang nhượng (cửa hàng, khách sạn, quán cafe, mặt bằng kinh doanh)
db.exec(`
  CREATE TABLE IF NOT EXISTS transfers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    category TEXT NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    price REAL,
    price_unit TEXT DEFAULT 'trieu',
    address TEXT NOT NULL,
    area REAL,
    image_path TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  )
`);
db.exec(`CREATE INDEX IF NOT EXISTS idx_transfers_category ON transfers(category)`);

module.exports = db;
