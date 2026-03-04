# AGENTS Guidelines for This Repository

This repository contains a cross-platform mobile application built with React Native and Expo, a Node.js backend for real-time WebSocket communication, and services for text classification. Khi làm việc với dự án này thông qua các AI agent (như Cursor, GitHub Copilot, Cline, v.v.), vui lòng tuân thủ các nguyên tắc dưới đây để đảm bảo quy trình phát triển và tính năng Hot Module Replacement (HMR) / Fast Refresh hoạt động trơn tru.

## 1. Sử dụng Development Server, **không** chạy Production Build

* **Frontend (React Native/Expo):** Luôn sử dụng `npx expo start` (hoặc `npm run start`) khi phát triển giao diện. Lệnh này khởi chạy Metro bundler với tính năng Fast Refresh.
* **Backend (Node.js/Socket.io):** Luôn sử dụng `npm run dev` (thường tích hợp `nodemon` hoặc `tsx watch`) để server tự động khởi động lại mỗi khi có thay đổi logic xử lý.
* **Phân hệ NLP (nếu có):** Khi cập nhật các mô hình xử lý ngôn ngữ tự nhiên (ví dụ: kiểm duyệt tin nhắn), nếu chạy trên service Python riêng biệt, hãy sử dụng chế độ `--reload` (ví dụ: `uvicorn main:app --reload`).
* **Không chạy build production trong phiên làm việc của agent.** Việc chạy các lệnh như `eas build` hoặc build backend ra môi trường production sẽ chuyển đổi các asset và làm gián đoạn luồng làm việc tương tác. Nếu cần test production, hãy thực hiện bên ngoài quy trình của agent.

## 2. Đồng bộ Dependencies

Nếu bạn thêm hoặc cập nhật thư viện cho frontend hoặc backend:
1. Cập nhật đúng lockfile tương ứng (`package-lock.json`, `yarn.lock` hoặc `pnpm-lock.yaml`).
2. Với các package của Expo ở frontend, ưu tiên dùng `npx expo install <tên-package>` thay vì `npm install` thuần túy để đảm bảo sự tương thích phiên bản nội bộ.
3. Khởi động lại Metro bundler hoặc Node server để hệ thống nhận diện chính xác cấu trúc code mới.

## 3. Quy ước Lập trình (Coding Conventions)

* **Ưu tiên TypeScript:** Sử dụng `.tsx` / `.ts` cho các component React Native mới, logic ghép đôi (matching queue) ở backend, và định nghĩa các payload tin nhắn.
* **Đồng bộ Type:** Lưu trữ các interface dùng chung cho sự kiện WebSocket (ví dụ: `join_queue`, `match_success`, `receive_message`) trong một thư mục `shared` hoặc `types` để cả frontend và backend đều được strongly-typed.
* **Xử lý Real-time:** Đảm bảo dọn dẹp (cleanup) tất cả các listener của WebSocket bên trong hàm `return` của `useEffect` ở frontend. Điều này ngăn chặn triệt để tình trạng rò rỉ bộ nhớ (memory leak) và lặp sự kiện khi Fast Refresh kích hoạt.
* **Tối ưu Component Style:** Đặt các object `StyleSheet` của React Native ở cuối file component tương ứng.

## 4. Tổng hợp các Lệnh hữu ích

| Lệnh | Môi trường | Mục đích |
| ------------------------- | --------- | -------------------------------------------------- |
| `npx expo start`          | Frontend  | Khởi chạy Expo Metro bundler với Fast Refresh. |
| `npx expo start -c`       | Frontend  | Xóa cache và khởi chạy lại Metro (dùng khi HMR bị lỗi). |
| `npm run dev`             | Backend   | Chạy Node.js WebSocket server với chế độ auto-reload.|
| `npm run lint`            | Cả hai    | Chạy kiểm tra ESLint để rà soát lỗi cú pháp. |

---

Việc tuân thủ các quy tắc này giúp luồng làm việc giữa lập trình viên và AI agent luôn nhanh chóng và đáng tin cậy. Khi có nghi ngờ về việc code không nhận đồng bộ, hãy xóa cache của Metro và khởi động lại các dev server thay vì cố gắng build ra production.