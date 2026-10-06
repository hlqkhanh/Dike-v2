package com.dike.identity.api;

import com.dike.identity.application.DikePrincipal;
import com.dike.identity.application.FileAssetService;
import com.dike.identity.application.ProfileRateLimiter;
import com.dike.shared.api.ApiException;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import java.time.Duration;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/files")
@SecurityRequirement(name = "sessionCookie")
public class FileController {
  private final FileAssetService files;
  private final ProfileRateLimiter rateLimiter;

  public FileController(FileAssetService files, ProfileRateLimiter rateLimiter) {
    this.files = files;
    this.rateLimiter = rateLimiter;
  }

  @PostMapping("/uploads")
  ResponseEntity<FileAssetService.UploadIntent> upload(
      @AuthenticationPrincipal DikePrincipal principal,
      @Valid @RequestBody FileRequests.CreateUpload body,
      HttpServletRequest request) {
    requireRate(
        "upload-bytes",
        principal,
        request,
        body.sizeBytes(),
        50L * 1024 * 1024,
        Duration.ofDays(1));
    requireRate("upload-intent", principal, request, 1, 20, Duration.ofMinutes(10));
    try {
      return ResponseEntity.status(HttpStatus.CREATED)
          .body(
              files.createUpload(
                  principal.userId(),
                  body.purpose(),
                  body.contentType(),
                  body.sizeBytes(),
                  body.checksumSha256()));
    } catch (FileAssetService.TypeNotAllowedException exception) {
      throw new ApiException(
          HttpStatus.UNSUPPORTED_MEDIA_TYPE,
          "FILE_TYPE_NOT_ALLOWED",
          "Loại file không được hỗ trợ");
    } catch (FileAssetService.FileTooLargeException exception) {
      throw new ApiException(
          HttpStatus.PAYLOAD_TOO_LARGE, "FILE_TOO_LARGE", "File vượt quá dung lượng cho phép");
    }
  }

  @PostMapping("/{fileId}/complete")
  ResponseEntity<FileAssetService.FileView> complete(
      @AuthenticationPrincipal DikePrincipal principal,
      @PathVariable String fileId,
      @RequestHeader("Idempotency-Key") String idempotencyKey,
      HttpServletRequest request) {
    requireRate("upload-complete", principal, request, 1, 40, Duration.ofMinutes(10));
    try {
      return ResponseEntity.accepted()
          .body(files.complete(principal.userId(), fileId, idempotencyKey));
    } catch (FileAssetService.FileNotFoundException exception) {
      throw notFound();
    } catch (FileAssetService.FileConflictException exception) {
      throw new ApiException(HttpStatus.CONFLICT, exception.code(), "File chưa sẵn sàng để xử lý");
    } catch (FileAssetService.InvalidIdempotencyKeyException exception) {
      throw new ApiException(
          HttpStatus.BAD_REQUEST, "INVALID_IDEMPOTENCY_KEY", "Idempotency key không hợp lệ");
    }
  }

  @GetMapping("/{fileId}")
  FileAssetService.FileView metadata(
      @AuthenticationPrincipal DikePrincipal principal, @PathVariable String fileId) {
    try {
      return files.metadata(principal.userId(), fileId);
    } catch (FileAssetService.FileNotFoundException exception) {
      throw notFound();
    }
  }

  @PostMapping("/{fileId}/download-url")
  FileAssetService.DownloadGrant download(
      @AuthenticationPrincipal DikePrincipal principal,
      @PathVariable String fileId,
      HttpServletRequest request) {
    requireRate("download", principal, request, 1, 30, Duration.ofMinutes(1));
    try {
      return files.download(principal.userId(), fileId);
    } catch (FileAssetService.FileNotFoundException exception) {
      throw notFound();
    } catch (FileAssetService.FileConflictException exception) {
      throw new ApiException(HttpStatus.CONFLICT, exception.code(), "File chưa sẵn sàng");
    }
  }

  @DeleteMapping("/{fileId}")
  ResponseEntity<Void> delete(
      @AuthenticationPrincipal DikePrincipal principal,
      @PathVariable String fileId,
      @RequestHeader("Idempotency-Key") String idempotencyKey) {
    try {
      files.delete(principal.userId(), fileId, idempotencyKey);
      return ResponseEntity.noContent().build();
    } catch (FileAssetService.FileNotFoundException exception) {
      throw notFound();
    } catch (FileAssetService.InvalidIdempotencyKeyException exception) {
      throw new ApiException(
          HttpStatus.BAD_REQUEST, "INVALID_IDEMPOTENCY_KEY", "Idempotency key không hợp lệ");
    }
  }

  private ApiException notFound() {
    return new ApiException(HttpStatus.NOT_FOUND, "FILE_NOT_FOUND", "Không tìm thấy file");
  }

  private void requireRate(
      String action,
      DikePrincipal principal,
      HttpServletRequest request,
      long cost,
      long limit,
      Duration window) {
    if (!rateLimiter.tryAcquire(
        action, principal.userId(), request.getRemoteAddr(), cost, limit, window)) {
      throw new ApiException(
          HttpStatus.TOO_MANY_REQUESTS,
          "FILE_RATE_LIMITED",
          "Đã vượt quá giới hạn thao tác file",
          window);
    }
  }
}
