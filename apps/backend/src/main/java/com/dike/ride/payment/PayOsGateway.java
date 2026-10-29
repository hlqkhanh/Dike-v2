package com.dike.ride.payment;

import java.time.Instant;
import java.util.List;
import org.springframework.stereotype.Component;
import vn.payos.PayOS;
import vn.payos.model.v1.payouts.batch.PayoutBatchItem;
import vn.payos.model.v1.payouts.batch.PayoutBatchRequest;
import vn.payos.model.v2.paymentRequests.CreatePaymentLinkRequest;

@Component
class PayOsGateway {
  private final PayOS client;
  private final PayOsProperties properties;

  PayOsGateway(PayOS client, PayOsProperties properties) {
    this.client = client;
    this.properties = properties;
  }

  boolean available() {
    return properties.configured();
  }

  CreatedLink create(long orderCode, long amount, String bookingId, Instant expiresAt) {
    requireAvailable();
    String description =
        "DIKE"
            + Long.toString(orderCode).substring(0, Math.min(5, Long.toString(orderCode).length()));
    String encoded = java.net.URLEncoder.encode(bookingId, java.nio.charset.StandardCharsets.UTF_8);
    var response =
        client
            .paymentRequests()
            .create(
                CreatePaymentLinkRequest.builder()
                    .orderCode(orderCode)
                    .amount(amount)
                    .description(description)
                    .returnUrl(
                        properties
                            .publicBaseUrl()
                            .resolve("/bookings/" + encoded + "?payment=success")
                            .toString())
                    .cancelUrl(
                        properties
                            .publicBaseUrl()
                            .resolve("/bookings/" + encoded + "?payment=cancelled")
                            .toString())
                    .expiredAt(expiresAt.getEpochSecond())
                    .build());
    return new CreatedLink(
        response.getPaymentLinkId(), response.getCheckoutUrl(), response.getQrCode());
  }

  VerifiedPayment verify(Object body) {
    requireAvailable();
    var data = client.webhooks().verify(body);
    return new VerifiedPayment(
        data.getOrderCode(),
        data.getAmount(),
        data.getPaymentLinkId(),
        data.getReference(),
        data.getCode());
  }

  CreatedPayout payout(String bookingId, long amount, String bin, String accountNumber) {
    requireAvailable();
    String reference =
        "dike_"
            + bookingId
                .replace("-", "")
                .substring(0, Math.min(20, bookingId.replace("-", "").length()));
    var response =
        client
            .payouts()
            .batch()
            .create(
                PayoutBatchRequest.builder()
                    .referenceId(reference)
                    .validateDestination(true)
                    .category(List.of("transportation"))
                    .payout(
                        PayoutBatchItem.builder()
                            .referenceId(reference + "_1")
                            .amount(amount)
                            .description("Dike ride payout")
                            .toBin(bin)
                            .toAccountNumber(accountNumber)
                            .build())
                    .build(),
                "payout-" + bookingId);
    return new CreatedPayout(
        response.getId(),
        response.getApprovalState() == null ? "PROCESSING" : response.getApprovalState().name());
  }

  String payoutStatus(String payoutId) {
    requireAvailable();
    var response = client.payouts().get(payoutId);
    return response.getApprovalState() == null ? "PROCESSING" : response.getApprovalState().name();
  }

  private void requireAvailable() {
    if (!available()) throw new IllegalStateException("PAYOS_NOT_CONFIGURED");
  }

  record CreatedLink(String paymentLinkId, String checkoutUrl, String qrCode) {}

  record VerifiedPayment(
      long orderCode, long amount, String paymentLinkId, String reference, String code) {}

  record CreatedPayout(String payoutId, String status) {}
}
