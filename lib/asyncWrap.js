// Express 4 KHÔNG tự bắt lỗi trong hàm async: nếu 1 câu truy vấn MySQL thất bại (mất kết nối, timeout...)
// mà hàm xử lý không có try/catch, lỗi biến thành "promise bị từ chối không ai xử lý" và trên Node đời mới
// sẽ làm SẬP CẢ SERVER. Bọc từng hàm xử lý ở đây để mọi lỗi (đồng bộ lẫn bất đồng bộ) được chuyển vào
// next(err) → bộ xử lý lỗi chung ở cuối server.js trả về lỗi 500 gọn gàng, server vẫn chạy tiếp.

function wrapHandler(fn) {
  if (Array.isArray(fn)) return fn.map(wrapHandler);          // ví dụ [multer, guard] từ middleware/upload.js
  if (typeof fn !== 'function') return fn;
  if (fn.length === 4) return fn;                              // middleware xử lý lỗi (err, req, res, next): giữ nguyên
  return function wrapped(req, res, next) {
    try {
      const result = fn(req, res, next);
      if (result && typeof result.catch === 'function') result.catch(next);
    } catch (err) {
      next(err);
    }
  };
}

// Bọc các hàm khai báo đường dẫn của 1 router: router.get/post/put/delete/patch/use
function wrapRouter(router) {
  for (const method of ['get', 'post', 'put', 'patch', 'delete', 'all']) {
    const original = router[method].bind(router);
    router[method] = (path, ...handlers) => original(path, ...handlers.map(wrapHandler));
  }
  return router;
}

module.exports = { wrapRouter, wrapHandler };
