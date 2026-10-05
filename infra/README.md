# Local infrastructure

Stage 1 chạy ba dependency local bằng Docker Compose:

- MongoDB replica set tại `localhost:27017`.
- Redis tại `localhost:6379`.
- MinIO S3 API tại `localhost:9000`, console tại `localhost:9001`.

## Lệnh vận hành

```powershell
pnpm infra:up
pnpm infra:logs
pnpm infra:down
```

`pnpm infra:reset` xóa đúng ba named volume `dike-mongo`, `dike-redis` và
`dike-minio`. Lệnh này làm mất toàn bộ dữ liệu local và không được gọi tự động từ
`dev` hoặc CI.

Compose tự khởi tạo replica set `rs0` và hai bucket `dike-public`, `dike-private`.
Credential trong Compose chỉ dành cho local development và không được tái sử dụng
ở staging/production.

MinIO dùng image Bitnami legacy đã pin vì registry community MinIO hiện không cho
Docker Desktop pull anonymous ổn định. Image này chỉ phục vụ local/test; production
theo ADR 0007 vẫn dùng Cloudflare R2 và phải qua security review riêng.

## Port override

Baseline giữ port cố định để Mongo replica set quảng bá địa chỉ có thể truy cập từ
backend chạy trên host. Nếu port `27017` đang bị chiếm, hãy dừng process xung đột
thay vì đổi riêng port mapping làm sai replica-set member address. Redis và MinIO
có thể được override trong Compose override file local không commit.
