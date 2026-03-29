FROM golang:1.22-alpine AS builder
WORKDIR /app
COPY apps/payment-svc/go.mod apps/payment-svc/go.sum* ./
RUN go mod download
COPY apps/payment-svc/ .
RUN CGO_ENABLED=0 GOOS=linux go build -o /payment-svc ./cmd/server

FROM alpine:3.19
RUN apk --no-cache add ca-certificates
WORKDIR /app
COPY --from=builder /payment-svc .
EXPOSE 3002 50051
CMD ["./payment-svc"]
