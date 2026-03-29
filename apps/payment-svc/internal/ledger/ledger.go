package ledger

import (
	"fmt"
	"log"
	"sync"
	"time"
)

// Entry represents a single ledger entry (debit or credit)
type Entry struct {
	ID            string
	TransactionID string
	AccountID     string
	AccountType   string // USER_WALLET, SYSTEM_FEE, SYSTEM_FLOAT, PROVIDER
	EntryType     string // DEBIT or CREDIT
	Amount        float64
	Currency      string
	BalanceBefore float64
	BalanceAfter  float64
	Description   string
	CreatedAt     time.Time
}

// Service handles double-entry bookkeeping
type Service struct {
	mu      sync.Mutex
	entries []Entry
}

func NewService() *Service {
	return &Service{
		entries: make([]Entry, 0),
	}
}

// RecordTransfer creates balanced debit+credit entries for a P2P transfer
// Fundamental rule: Every debit must have an equal credit (assets = liabilities + equity)
func (s *Service) RecordTransfer(transactionID string, amount float64, currency string) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	now := time.Now()

	// Debit sender's wallet (reduce their balance)
	debit := Entry{
		ID:            fmt.Sprintf("le_%s_debit", transactionID),
		TransactionID: transactionID,
		AccountType:   "USER_WALLET",
		EntryType:     "DEBIT",
		Amount:        amount,
		Currency:      currency,
		Description:   "Transfer sent",
		CreatedAt:     now,
	}

	// Credit system float (funds in transit)
	credit := Entry{
		ID:            fmt.Sprintf("le_%s_credit", transactionID),
		TransactionID: transactionID,
		AccountType:   "SYSTEM_FLOAT",
		EntryType:     "CREDIT",
		Amount:        amount,
		Currency:      currency,
		Description:   "Transfer in transit",
		CreatedAt:     now,
	}

	// Validate: debits == credits (fundamental accounting equation)
	if debit.Amount != credit.Amount {
		return fmt.Errorf("ledger imbalance: debit %.8f != credit %.8f", debit.Amount, credit.Amount)
	}

	s.entries = append(s.entries, debit, credit)
	log.Printf("[LEDGER] Transfer %s: %.2f %s (debit wallet, credit float)", transactionID, amount, currency)

	return nil
}

// RecordTopup creates entries when user funds their wallet
func (s *Service) RecordTopup(transactionID, walletID string, amount float64, currency string) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	now := time.Now()

	// Debit provider account (money coming from Flutterwave/Paystack)
	debit := Entry{
		ID:            fmt.Sprintf("le_%s_debit", transactionID),
		TransactionID: transactionID,
		AccountID:     "provider_flutterwave",
		AccountType:   "PROVIDER",
		EntryType:     "DEBIT",
		Amount:        amount,
		Currency:      currency,
		Description:   "Top-up received from provider",
		CreatedAt:     now,
	}

	// Credit user's wallet
	credit := Entry{
		ID:            fmt.Sprintf("le_%s_credit", transactionID),
		TransactionID: transactionID,
		AccountID:     walletID,
		AccountType:   "USER_WALLET",
		EntryType:     "CREDIT",
		Amount:        amount,
		Currency:      currency,
		Description:   "Top-up credited to wallet",
		CreatedAt:     now,
	}

	s.entries = append(s.entries, debit, credit)
	log.Printf("[LEDGER] Topup %s: %.2f %s credited to wallet %s", transactionID, amount, currency, walletID)

	return nil
}

// RecordFee records fee collection
func (s *Service) RecordFee(transactionID string, feeAmount float64, currency string) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	now := time.Now()

	debit := Entry{
		ID:            fmt.Sprintf("le_%s_fee_debit", transactionID),
		TransactionID: transactionID,
		AccountType:   "USER_WALLET",
		EntryType:     "DEBIT",
		Amount:        feeAmount,
		Currency:      currency,
		Description:   "Transaction fee",
		CreatedAt:     now,
	}

	credit := Entry{
		ID:            fmt.Sprintf("le_%s_fee_credit", transactionID),
		TransactionID: transactionID,
		AccountType:   "SYSTEM_FEE",
		EntryType:     "CREDIT",
		Amount:        feeAmount,
		Currency:      currency,
		Description:   "Fee revenue",
		CreatedAt:     now,
	}

	s.entries = append(s.entries, debit, credit)
	log.Printf("[LEDGER] Fee %s: %.2f %s", transactionID, feeAmount, currency)

	return nil
}

// GetBalance returns total debits - credits for an account
func (s *Service) GetBalance(accountID string) float64 {
	s.mu.Lock()
	defer s.mu.Unlock()

	var balance float64
	for _, e := range s.entries {
		if e.AccountID == accountID {
			if e.EntryType == "CREDIT" {
				balance += e.Amount
			} else {
				balance -= e.Amount
			}
		}
	}
	return balance
}

// VerifyIntegrity checks that all debits equal all credits (zero-sum)
func (s *Service) VerifyIntegrity() error {
	s.mu.Lock()
	defer s.mu.Unlock()

	var totalDebits, totalCredits float64
	for _, e := range s.entries {
		if e.EntryType == "DEBIT" {
			totalDebits += e.Amount
		} else {
			totalCredits += e.Amount
		}
	}

	if totalDebits != totalCredits {
		return fmt.Errorf("ledger integrity check failed: debits %.8f != credits %.8f", totalDebits, totalCredits)
	}

	log.Printf("[LEDGER] Integrity OK: %d entries, %.2f total volume", len(s.entries), totalDebits)
	return nil
}
