package store

import (
	"context"
	"database/sql"
	"errors"
	"fmt"

	"github.com/FuzzySlipper/rusty-roleplay/lorekeep/internal/lore"
)

// UpsertNode inserts or updates a topic node by (campaign_id, slug) and returns its id.
func (s *Store) UpsertNode(ctx context.Context, n *lore.TopicNode) (int64, error) {
	_, err := s.db.ExecContext(ctx, `
		INSERT INTO topic_nodes (campaign_id, slug, title, summary, node_kind, canon_level, discovery_scope, tags_json)
		VALUES (?,?,?,?,?,?,?,?)
		ON CONFLICT (campaign_id, slug) DO UPDATE SET
			title=excluded.title, summary=excluded.summary, node_kind=excluded.node_kind,
			canon_level=excluded.canon_level, discovery_scope=excluded.discovery_scope, tags_json=excluded.tags_json`,
		n.CampaignID, n.Slug, n.Title, n.Summary, string(n.NodeKind), string(n.CanonLevel),
		string(n.DiscoveryScope), marshalStrings(n.Tags))
	if err != nil {
		return 0, fmt.Errorf("upsert node: %w", err)
	}
	return s.nodeID(ctx, n.CampaignID, n.Slug)
}

// GetNode returns a topic node by (campaign_id, slug).
func (s *Store) GetNode(ctx context.Context, campaignID, slug string) (*lore.TopicNode, error) {
	row := s.db.QueryRowContext(ctx,
		`SELECT id, campaign_id, slug, title, summary, node_kind, canon_level, discovery_scope, tags_json
		 FROM topic_nodes WHERE campaign_id=? AND slug=?`, campaignID, slug)
	node, err := scanNode(row)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, ErrNotFound
	}
	return node, err
}

// CreateEdge connects two nodes (resolved by slug) with a typed relation.
func (s *Store) CreateEdge(ctx context.Context, e *lore.TopicEdge) error {
	fromID, err := s.nodeID(ctx, e.CampaignID, e.FromSlug)
	if err != nil {
		return err
	}
	toID, err := s.nodeID(ctx, e.CampaignID, e.ToSlug)
	if err != nil {
		return err
	}
	depth := e.EdgeDepthHint
	if depth <= 0 {
		depth = 1
	}
	_, err = s.db.ExecContext(ctx,
		`INSERT INTO topic_edges (campaign_id, from_node_id, to_node_id, relation, edge_depth_hint)
		 VALUES (?,?,?,?,?)`,
		e.CampaignID, fromID, toID, string(e.Relation), depth)
	if err != nil {
		return fmt.Errorf("create edge: %w", err)
	}
	return nil
}

// NeighborsOf returns the nodes directly reachable from the given node, paired
// with the edge relation that reached them.
func (s *Store) NeighborsOf(ctx context.Context, campaignID, slug string) ([]lore.TopicNode, []lore.TopicEdge, error) {
	fromID, err := s.nodeID(ctx, campaignID, slug)
	if err != nil {
		return nil, nil, err
	}
	rows, err := s.db.QueryContext(ctx, `
		SELECT n.id, n.campaign_id, n.slug, n.title, n.summary, n.node_kind, n.canon_level, n.discovery_scope, n.tags_json,
		       e.relation, e.edge_depth_hint, from_n.slug
		FROM topic_edges e
		JOIN topic_nodes n ON n.id = e.to_node_id
		JOIN topic_nodes from_n ON from_n.id = e.from_node_id
		WHERE e.from_node_id = ?`, fromID)
	if err != nil {
		return nil, nil, fmt.Errorf("neighbors query: %w", err)
	}
	defer rows.Close()
	var nodes []lore.TopicNode
	var edges []lore.TopicEdge
	for rows.Next() {
		var (
			n        lore.TopicNode
			kind     string
			canon    string
			scope    string
			tags     string
			relation string
			depth    int
			fromSlug string
		)
		if err := rows.Scan(&n.ID, &n.CampaignID, &n.Slug, &n.Title, &n.Summary, &kind, &canon, &scope, &tags,
			&relation, &depth, &fromSlug); err != nil {
			return nil, nil, err
		}
		n.NodeKind = lore.NodeKind(kind)
		n.CanonLevel = lore.CanonLevel(canon)
		n.DiscoveryScope = lore.CampaignScope(scope)
		n.Tags = unmarshalStrings(tags)
		nodes = append(nodes, n)
		edges = append(edges, lore.TopicEdge{
			CampaignID: campaignID, FromSlug: fromSlug, ToSlug: n.Slug,
			Relation: lore.EdgeRelation(relation), EdgeDepthHint: depth,
		})
	}
	return nodes, edges, rows.Err()
}

func (s *Store) nodeID(ctx context.Context, campaignID, slug string) (int64, error) {
	var id int64
	err := s.db.QueryRowContext(ctx,
		`SELECT id FROM topic_nodes WHERE campaign_id=? AND slug=?`, campaignID, slug).Scan(&id)
	if errors.Is(err, sql.ErrNoRows) {
		return 0, ErrNotFound
	}
	if err != nil {
		return 0, fmt.Errorf("resolve node %q: %w", slug, err)
	}
	return id, nil
}

func scanNode(row scanner) (*lore.TopicNode, error) {
	var (
		n     lore.TopicNode
		kind  string
		canon string
		scope string
		tags  string
	)
	if err := row.Scan(&n.ID, &n.CampaignID, &n.Slug, &n.Title, &n.Summary, &kind, &canon, &scope, &tags); err != nil {
		return nil, err
	}
	n.NodeKind = lore.NodeKind(kind)
	n.CanonLevel = lore.CanonLevel(canon)
	n.DiscoveryScope = lore.CampaignScope(scope)
	n.Tags = unmarshalStrings(tags)
	return &n, nil
}
