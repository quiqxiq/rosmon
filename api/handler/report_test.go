package handler

import (
	"testing"

	"github.com/quiqxiq/rosmon/store/model"
)

func TestAggregate_empty(t *testing.T) {
	s := aggregate(nil)
	if s.Count != 0 || s.TotalPrice != 0 || s.TotalSellPrice != 0 || s.Profit != 0 {
		t.Errorf("empty: %+v, want all zero", s)
	}
	if s.ByProfile != nil {
		t.Errorf("ByProfile should be nil for empty input, got %v", s.ByProfile)
	}
}

func TestAggregate_sums(t *testing.T) {
	txs := []model.Transaction{
		{Profile: "basic", Price: 5000, SellPrice: 10000},
		{Profile: "basic", Price: 5000, SellPrice: 10000},
		{Profile: "vip", Price: 10000, SellPrice: 25000},
		{Profile: "", Price: 0, SellPrice: 0}, // unknown profile
	}
	s := aggregate(txs)
	if s.Count != 4 {
		t.Errorf("Count = %d, want 4", s.Count)
	}
	if s.TotalPrice != 20000 {
		t.Errorf("TotalPrice = %d, want 20000", s.TotalPrice)
	}
	if s.TotalSellPrice != 45000 {
		t.Errorf("TotalSellPrice = %d, want 45000", s.TotalSellPrice)
	}
	if s.Profit != 25000 {
		t.Errorf("Profit = %d, want 25000", s.Profit)
	}
	if s.ByProfile["basic"] != 2 {
		t.Errorf("ByProfile[basic] = %d, want 2", s.ByProfile["basic"])
	}
	if s.ByProfile["vip"] != 1 {
		t.Errorf("ByProfile[vip] = %d, want 1", s.ByProfile["vip"])
	}
	if _, ok := s.ByProfile[""]; ok {
		t.Errorf("empty profile name should be excluded from ByProfile")
	}
}

func TestAggregate_negativeProfit(t *testing.T) {
	// Edge case: SellPrice < Price (rugi). Profit boleh negatif.
	txs := []model.Transaction{{Profile: "basic", Price: 10000, SellPrice: 5000}}
	s := aggregate(txs)
	if s.Profit != -5000 {
		t.Errorf("Profit = %d, want -5000", s.Profit)
	}
}
