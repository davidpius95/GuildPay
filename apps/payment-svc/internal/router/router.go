package router

import (
	"log"
	"sort"
)

// Route represents a payment rail option
type Route struct {
	Provider      string  // nium, flutterwave, blockchain
	Rail          string  // BANK_TRANSFER, MOBILE_MONEY, CARD, CRYPTO, SWIFT, VISA_DIRECT
	Fee           float64 // percentage fee
	FlatFee       float64 // flat fee amount
	EstimatedTime string  // human readable
	Priority      int     // lower = better
	Available     bool
}

// SmartRouter selects the cheapest/fastest payment rail
type SmartRouter struct {
	routes map[string][]Route // keyed by "from_to" currency pair
}

func NewSmartRouter() *SmartRouter {
	r := &SmartRouter{
		routes: make(map[string][]Route),
	}
	r.loadRoutes()
	return r
}

func (r *SmartRouter) loadRoutes() {
	// ─── Gulf → Africa (Nium primary via Ecobank, Flutterwave fallback) ───

	// AED corridors
	r.routes["AED_NGN"] = []Route{
		{Provider: "nium", Rail: "BANK_TRANSFER", Fee: 0.01, FlatFee: 0, EstimatedTime: "5-15 min", Priority: 1, Available: true},
		{Provider: "flutterwave", Rail: "BANK_TRANSFER", Fee: 0.015, FlatFee: 0, EstimatedTime: "10-30 min", Priority: 2, Available: true},
	}
	r.routes["AED_KES"] = []Route{
		{Provider: "nium", Rail: "BANK_TRANSFER", Fee: 0.01, FlatFee: 0, EstimatedTime: "5-15 min", Priority: 1, Available: true},
		{Provider: "flutterwave", Rail: "MOBILE_MONEY", Fee: 0.02, FlatFee: 0, EstimatedTime: "1-5 min", Priority: 2, Available: true},
	}
	r.routes["AED_GHS"] = []Route{
		{Provider: "nium", Rail: "BANK_TRANSFER", Fee: 0.01, FlatFee: 0, EstimatedTime: "5-15 min", Priority: 1, Available: true},
		{Provider: "flutterwave", Rail: "MOBILE_MONEY", Fee: 0.02, FlatFee: 0, EstimatedTime: "5-15 min", Priority: 2, Available: true},
	}
	r.routes["AED_ZAR"] = []Route{
		{Provider: "nium", Rail: "SWIFT", Fee: 0.012, FlatFee: 5, EstimatedTime: "1-2 days", Priority: 1, Available: true},
	}

	// QAR corridors (Qatar — Nium Doha Bank partnership + Visa Direct)
	r.routes["QAR_NGN"] = []Route{
		{Provider: "nium", Rail: "BANK_TRANSFER", Fee: 0.012, FlatFee: 0, EstimatedTime: "5-30 min", Priority: 1, Available: true},
		{Provider: "flutterwave", Rail: "BANK_TRANSFER", Fee: 0.018, FlatFee: 0, EstimatedTime: "10-30 min", Priority: 2, Available: true},
	}
	r.routes["NGN_QAR"] = []Route{
		{Provider: "nium", Rail: "VISA_DIRECT", Fee: 0.012, FlatFee: 0, EstimatedTime: "Real-time", Priority: 1, Available: true},
		{Provider: "nium", Rail: "SWIFT", Fee: 0.015, FlatFee: 10, EstimatedTime: "1-2 days", Priority: 2, Available: true},
	}
	r.routes["QAR_KES"] = []Route{
		{Provider: "nium", Rail: "BANK_TRANSFER", Fee: 0.012, FlatFee: 0, EstimatedTime: "5-30 min", Priority: 1, Available: true},
	}
	r.routes["QAR_GHS"] = []Route{
		{Provider: "nium", Rail: "BANK_TRANSFER", Fee: 0.012, FlatFee: 0, EstimatedTime: "5-30 min", Priority: 1, Available: true},
	}

	// SAR corridors
	r.routes["SAR_NGN"] = []Route{
		{Provider: "nium", Rail: "BANK_TRANSFER", Fee: 0.01, FlatFee: 0, EstimatedTime: "5-15 min", Priority: 1, Available: true},
	}
	r.routes["SAR_KES"] = []Route{
		{Provider: "nium", Rail: "BANK_TRANSFER", Fee: 0.01, FlatFee: 0, EstimatedTime: "5-15 min", Priority: 1, Available: true},
	}

	// ─── USD → Africa (both providers compete) ───

	r.routes["USD_NGN"] = []Route{
		{Provider: "nium", Rail: "BANK_TRANSFER", Fee: 0.01, FlatFee: 0, EstimatedTime: "5-15 min", Priority: 1, Available: true},
		{Provider: "flutterwave", Rail: "BANK_TRANSFER", Fee: 0.015, FlatFee: 0, EstimatedTime: "10-30 min", Priority: 2, Available: true},
	}
	r.routes["USD_KES"] = []Route{
		{Provider: "nium", Rail: "BANK_TRANSFER", Fee: 0.01, FlatFee: 0, EstimatedTime: "5-15 min", Priority: 1, Available: true},
		{Provider: "flutterwave", Rail: "MOBILE_MONEY", Fee: 0.02, FlatFee: 0, EstimatedTime: "1-5 min", Priority: 2, Available: true},
	}
	r.routes["USD_GHS"] = []Route{
		{Provider: "nium", Rail: "BANK_TRANSFER", Fee: 0.01, FlatFee: 0, EstimatedTime: "5-15 min", Priority: 1, Available: true},
		{Provider: "flutterwave", Rail: "MOBILE_MONEY", Fee: 0.02, FlatFee: 0, EstimatedTime: "5-15 min", Priority: 2, Available: true},
	}
	r.routes["USD_ZAR"] = []Route{
		{Provider: "nium", Rail: "SWIFT", Fee: 0.012, FlatFee: 5, EstimatedTime: "1-2 days", Priority: 1, Available: true},
	}

	// ─── GBP/EUR → Africa (Nium primary) ───

	r.routes["GBP_NGN"] = []Route{
		{Provider: "nium", Rail: "BANK_TRANSFER", Fee: 0.01, FlatFee: 0, EstimatedTime: "5-15 min", Priority: 1, Available: true},
		{Provider: "flutterwave", Rail: "BANK_TRANSFER", Fee: 0.015, FlatFee: 0, EstimatedTime: "10-30 min", Priority: 2, Available: true},
	}
	r.routes["GBP_KES"] = []Route{
		{Provider: "nium", Rail: "BANK_TRANSFER", Fee: 0.01, FlatFee: 0, EstimatedTime: "5-15 min", Priority: 1, Available: true},
	}
	r.routes["GBP_GHS"] = []Route{
		{Provider: "nium", Rail: "BANK_TRANSFER", Fee: 0.01, FlatFee: 0, EstimatedTime: "5-15 min", Priority: 1, Available: true},
	}
	r.routes["EUR_NGN"] = []Route{
		{Provider: "nium", Rail: "BANK_TRANSFER", Fee: 0.01, FlatFee: 0, EstimatedTime: "5-15 min", Priority: 1, Available: true},
	}
	r.routes["EUR_KES"] = []Route{
		{Provider: "nium", Rail: "BANK_TRANSFER", Fee: 0.01, FlatFee: 0, EstimatedTime: "5-15 min", Priority: 1, Available: true},
	}

	// ─── Africa → Africa (Flutterwave local rails) ───

	r.routes["NGN_GHS"] = []Route{
		{Provider: "flutterwave", Rail: "BANK_TRANSFER", Fee: 0.015, FlatFee: 0, EstimatedTime: "5-30 min", Priority: 1, Available: true},
	}
	r.routes["NGN_KES"] = []Route{
		{Provider: "flutterwave", Rail: "BANK_TRANSFER", Fee: 0.015, FlatFee: 0, EstimatedTime: "5-30 min", Priority: 1, Available: true},
	}
	r.routes["GHS_KES"] = []Route{
		{Provider: "flutterwave", Rail: "MOBILE_MONEY", Fee: 0.02, FlatFee: 0, EstimatedTime: "1-5 min", Priority: 1, Available: true},
	}
	r.routes["KES_GHS"] = []Route{
		{Provider: "flutterwave", Rail: "MOBILE_MONEY", Fee: 0.02, FlatFee: 0, EstimatedTime: "1-5 min", Priority: 1, Available: true},
	}

	// ─── Crypto corridors ───

	r.routes["USDT_USD"] = []Route{
		{Provider: "blockchain", Rail: "CRYPTO", Fee: 0.005, FlatFee: 0, EstimatedTime: "2-5 min", Priority: 1, Available: true},
	}
	r.routes["USD_USDT"] = []Route{
		{Provider: "blockchain", Rail: "CRYPTO", Fee: 0.005, FlatFee: 0, EstimatedTime: "2-5 min", Priority: 1, Available: true},
	}
	r.routes["USDC_USD"] = []Route{
		{Provider: "blockchain", Rail: "CRYPTO", Fee: 0.003, FlatFee: 0, EstimatedTime: "1-2 min", Priority: 1, Available: true},
	}
	r.routes["USD_USDC"] = []Route{
		{Provider: "blockchain", Rail: "CRYPTO", Fee: 0.003, FlatFee: 0, EstimatedTime: "1-2 min", Priority: 1, Available: true},
	}

	// ─── Internal ───

	r.routes["INTERNAL"] = []Route{
		{Provider: "internal", Rail: "INTERNAL", Fee: 0, FlatFee: 0, EstimatedTime: "instant", Priority: 0, Available: true},
	}
}

// SelectRoute picks the optimal payment rail for a given transfer
func (r *SmartRouter) SelectRoute(fromCurrency, toCurrency string, amount float64, preferredRail string) Route {
	key := fromCurrency + "_" + toCurrency

	if fromCurrency == toCurrency {
		key = "INTERNAL"
	}

	routes, ok := r.routes[key]
	if !ok {
		// Try via USD intermediary
		log.Printf("[ROUTER] No direct route for %s, trying via USD", key)
		routes = r.routes["USD_"+toCurrency]
		if routes == nil {
			// Ultimate fallback via Nium SWIFT
			return Route{
				Provider:      "nium",
				Rail:          "SWIFT",
				Fee:           0.015,
				FlatFee:       10,
				EstimatedTime: "1-3 days",
				Priority:      99,
				Available:     true,
			}
		}
	}

	// Filter by availability and preferred rail
	available := make([]Route, 0)
	for _, route := range routes {
		if !route.Available {
			continue
		}
		if preferredRail != "" && route.Rail != preferredRail {
			continue
		}
		available = append(available, route)
	}

	if len(available) == 0 {
		for _, route := range routes {
			if route.Available {
				available = append(available, route)
			}
		}
	}

	if len(available) == 0 {
		log.Printf("[ROUTER] No routes available for %s", key)
		return Route{Provider: "none", Rail: "NONE", Available: false}
	}

	// Sort by total cost, then priority
	sort.Slice(available, func(i, j int) bool {
		costI := available[i].Fee*amount + available[i].FlatFee
		costJ := available[j].Fee*amount + available[j].FlatFee
		if costI != costJ {
			return costI < costJ
		}
		return available[i].Priority < available[j].Priority
	})

	selected := available[0]
	totalFee := selected.Fee*amount + selected.FlatFee

	log.Printf("[ROUTER] Selected %s/%s for %.2f %s→%s (fee: %.2f, time: %s)",
		selected.Provider, selected.Rail, amount, fromCurrency, toCurrency, totalFee, selected.EstimatedTime)

	return selected
}

// CalculateFee returns the total fee for a route
func (r *SmartRouter) CalculateFee(route Route, amount float64) float64 {
	return route.Fee*amount + route.FlatFee
}

// GetAvailableCorridors returns all supported currency corridors
func (r *SmartRouter) GetAvailableCorridors() []string {
	corridors := make([]string, 0, len(r.routes))
	for k := range r.routes {
		if k != "INTERNAL" {
			corridors = append(corridors, k)
		}
	}
	sort.Strings(corridors)
	return corridors
}
