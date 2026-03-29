package main

import (
	"context"
	"log"
	"net"
	"os"
	"os/signal"
	"syscall"

	"github.com/gofiber/fiber/v2"
	"github.com/gofiber/fiber/v2/middleware/cors"
	"github.com/gofiber/fiber/v2/middleware/logger"
	"github.com/gofiber/fiber/v2/middleware/recover"
	"google.golang.org/grpc"

	"guildpay/payment-svc/internal/grpc/server"
	"guildpay/payment-svc/internal/ledger"
	"guildpay/payment-svc/internal/router"
	pb "guildpay/payment-svc/proto"
)

func main() {
	log.Println("🚀 GuildPay Payment Service starting...")

	// Initialize core services
	ledgerSvc := ledger.NewService()
	routerSvc := router.NewSmartRouter()

	// ─── gRPC Server (for API gateway communication) ───
	grpcPort := getEnv("GRPC_PORT", "50051")
	lis, err := net.Listen("tcp", ":"+grpcPort)
	if err != nil {
		log.Fatalf("Failed to listen on gRPC port: %v", err)
	}

	grpcServer := grpc.NewServer()
	paymentServer := server.NewPaymentServer(ledgerSvc, routerSvc)
	pb.RegisterPaymentServiceServer(grpcServer, paymentServer)

	go func() {
		log.Printf("📡 gRPC server listening on :%s", grpcPort)
		if err := grpcServer.Serve(lis); err != nil {
			log.Fatalf("gRPC server error: %v", err)
		}
	}()

	// ─── HTTP Server (for webhooks + health) ───
	app := fiber.New(fiber.Config{
		AppName:      "GuildPay Payment Service",
		ErrorHandler: customErrorHandler,
	})

	app.Use(recover.New())
	app.Use(logger.New())
	app.Use(cors.New())

	// Health check
	app.Get("/health", func(c *fiber.Ctx) error {
		return c.JSON(fiber.Map{
			"status":  "ok",
			"service": "payment-svc",
			"version": "0.1.0",
		})
	})

	// Webhook endpoints (called by payment providers)
	webhooks := app.Group("/webhooks")
	webhooks.Post("/flutterwave", handleFlutterwaveWebhook(ledgerSvc))
	webhooks.Post("/paystack", handlePaystackWebhook(ledgerSvc))

	// Internal API (called by API gateway over private network)
	internal := app.Group("/internal")
	internal.Post("/transfer", handleTransfer(ledgerSvc, routerSvc))
	internal.Post("/topup/complete", handleTopupComplete(ledgerSvc))
	internal.Post("/withdraw", handleWithdraw(ledgerSvc, routerSvc))
	internal.Get("/rates", handleGetRates())

	httpPort := getEnv("HTTP_PORT", "3002")
	go func() {
		log.Printf("🌐 HTTP server listening on :%s", httpPort)
		if err := app.Listen(":" + httpPort); err != nil {
			log.Fatalf("HTTP server error: %v", err)
		}
	}()

	// ─── Graceful shutdown ───
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit

	log.Println("Shutting down...")
	grpcServer.GracefulStop()
	app.ShutdownWithContext(context.Background())
	log.Println("Server stopped")
}

func getEnv(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}

func customErrorHandler(c *fiber.Ctx, err error) error {
	code := fiber.StatusInternalServerError
	if e, ok := err.(*fiber.Error); ok {
		code = e.Code
	}
	return c.Status(code).JSON(fiber.Map{
		"error": err.Error(),
		"code":  code,
	})
}

// ─── Webhook Handlers ───

func handleFlutterwaveWebhook(l *ledger.Service) fiber.Handler {
	return func(c *fiber.Ctx) error {
		// Verify webhook signature
		// Process payment completion
		// Update ledger via double-entry
		log.Println("[WEBHOOK] Flutterwave event received")
		return c.JSON(fiber.Map{"received": true})
	}
}

func handlePaystackWebhook(l *ledger.Service) fiber.Handler {
	return func(c *fiber.Ctx) error {
		log.Println("[WEBHOOK] Paystack event received")
		return c.JSON(fiber.Map{"received": true})
	}
}

// ─── Internal Transfer Handlers ───

func handleTransfer(l *ledger.Service, r *router.SmartRouter) fiber.Handler {
	return func(c *fiber.Ctx) error {
		type TransferReq struct {
			TransactionID string  `json:"transactionId"`
			Amount        float64 `json:"amount"`
			Currency      string  `json:"currency"`
			ToAmount      float64 `json:"toAmount"`
			ToCurrency    string  `json:"toCurrency"`
			Rail          string  `json:"rail"`
		}

		var req TransferReq
		if err := c.BodyParser(&req); err != nil {
			return c.Status(400).JSON(fiber.Map{"error": "invalid request"})
		}

		// Smart router picks the best payment rail
		route := r.SelectRoute(req.Currency, req.ToCurrency, req.Amount, req.Rail)

		// Process through selected provider
		log.Printf("[TRANSFER] %s: %.2f %s → %.2f %s via %s",
			req.TransactionID, req.Amount, req.Currency, req.ToAmount, req.ToCurrency, route.Provider)

		// Record in double-entry ledger
		err := l.RecordTransfer(req.TransactionID, req.Amount, req.Currency)
		if err != nil {
			return c.Status(500).JSON(fiber.Map{"error": "ledger error"})
		}

		return c.JSON(fiber.Map{
			"transactionId": req.TransactionID,
			"status":        "processing",
			"provider":      route.Provider,
			"rail":          route.Rail,
			"estimatedTime": route.EstimatedTime,
		})
	}
}

func handleTopupComplete(l *ledger.Service) fiber.Handler {
	return func(c *fiber.Ctx) error {
		type CompleteReq struct {
			TransactionID string  `json:"transactionId"`
			Amount        float64 `json:"amount"`
			Currency      string  `json:"currency"`
			WalletID      string  `json:"walletId"`
		}

		var req CompleteReq
		if err := c.BodyParser(&req); err != nil {
			return c.Status(400).JSON(fiber.Map{"error": "invalid request"})
		}

		err := l.RecordTopup(req.TransactionID, req.WalletID, req.Amount, req.Currency)
		if err != nil {
			return c.Status(500).JSON(fiber.Map{"error": "ledger error"})
		}

		return c.JSON(fiber.Map{"status": "completed"})
	}
}

func handleWithdraw(l *ledger.Service, r *router.SmartRouter) fiber.Handler {
	return func(c *fiber.Ctx) error {
		return c.JSON(fiber.Map{"status": "processing"})
	}
}

func handleGetRates() fiber.Handler {
	return func(c *fiber.Ctx) error {
		// Return current FX rates
		rates := map[string]float64{
			"USD_NGN": 1452.00,
			"USD_GBP": 0.79,
			"USD_EUR": 0.92,
			"USD_GHS": 15.80,
			"USD_KES": 129.50,
			"USD_ZAR": 18.20,
			"NGN_USD": 0.000689,
		}
		return c.JSON(rates)
	}
}
