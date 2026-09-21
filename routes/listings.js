const express = require('express');
const path = require('path');
const fs = require('fs');
const db = require('../db');
const { requireAdmin, optionalAuth } = require('../middleware/auth');
const { create: createUpload } = require('../middleware/upload');
const { checkFields, checkNumbers, idParam } = require('../lib/validate');

const router = express.Router();

// ---- Cấu hình tải ảnh/video lên (kiểm tra nội dung thật của file, xem middleware/upload.js) ----
const upload = createUpload({ prefix: 'listing', allowVideo: true, maxFileSize: 50 * 1024 * 1024 });

router.param('id', idParam);
router.param('mediaId', idParam);

function toBool(v) { return v ? 1 : 0; }

function toPublicListing(row) {
  return {
    id: row.id,
    userId: row.user_id,
    ownerName: row.owner_name,
    listingType: row.listing_type,
    category: row.category,
    title: row.title,
    description: row.description,
    price: row.price,
    priceUnit: row.price_unit,
    address: row.address,
    province: row.province,
    ward: row.ward,
    street: row.street,
    width: row.width,
    length: row.length,
    hasIncome: !!row.has_income,
    hasFurniture: !!row.has_furniture,
    hasElevator: !!row.has_elevator,
    carAlley: !!row.car_alley,
    isVip: !!row.is_vip,
    bedrooms: row.bedrooms,
    bathrooms: row.bathrooms,
    area: row.area,
    imagePath: row.image_path,
    createdAt: row.created_at
  };
}

function getMediaFor(listingId) {
  return db.prepare(`
    SELECT id, media_type, file_path, sort_order FROM listing_media
    WHERE listing_id = ? ORDER BY sort_order ASC, id ASC
  `).all(listingId).map(m => ({ id: m.id, type: m.media_type, path: m.file_path }));
}

function deleteMediaFile(filePath) {
  if (!filePath) return;
  const full = path.join(__dirname, '..', 'public', filePath);
  fs.unlink(full, () => {});
}

// ---- Danh sách tin (có lọc + phân trang) ----
// GET /api/listings?type=&category=&minPrice=&maxPrice=&q=&location=&ward=&street=
//                    &minArea=&maxArea=&minWidth=&minLength=
//                    &hasIncome=1&hasFurniture=1&hasElevator=1&carAlley=1&mine=1&limit=&offset=
router.get('/', optionalAuth, (req, res) => {
  const {
    type, category, minPrice, maxPrice, q, location, ward, street,
    minArea, maxArea, minWidth, minLength,
    hasIncome, hasFurniture, hasElevator, carAlley, vip,
    mine, limit, offset
  } = req.query;

  const params = [];
  let whereClause;

  if (mine === '1') {
    if (!req.user) return res.status(401).json({ error: 'Bạn cần đăng nhập để xem tin của mình.' });
    whereClause = 'listings.user_id = ?';
    params.push(req.user.id);
  } else {
    whereClause = "listings.status = 'active'";
  }

  let sql = `
    SELECT listings.*, users.name AS owner_name
    FROM listings
    JOIN users ON users.id = listings.user_id
    WHERE ${whereClause}
  `;
  let countSql = `SELECT COUNT(*) AS total FROM listings WHERE ${whereClause}`;

  const addCond = (cond, value) => {
    sql += ` AND ${cond}`;
    countSql += ` AND ${cond}`;
    params.push(value);
  };
  // Điều kiện boolean không cần tham số ? (giá trị đã cố định ngay trong câu SQL)
  const addBoolCond = (cond) => {
    sql += ` AND ${cond}`;
    countSql += ` AND ${cond}`;
  };

  if (type === 'sale' || type === 'rent') addCond('listings.listing_type = ?', type);
  if (category) addCond('listings.category = ?', category);
  if (minPrice) addCond('listings.price >= ?', Number(minPrice));
  if (maxPrice) addCond('listings.price <= ?', Number(maxPrice));
  if (minArea) addCond('listings.area >= ?', Number(minArea));
  if (maxArea) addCond('listings.area <= ?', Number(maxArea));
  if (minWidth) addCond('listings.width >= ?', Number(minWidth));
  if (minLength) addCond('listings.length >= ?', Number(minLength));
  if (hasIncome === '1') addBoolCond('listings.has_income = 1');
  if (hasFurniture === '1') addBoolCond('listings.has_furniture = 1');
  if (hasElevator === '1') addBoolCond('listings.has_elevator = 1');
  if (carAlley === '1') addBoolCond('listings.car_alley = 1');
  if (vip === '1') addBoolCond('listings.is_vip = 1');

  // Tỉnh/Thành phố: ưu tiên khớp đúng cột province (nếu tin có nhập), phòng khi tin cũ
  // chưa có cột này thì fallback so khớp trong địa chỉ để không bỏ sót tin cũ.
  if (location) {
    sql += ' AND (listings.province = ? OR listings.address LIKE ?)';
    countSql += ' AND (listings.province = ? OR listings.address LIKE ?)';
    params.push(location, `%${location}%`);
  }
  if (ward) {
    sql += ' AND (listings.ward LIKE ? OR listings.address LIKE ?)';
    countSql += ' AND (listings.ward LIKE ? OR listings.address LIKE ?)';
    params.push(`%${ward}%`, `%${ward}%`);
  }
  if (street) {
    sql += ' AND (listings.street LIKE ? OR listings.address LIKE ?)';
    countSql += ' AND (listings.street LIKE ? OR listings.address LIKE ?)';
    params.push(`%${street}%`, `%${street}%`);
  }
  if (q) {
    sql += ' AND (listings.title LIKE ? OR listings.address LIKE ?)';
    countSql += ' AND (listings.title LIKE ? OR listings.address LIKE ?)';
    params.push(`%${q}%`, `%${q}%`);
  }

  const countParams = params.slice(); // bản sao trước khi thêm limit/offset
  sql += ' ORDER BY listings.created_at DESC';

  const lim = Math.min(Number(limit) || 20, 100);
  const off = Number(offset) || 0;
  sql += ' LIMIT ? OFFSET ?';
  params.push(lim, off);

  const rows = db.prepare(sql).all(...params);
  const total = db.prepare(countSql).get(...countParams).total;

  res.json({ listings: rows.map(toPublicListing), total, limit: lim, offset: off });
});

// ---- Chi tiết 1 tin (kèm toàn bộ ảnh/video) ----
router.get('/:id', optionalAuth, (req, res) => {
  const row = db.prepare(`
    SELECT listings.*, users.name AS owner_name, users.phone AS owner_phone
    FROM listings JOIN users ON users.id = listings.user_id
    WHERE listings.id = ? AND (listings.status = 'active' OR listings.user_id = ?)
  `).get(req.params.id, req.user ? req.user.id : -1);

  if (!row) return res.status(404).json({ error: 'Không tìm thấy tin đăng.' });
  res.json({
    listing: {
      ...toPublicListing(row),
      ownerPhone: row.owner_phone,
      media: getMediaFor(row.id)
    }
  });
});

// ---- Đăng tin mới (cần đăng nhập, có thể kèm nhiều ảnh/video) ----
router.post('/', requireAdmin, upload.array('media', 10), (req, res) => {
  const {
    listingType, category, title, description,
    price, priceUnit, address, bedrooms, bathrooms, area,
    province, ward, street, width, length,
    hasIncome, hasFurniture, hasElevator, carAlley, isVip
  } = req.body;

  const bad = checkFields(req.body, {
    listingType: [10, 'Loại tin'], category: [100, 'Danh mục'], title: [200, 'Tiêu đề'], description: [20000, 'Mô tả'],
    priceUnit: [10, 'Đơn vị giá'], address: [300, 'Địa chỉ'], province: [100, 'Tỉnh/Thành phố'], ward: [100, 'Phường/Xã'], street: [150, 'Đường/Phố']
  }) || checkNumbers(req.body, {
    price: [0, 1e12, 'Giá'], area: [0, 1e7, 'Diện tích'], bedrooms: [0, 100, 'Số phòng ngủ'], bathrooms: [0, 100, 'Số phòng tắm'],
    width: [0, 10000, 'Chiều ngang'], length: [0, 10000, 'Chiều dài']
  });
  if (bad) return res.status(400).json({ error: bad });
  if (priceUnit && !['ty', 'trieu'].includes(priceUnit)) return res.status(400).json({ error: 'Đơn vị giá không hợp lệ.' });

  if (!listingType || !category || !title || !price || !address) {
    return res.status(400).json({ error: 'Vui lòng nhập đầy đủ loại tin, danh mục, tiêu đề, giá và địa chỉ.' });
  }
  if (!['sale', 'rent'].includes(listingType)) {
    return res.status(400).json({ error: 'Loại tin không hợp lệ.' });
  }

  const files = req.files || [];
  const firstImage = files.find(f => f.mimetype.startsWith('image/'));
  const imagePath = firstImage ? `/uploads/${firstImage.filename}` : null;

  const info = db.prepare(`
    INSERT INTO listings
      (user_id, listing_type, category, title, description, price, price_unit, address,
       bedrooms, bathrooms, area, image_path,
       province, ward, street, width, length, has_income, has_furniture, has_elevator, car_alley, is_vip)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    req.user.id, listingType, category, title.trim(), description || null,
    Number(price), priceUnit || 'ty', address.trim(),
    bedrooms ? Number(bedrooms) : null,
    bathrooms ? Number(bathrooms) : null,
    area ? Number(area) : null,
    imagePath,
    province || null,
    ward || null,
    street || null,
    width ? Number(width) : null,
    length ? Number(length) : null,
    toBool(hasIncome === '1' || hasIncome === 'on' || hasIncome === true),
    toBool(hasFurniture === '1' || hasFurniture === 'on' || hasFurniture === true),
    toBool(hasElevator === '1' || hasElevator === 'on' || hasElevator === true),
    toBool(carAlley === '1' || carAlley === 'on' || carAlley === true),
    toBool(isVip === '1' || isVip === 'on' || isVip === true)
  );

  const listingId = info.lastInsertRowid;
  const insertMedia = db.prepare(`
    INSERT INTO listing_media (listing_id, media_type, file_path, sort_order) VALUES (?, ?, ?, ?)
  `);
  files.forEach((f, i) => {
    const mediaType = f.mimetype.startsWith('video/') ? 'video' : 'image';
    insertMedia.run(listingId, mediaType, `/uploads/${f.filename}`, i);
  });

  const row = db.prepare(`
    SELECT listings.*, users.name AS owner_name FROM listings
    JOIN users ON users.id = listings.user_id WHERE listings.id = ?
  `).get(listingId);

  res.status(201).json({ listing: { ...toPublicListing(row), media: getMediaFor(listingId) } });
});

// ---- Sửa tin (chỉ chủ tin) — ảnh/video mới gửi lên sẽ được THÊM VÀO, không xoá cái cũ ----
router.put('/:id', requireAdmin, upload.array('media', 10), (req, res) => {
  const existing = db.prepare('SELECT * FROM listings WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Không tìm thấy tin đăng.' });
  if (existing.user_id !== req.user.id) {
    return res.status(403).json({ error: 'Bạn không có quyền sửa tin này.' });
  }

  const {
    listingType, category, title, description,
    price, priceUnit, address, bedrooms, bathrooms, area,
    province, ward, street, width, length,
    hasIncome, hasFurniture, hasElevator, carAlley, isVip
  } = req.body;

  const bad = checkFields(req.body, {
    listingType: [10, 'Loại tin'], category: [100, 'Danh mục'], title: [200, 'Tiêu đề'], description: [20000, 'Mô tả'],
    priceUnit: [10, 'Đơn vị giá'], address: [300, 'Địa chỉ'], province: [100, 'Tỉnh/Thành phố'], ward: [100, 'Phường/Xã'], street: [150, 'Đường/Phố']
  }) || checkNumbers(req.body, {
    price: [0, 1e12, 'Giá'], area: [0, 1e7, 'Diện tích'], bedrooms: [0, 100, 'Số phòng ngủ'], bathrooms: [0, 100, 'Số phòng tắm'],
    width: [0, 10000, 'Chiều ngang'], length: [0, 10000, 'Chiều dài']
  });
  if (bad) return res.status(400).json({ error: bad });
  if (priceUnit && !['ty', 'trieu'].includes(priceUnit)) return res.status(400).json({ error: 'Đơn vị giá không hợp lệ.' });

  const files = req.files || [];

  // Thêm media mới vào bảng listing_media (nối tiếp sau media hiện có)
  let imagePath = existing.image_path;
  if (files.length) {
    const maxOrderRow = db.prepare('SELECT MAX(sort_order) AS m FROM listing_media WHERE listing_id = ?').get(req.params.id);
    let nextOrder = (maxOrderRow.m ?? -1) + 1;

    const insertMedia = db.prepare(`
      INSERT INTO listing_media (listing_id, media_type, file_path, sort_order) VALUES (?, ?, ?, ?)
    `);
    files.forEach((f) => {
      const mediaType = f.mimetype.startsWith('video/') ? 'video' : 'image';
      insertMedia.run(req.params.id, mediaType, `/uploads/${f.filename}`, nextOrder++);
    });

    // Nếu tin chưa có ảnh đại diện, lấy ảnh đầu tiên vừa thêm làm đại diện
    if (!imagePath) {
      const firstNewImage = files.find(f => f.mimetype.startsWith('image/'));
      if (firstNewImage) imagePath = `/uploads/${firstNewImage.filename}`;
    }
  }

  db.prepare(`
    UPDATE listings SET
      listing_type = ?, category = ?, title = ?, description = ?,
      price = ?, price_unit = ?, address = ?, bedrooms = ?, bathrooms = ?, area = ?, image_path = ?,
      province = ?, ward = ?, street = ?, width = ?, length = ?,
      has_income = ?, has_furniture = ?, has_elevator = ?, car_alley = ?, is_vip = ?
    WHERE id = ?
  `).run(
    listingType || existing.listing_type,
    category || existing.category,
    title ? title.trim() : existing.title,
    description !== undefined ? description : existing.description,
    price ? Number(price) : existing.price,
    priceUnit || existing.price_unit,
    address ? address.trim() : existing.address,
    bedrooms ? Number(bedrooms) : existing.bedrooms,
    bathrooms ? Number(bathrooms) : existing.bathrooms,
    area ? Number(area) : existing.area,
    imagePath,
    province !== undefined ? (province || null) : existing.province,
    ward !== undefined ? (ward || null) : existing.ward,
    street !== undefined ? (street || null) : existing.street,
    width ? Number(width) : existing.width,
    length ? Number(length) : existing.length,
    hasIncome !== undefined ? toBool(hasIncome === '1' || hasIncome === 'on' || hasIncome === true) : existing.has_income,
    hasFurniture !== undefined ? toBool(hasFurniture === '1' || hasFurniture === 'on' || hasFurniture === true) : existing.has_furniture,
    hasElevator !== undefined ? toBool(hasElevator === '1' || hasElevator === 'on' || hasElevator === true) : existing.has_elevator,
    carAlley !== undefined ? toBool(carAlley === '1' || carAlley === 'on' || carAlley === true) : existing.car_alley,
    isVip !== undefined ? toBool(isVip === '1' || isVip === 'on' || isVip === true) : existing.is_vip,
    req.params.id
  );

  const row = db.prepare(`
    SELECT listings.*, users.name AS owner_name FROM listings
    JOIN users ON users.id = listings.user_id WHERE listings.id = ?
  `).get(req.params.id);

  res.json({ listing: { ...toPublicListing(row), media: getMediaFor(req.params.id) } });
});

// ---- Xoá 1 ảnh/video cụ thể khỏi tin (chỉ chủ tin) ----
router.delete('/:id/media/:mediaId', requireAdmin, (req, res) => {
  const listing = db.prepare('SELECT * FROM listings WHERE id = ?').get(req.params.id);
  if (!listing) return res.status(404).json({ error: 'Không tìm thấy tin đăng.' });
  if (listing.user_id !== req.user.id) {
    return res.status(403).json({ error: 'Bạn không có quyền sửa tin này.' });
  }

  const media = db.prepare('SELECT * FROM listing_media WHERE id = ? AND listing_id = ?').get(req.params.mediaId, req.params.id);
  if (!media) return res.status(404).json({ error: 'Không tìm thấy ảnh/video này.' });

  db.prepare('DELETE FROM listing_media WHERE id = ?').run(media.id);
  deleteMediaFile(media.file_path);

  // Nếu ảnh vừa xoá đang là ảnh đại diện, tự động chuyển sang ảnh còn lại kế tiếp (nếu có)
  if (listing.image_path === media.file_path) {
    const nextImage = db.prepare(`
      SELECT file_path FROM listing_media
      WHERE listing_id = ? AND media_type = 'image'
      ORDER BY sort_order ASC LIMIT 1
    `).get(req.params.id);
    db.prepare('UPDATE listings SET image_path = ? WHERE id = ?').run(nextImage ? nextImage.file_path : null, req.params.id);
  }

  res.json({ ok: true, media: getMediaFor(req.params.id) });
});

// ---- Xoá tin (chỉ chủ tin) ----
router.delete('/:id', requireAdmin, (req, res) => {
  const existing = db.prepare('SELECT * FROM listings WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Không tìm thấy tin đăng.' });
  if (existing.user_id !== req.user.id) {
    return res.status(403).json({ error: 'Bạn không có quyền xoá tin này.' });
  }

  const mediaFiles = db.prepare('SELECT file_path FROM listing_media WHERE listing_id = ?').all(req.params.id);

  db.prepare('DELETE FROM listings WHERE id = ?').run(req.params.id); // listing_media tự xoá theo (ON DELETE CASCADE)

  mediaFiles.forEach(m => deleteMediaFile(m.file_path));
  if (existing.image_path) deleteMediaFile(existing.image_path);

  res.json({ ok: true });
});

module.exports = router;
