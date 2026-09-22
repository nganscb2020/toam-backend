// Dữ liệu có cấu trúc (schema.org, định dạng JSON-LD) cho trang chi tiết.
// Đây là đoạn mã ẩn (không hiện trên trang) giúp Google hiểu "đây là một tin bất động sản,
// giá bao nhiêu, ở đâu" — là điều kiện để tin có thể hiện giá/ảnh ngay trên trang kết quả tìm kiếm.

// sqlite lưu 'YYYY-MM-DD HH:MM:SS' (giờ UTC, do datetime('now')) → chuyển sang ISO 8601 chuẩn.
function toIsoDate(sqliteDt) {
  if (!sqliteDt) return undefined;
  const iso = sqliteDt.includes('T') ? sqliteDt : sqliteDt.replace(' ', 'T') + 'Z';
  return isNaN(Date.parse(iso)) ? undefined : iso;
}

// Bỏ mọi field có giá trị undefined/null/'' — JSON-LD không nên có field rỗng.
function clean(obj) {
  const out = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v === undefined || v === null || v === '') continue;
    out[k] = v;
  }
  return out;
}

function toVnd(price, priceUnit) {
  if (!price) return undefined;
  const mul = priceUnit === 'ty' ? 1e9 : 1e6;
  return Math.round(Number(price) * mul);
}

// row: bản ghi từ bảng listings hoặc transfers (đủ field chung: title, description, price, price_unit,
// address, area, image_path, created_at; listings có thêm bedrooms/bathrooms/province/ward, listing_type).
function realEstateListingSchema(row, { url, image, isRent }) {
  // Chỉ thêm "addressCountry" khi có ít nhất 1 phần địa chỉ thật — nếu không, address chỉ còn mỗi "VN" thì vô nghĩa.
  const hasRealAddress = row.street || row.address || row.ward || row.province;
  const address = hasRealAddress ? clean({
    '@type': 'PostalAddress',
    streetAddress: row.street || row.address,
    addressLocality: row.ward,
    addressRegion: row.province,
    addressCountry: 'VN'
  }) : null;

  // Chỉ tạo "offers" khi thật sự có giá — nếu không, mọi field khác (tiền tệ, trạng thái...) đều vô nghĩa.
  const priceVnd = toVnd(row.price, row.price_unit);
  const offers = priceVnd ? {
    '@type': 'Offer',
    price: priceVnd,
    priceCurrency: 'VND',
    availability: 'https://schema.org/InStock',
    businessFunction: isRent ? 'https://schema.org/LeaseOut' : 'https://schema.org/Sell',
    url
  } : null;

  return clean({
    '@context': 'https://schema.org',
    '@type': 'RealEstateListing',
    name: row.title,
    description: row.description,
    url,
    image: image ? [image] : undefined,
    datePosted: toIsoDate(row.created_at),
    address: address || undefined,
    offers: offers || undefined,
    floorSize: row.area ? clean({ '@type': 'QuantitativeValue', value: row.area, unitCode: 'MTK' }) : undefined,
    numberOfRooms: row.bedrooms || undefined,
    numberOfBathroomsTotal: row.bathrooms || undefined
  });
}

// row: bản ghi từ bảng projects (name, location, description, image_path)
function apartmentComplexSchema(row, { url, image }) {
  const address = row.location ? { '@type': 'PostalAddress', addressLocality: row.location, addressCountry: 'VN' } : null;
  return clean({
    '@context': 'https://schema.org',
    '@type': 'ApartmentComplex',
    name: row.name,
    description: row.description,
    url,
    image: image ? [image] : undefined,
    address: address || undefined
  });
}

// row: bản ghi từ bảng news (title, excerpt, content, image_path, created_at)
function articleSchema(row, { url, image, siteName }) {
  return clean({
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: (row.title || '').slice(0, 110), // Google khuyến nghị headline không quá 110 ký tự
    description: row.excerpt,
    url,
    image: image ? [image] : undefined,
    datePublished: toIsoDate(row.created_at),
    dateModified: toIsoDate(row.created_at),
    author: { '@type': 'Organization', name: siteName },
    publisher: { '@type': 'Organization', name: siteName },
    mainEntityOfPage: { '@type': 'WebPage', '@id': url }
  });
}

// items: [{ name, url? }] — mục cuối (trang hiện tại) thường không có url
function breadcrumbSchema(items) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, i) => clean({
      '@type': 'ListItem', position: i + 1, name: item.name, item: item.url
    }))
  };
}

module.exports = { realEstateListingSchema, apartmentComplexSchema, articleSchema, breadcrumbSchema, toIsoDate, toVnd };
