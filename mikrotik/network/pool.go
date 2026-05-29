package network

import (
	"context"
	"time"

	"github.com/quiqxiq/roslib"
	"github.com/quiqxiq/rosmon/domain"
	"github.com/quiqxiq/rosmon/mikrotik"
)

const poolPath = "/ip/pool"

// IPPoolList → /ip/pool/print (analisis §1.10).
func (c *Client) IPPoolList(ctx context.Context) ([]domain.IPPool, error) {
	reply, err := c.dev.Path(poolPath).Print().Exec(ctx)
	if err != nil {
		return nil, err
	}
	return sentencesToPools(reply.Rows), nil
}

// IPPoolByName → /ip/pool/print ?name=<name> (analisis §1.10).
func (c *Client) IPPoolByName(ctx context.Context, name string) (domain.IPPool, error) {
	if name == "" {
		return domain.IPPool{}, mikrotik.ErrInvalidArgument
	}
	reply, err := c.dev.Path(poolPath).Print().Where("name", name).Exec(ctx)
	if err != nil {
		return domain.IPPool{}, err
	}
	if len(reply.Rows) == 0 {
		return domain.IPPool{}, mikrotik.ErrNotFound
	}
	return sentenceToPool(reply.Rows[0]), nil
}

// PoolListCached → /ip/pool/print dengan TTL cache. IP pool nyaris
// immutable; cocok untuk dropdown profile yang refresh sering.
func (c *Client) PoolListCached(ctx context.Context, ttl time.Duration) ([]domain.IPPool, error) {
	reply, err := c.dev.Path(poolPath).Print().ExecCached(ctx, ttl)
	if err != nil {
		return nil, err
	}
	return sentencesToPools(reply.Rows), nil
}

// IPPoolAddArgs adalah parameter IPPoolAdd (analisis §1.10).
type IPPoolAddArgs struct {
	Name     string
	Ranges   string
	NextPool string
	Comment  string
}

// IPPoolAdd → /ip/pool/add (analisis §1.10).
func (c *Client) IPPoolAdd(ctx context.Context, a IPPoolAddArgs) (string, error) {
	if a.Name == "" || a.Ranges == "" {
		return "", mikrotik.ErrInvalidArgument
	}
	pairs := []roslib.Pair{
		roslib.NewPair("name", a.Name),
		roslib.NewPair("ranges", a.Ranges),
	}
	if a.NextPool != "" {
		pairs = append(pairs, roslib.NewPair("next-pool", a.NextPool))
	}
	if a.Comment != "" {
		pairs = append(pairs, roslib.NewPair("comment", a.Comment))
	}
	reply, err := c.dev.Path(poolPath).Add(ctx, pairs...)
	if err != nil {
		return "", err
	}
	if reply.Done == nil {
		return "", nil
	}
	return reply.Done.Map["ret"], nil
}

// IPPoolSetArgs adalah parameter IPPoolSet (analisis §1.10).
type IPPoolSetArgs struct {
	ID       string
	Name     *string
	Ranges   *string
	NextPool *string
	Comment  *string
}

// IPPoolSet → /ip/pool/set (analisis §1.10).
func (c *Client) IPPoolSet(ctx context.Context, a IPPoolSetArgs) error {
	if a.ID == "" {
		return mikrotik.ErrInvalidArgument
	}
	pairs := []roslib.Pair{}
	if a.Name != nil {
		pairs = append(pairs, roslib.NewPair("name", *a.Name))
	}
	if a.Ranges != nil {
		pairs = append(pairs, roslib.NewPair("ranges", *a.Ranges))
	}
	if a.NextPool != nil {
		pairs = append(pairs, roslib.NewPair("next-pool", *a.NextPool))
	}
	if a.Comment != nil {
		pairs = append(pairs, roslib.NewPair("comment", *a.Comment))
	}
	_, err := c.dev.Path(poolPath).Set(ctx, a.ID, pairs...)
	return err
}

// IPPoolRemove → /ip/pool/remove (analisis §1.10).
func (c *Client) IPPoolRemove(ctx context.Context, id string) error {
	if id == "" {
		return mikrotik.ErrInvalidArgument
	}
	_, err := c.dev.Path(poolPath).Remove(ctx, id)
	return err
}

func sentenceToPool(s *roslib.Sentence) domain.IPPool {
	return domain.IPPool{
		ID:        s.Get(".id"),
		Name:      s.Get("name"),
		Ranges:    s.Get("ranges"),
		Total:     s.IntOr("total", 0),
		Used:      s.IntOr("used", 0),
		Available: s.IntOr("available", 0),
		NextPool:  s.Get("next-pool"),
		Comment:   s.Get("comment"),
	}
}

func sentencesToPools(rows []*roslib.Sentence) []domain.IPPool {
	out := make([]domain.IPPool, 0, len(rows))
	for _, s := range rows {
		out = append(out, sentenceToPool(s))
	}
	return out
}
