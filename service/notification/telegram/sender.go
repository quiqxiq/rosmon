// Package telegram menyediakan implementasi notification.Sender menggunakan
// Telegram Bot API. Pesan dikirim ke satu ChatID (admin group/channel).
// Nomor HP pelanggan diabaikan — kanal ini untuk notifikasi admin internal.
package telegram

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"time"
)

const apiTimeout = 10 * time.Second

// Sender mengirim pesan ke Telegram via Bot API.
type Sender struct {
	BotToken string // token dari @BotFather
	ChatID   string // chat_id admin (group, channel, atau user)
	client   *http.Client
}

// New membuat Sender baru. botToken dan chatID wajib diisi.
func New(botToken, chatID string) *Sender {
	return &Sender{
		BotToken: botToken,
		ChatID:   chatID,
		client:   &http.Client{Timeout: apiTimeout},
	}
}

func (s *Sender) Name() string { return "telegram" }

// Send mengirim pesan ke Telegram. Parameter `phone` diabaikan — pesan selalu
// dikirim ke s.ChatID yang sudah dikonfigurasi (admin target).
func (s *Sender) Send(ctx context.Context, _ /*phone*/, message string) (string, error) {
	if s.BotToken == "" || s.ChatID == "" {
		return "", fmt.Errorf("telegram: bot_token atau chat_id tidak dikonfigurasi")
	}

	payload := map[string]string{
		"chat_id":    s.ChatID,
		"text":       message,
		"parse_mode": "Markdown",
	}
	body, _ := json.Marshal(payload)

	url := fmt.Sprintf("https://api.telegram.org/bot%s/sendMessage", s.BotToken)
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, url, bytes.NewReader(body))
	if err != nil {
		return "", fmt.Errorf("telegram: build request: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")

	resp, err := s.client.Do(req)
	if err != nil {
		return "", fmt.Errorf("telegram: send: %w", err)
	}
	defer resp.Body.Close()

	respBody, _ := io.ReadAll(io.LimitReader(resp.Body, 4096))
	if resp.StatusCode != http.StatusOK {
		return "", fmt.Errorf("telegram: API error %d: %s", resp.StatusCode, string(respBody))
	}

	// Ekstrak message_id dari response sebagai providerResp.
	var apiResp struct {
		OK     bool `json:"ok"`
		Result struct {
			MessageID int `json:"message_id"`
		} `json:"result"`
	}
	if err := json.Unmarshal(respBody, &apiResp); err != nil || !apiResp.OK {
		return string(respBody), nil
	}
	return fmt.Sprintf("telegram:msg:%d", apiResp.Result.MessageID), nil
}
