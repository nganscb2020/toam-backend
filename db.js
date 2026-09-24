// Kết nối cơ sở dữ liệu MySQL (dùng cho hosting kiểu Hostinger — không hỗ trợ SQLite).
// Đọc thông tin kết nối từ biến môi trường DB_HOST/DB_PORT/DB_USER/DB_PASSWORD/DB_NAME —
// đúng tên biến mà Hostinger dùng trong hướng dẫn "Connecting a MySQL database to a Node.js app".
const mysql = require('mysql2/promise');

const REQUIRED = ['DB_HOST', 'DB_USER', 'DB_PASSWORD', 'DB_NAME'];
const missing = REQUIRED.filter((k) => !process.env[k]);
if (missing.length) {
  console.error(`❌ Thiếu biến môi trường cơ sở dữ liệu: ${missing.join(', ')}. Xem .env.example.`);
  process.exit(1);
}

const pool = mysql.createPool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT ? Number(process.env.DB_PORT) : 3306,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
  dateStrings: true // đọc cột DATETIME ra dạng chuỗi 'YYYY-MM-DD HH:MM:SS' (giống cách SQLite trả về trước đây),
                     // để không phải sửa lại lib/schema.js và lib/ssr.js vốn đang xử lý ngày giờ theo dạng chuỗi này.
});

// Luôn tính giờ theo UTC cho mọi kết nối trong pool — không phụ thuộc múi giờ mặc định của máy chủ MySQL
// (nơi đặt hosting có thể để múi giờ khác nhau). Toàn bộ code đọc created_at đều giả định đây là giờ UTC,
// giống hệt cách SQLite datetime('now') vẫn luôn làm trước đây.
// Nếu sau này thấy ngày giờ hiển thị bị lệch một số giờ cố định, đây là chỗ đầu tiên cần kiểm tra.
pool.on('connection', (conn) => { conn.query("SET time_zone = '+00:00'").catch(() => {}); });

// ---- API rút gọn, mô phỏng lại đúng 3 kiểu gọi mà code cũ (better-sqlite3) đã dùng khắp nơi ----
// get: lấy 1 dòng (hoặc null). all: lấy nhiều dòng. run: thêm/sửa/xoá, trả về { lastInsertRowid, changes }.
// Khác biệt duy nhất so với trước: cả 3 hàm này đều là async, mọi chỗ gọi phải thêm "await".
async function all(sql, params = []) {
  const [rows] = await pool.query(sql, params);
  return rows;
}
async function get(sql, params = []) {
  const rows = await all(sql, params);
  return rows[0] || null;
}
async function run(sql, params = []) {
  const [result] = await pool.query(sql, params);
  return { lastInsertRowid: result.insertId, changes: result.affectedRows };
}

async function migrate() {
  // Bảng người dùng
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(150) NOT NULL,
      email VARCHAR(190) UNIQUE NOT NULL,
      phone VARCHAR(30),
      password_hash VARCHAR(255) NOT NULL,
      role VARCHAR(20) NOT NULL DEFAULT 'user',
      token_version INT NOT NULL DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB
  `);
  // Tài khoản cũ nhất được coi là admin nếu chưa có admin nào (giữ đúng hành vi cũ).
  if (!(await get("SELECT 1 FROM users WHERE role = 'admin' LIMIT 1"))) {
    const first = await get('SELECT id FROM users ORDER BY id ASC LIMIT 1');
    if (first) await run("UPDATE users SET role = 'admin' WHERE id = ?", [first.id]);
  }

  // Bảng tin đăng (mua bán/cho thuê)
  // status, media_type ở bảng dưới: giá trị hợp lệ được kiểm tra ở tầng ứng dụng (routes/*.js), không
  // dùng ràng buộc CHECK trong CSDL — để tương thích chắc chắn với mọi phiên bản MySQL/MariaDB.
  await pool.query(`
    CREATE TABLE IF NOT EXISTS listings (
      id INT AUTO_INCREMENT PRIMARY KEY,
      user_id INT NOT NULL,
      listing_type VARCHAR(20) NOT NULL,
      category VARCHAR(100) NOT NULL,
      title VARCHAR(255) NOT NULL,
      description TEXT,
      price DOUBLE NOT NULL,
      price_unit VARCHAR(10) DEFAULT 'ty',
      address VARCHAR(300) NOT NULL,
      bedrooms INT,
      bathrooms INT,
      area DOUBLE,
      image_path VARCHAR(500),
      status VARCHAR(20) DEFAULT 'active',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      province VARCHAR(150),
      ward VARCHAR(150),
      street VARCHAR(200),
      width DOUBLE,
      length DOUBLE,
      has_income TINYINT DEFAULT 0,
      has_furniture TINYINT DEFAULT 0,
      has_elevator TINYINT DEFAULT 0,
      car_alley TINYINT DEFAULT 0,
      is_vip TINYINT DEFAULT 0,
      INDEX idx_listings_type (listing_type),
      INDEX idx_listings_user (user_id),
      INDEX idx_listings_province (province),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    ) ENGINE=InnoDB
  `);

  // Bảng media (nhiều ảnh/video cho mỗi tin đăng)
  await pool.query(`
    CREATE TABLE IF NOT EXISTS listing_media (
      id INT AUTO_INCREMENT PRIMARY KEY,
      listing_id INT NOT NULL,
      media_type VARCHAR(10) NOT NULL,
      file_path VARCHAR(500) NOT NULL,
      sort_order INT DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_media_listing (listing_id),
      FOREIGN KEY (listing_id) REFERENCES listings(id) ON DELETE CASCADE
    ) ENGINE=InnoDB
  `);

  // Bảng tin tức bất động sản (dùng chung cho: Tin tức, Tư vấn luật, Thiết kế kiến trúc — phân biệt qua cột category)
  await pool.query(`
    CREATE TABLE IF NOT EXISTS news (
      id INT AUTO_INCREMENT PRIMARY KEY,
      user_id INT NOT NULL,
      title VARCHAR(255) NOT NULL,
      excerpt VARCHAR(1000),
      content MEDIUMTEXT NOT NULL,
      image_path VARCHAR(500),
      category VARCHAR(50) NOT NULL DEFAULT 'tin-tuc',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_news_created (created_at),
      INDEX idx_news_category (category),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    ) ENGINE=InnoDB
  `);

  // Bảng dự án bất động sản
  await pool.query(`
    CREATE TABLE IF NOT EXISTS projects (
      id INT AUTO_INCREMENT PRIMARY KEY,
      user_id INT NOT NULL,
      name VARCHAR(255) NOT NULL,
      location VARCHAR(300),
      description TEXT,
      image_path VARCHAR(500),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_projects_created (created_at),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    ) ENGINE=InnoDB
  `);

  // Bảng tin sang nhượng (cửa hàng, khách sạn, quán cafe, mặt bằng kinh doanh)
  await pool.query(`
    CREATE TABLE IF NOT EXISTS transfers (
      id INT AUTO_INCREMENT PRIMARY KEY,
      user_id INT NOT NULL,
      category VARCHAR(100) NOT NULL,
      title VARCHAR(255) NOT NULL,
      description TEXT,
      price DOUBLE,
      price_unit VARCHAR(10) DEFAULT 'trieu',
      address VARCHAR(300) NOT NULL,
      area DOUBLE,
      image_path VARCHAR(500),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_transfers_category (category),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    ) ENGINE=InnoDB
  `);
}

// Chạy di trú NGAY khi module này được require lần đầu; mọi nơi dùng db phải đợi việc này xong
// trước khi truy vấn — server.js gọi await db.ready() trước khi app.listen().
const ready = migrate().catch((err) => {
  console.error('❌ Không kết nối được hoặc không dựng được bảng trong MySQL:', err.message);
  process.exit(1);
});

module.exports = { pool, get, all, run, ready: () => ready };
