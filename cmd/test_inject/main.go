package main

import (
	"context"
	"fmt"
	"log"

	"github.com/quiqxiq/roslib"
	"github.com/quiqxiq/rosmon/mikrotik/hotspot"
	"github.com/quiqxiq/rosmon/scripts/onlogin"
	"github.com/quiqxiq/rosmon/domain"
)

func main() {
	ctx := context.Background()

	dev, err := roslib.New(ctx, roslib.Options{
		Address:  "192.168.230.2:8728",
		Username: "admin",
		Password: "r00t",
	})
	if err != nil {
		log.Fatalf("connect: %v", err)
	}
	defer dev.Close()

	hot := hotspot.New(dev)

	// List profiles
	profiles, err := hot.ProfileList(ctx)
	if err != nil {
		log.Fatalf("profile list: %v", err)
	}
	fmt.Printf("Found %d profiles\n", len(profiles))
	for _, p := range profiles {
		fmt.Printf("  - %s (id=%s)\n", p.Name, p.ID)
	}

	if len(profiles) == 0 {
		log.Fatal("no profiles")
	}

	// Try inject to first profile
	target := profiles[0]
	fmt.Printf("\nTesting inject to profile: %s (id=%s)\n", target.Name, target.ID)

	script := onlogin.Build(onlogin.Options{
		Mode:        domain.ModeRemove,
		Validity:    "1d",
		Price:       5000,
		SellPrice:   7000,
		LockMAC:     false,
		WebhookURL:  "",
		ProfileName: target.Name,
	})

	fmt.Printf("Script length: %d bytes\n", len(script))
	fmt.Printf("Script body (first 300 chars):\n%s\n\n", script[:min(300, len(script))])

	err = hot.ProfileSet(ctx, hotspot.ProfileSetArgs{
		ID:      target.ID,
		OnLogin: &script,
	})
	if err != nil {
		fmt.Printf("INJECT FAILED: %v\n", err)
	} else {
		fmt.Println("INJECT SUCCESS")
	}

	// Verify by reading back
	fresh, err := hot.ProfileByName(ctx, target.Name)
	if err != nil {
		log.Fatalf("read back: %v", err)
	}
	fmt.Printf("On-login after set (first 200 chars): %s\n", fresh.OnLogin[:min(200, len(fresh.OnLogin))])
}

func min(a, b int) int {
	if a < b {
		return a
	}
	return b
}
