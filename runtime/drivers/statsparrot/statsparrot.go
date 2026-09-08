// Package statsparrot grafts Statsparrot's differentiators onto Parrot's connector framework:
// its SaaS source connectors (shopify, woocommerce, google_analytics4, meta_ads, tiktok_ads,
// stripe), the per-source ingestion mapping, and reverse-ETL of model output to a destination.
// The Parrot chat agent that drives these connectors lives in the runtime/ai package.
package statsparrot

import (
	"context"
	"errors"

	"github.com/staticlabs/statsparrot/runtime/drivers"
	"github.com/staticlabs/statsparrot/runtime/pkg/activity"
	"github.com/staticlabs/statsparrot/runtime/storage"
	"go.uber.org/zap"
)

// connectorNames are the Statsparrot SaaS connectors registered with the Parrot connector framework.
var connectorNames = []string{
	"statsparrot",
	"shopify",
	"woocommerce",
	"google_analytics4",
	"meta_ads",
	"tiktok_ads",
	"stripe",
}

func init() {
	for _, name := range connectorNames {
		drivers.Register(name, driver{})
		drivers.RegisterAsConnector(name, driver{})
	}
}

var spec = drivers.Spec{
	DisplayName: "Statsparrot",
	Description: "Statsparrot connectors. Provides ingestion of SaaS source data (shopify, woocommerce, google_analytics4, meta_ads, tiktok_ads, stripe) and reverse-ETL of model output to a destination.",
	ConfigProperties: []*drivers.PropertySpec{
		{
			Key:         "token",
			Type:        drivers.StringPropertyType,
			DisplayName: "Access token",
			Description: "The SaaS connector's access token.",
			Secret:      true,
		},
		{
			Key:         "registered",
			Type:        drivers.BooleanPropertyType,
			DisplayName: "Registered",
			Description: "Whether the source has been registered with the connector (but may not yet have been activated with real credentials).",
			NoPrompt:    true,
		},
	},
	SourceProperties: []*drivers.PropertySpec{
		{
			Key:         "objects",
			Type:        drivers.StringPropertyType,
			DisplayName: "Objects",
			Description: "For stripe sources, the object types to ingest (charges/customers/invoices).",
			Placeholder: "charges,customers,invoices",
		},
	},
}

type driver struct{}

func (d driver) Spec() drivers.Spec {
	return spec
}

func (d driver) Open(connectorName, instanceID string, config map[string]any, _ *storage.Client, _ *activity.Client, _ *zap.Logger) (drivers.Handle, error) {
	if instanceID == "" {
		return nil, errors.New("statsparrot driver can't be shared")
	}

	return &Connection{
		connectorName: connectorName,
		config:        config,
	}, nil
}

func (d driver) HasAnonymousSourceAccess(ctx context.Context, src map[string]any, logger *zap.Logger) (bool, error) {
	// These connectors require credentials, so anonymous access is never allowed.
	return false, nil
}

func (d driver) TertiarySourceConnectors(ctx context.Context, src map[string]any, logger *zap.Logger) ([]string, error) {
	return nil, nil
}

// Connection implements drivers.Handle for the statsparrot connector.
type Connection struct {
	connectorName string
	config        map[string]any
}

var _ drivers.Handle = &Connection{}

func (c *Connection) Ping(ctx context.Context) error {
	return nil
}

func (c *Connection) Driver() string {
	if c.connectorName != "" {
		return c.connectorName
	}
	return "statsparrot"
}

func (c *Connection) Config() map[string]any {
	m := make(map[string]any, len(c.config))
	for k, v := range c.config {
		m[k] = v
	}
	return m
}

func (c *Connection) Migrate(ctx context.Context) error {
	return nil
}

func (c *Connection) MigrationStatus(ctx context.Context) (int, int, error) {
	return 0, 0, nil
}

func (c *Connection) Close() error {
	return nil
}

func (c *Connection) AsRegistry() (drivers.RegistryStore, bool) {
	return nil, false
}

func (c *Connection) AsCatalogStore(instanceID string) (drivers.CatalogStore, bool) {
	return nil, false
}

func (c *Connection) AsRepoStore(instanceID string) (drivers.RepoStore, bool) {
	return nil, false
}

func (c *Connection) AsAdmin(instanceID string) (drivers.AdminService, bool) {
	return nil, false
}

func (c *Connection) AsAI(instanceID string) (drivers.AIService, bool) {
	return nil, false
}

func (c *Connection) AsOLAP(instanceID string) (drivers.OLAPStore, bool) {
	return nil, false
}

func (c *Connection) AsInformationSchema() (drivers.InformationSchema, bool) {
	return nil, false
}

func (c *Connection) AsObjectStore() (drivers.ObjectStore, bool) {
	return nil, false
}

func (c *Connection) AsFileStore() (drivers.FileStore, bool) {
	return nil, false
}

func (c *Connection) AsWarehouse() (drivers.Warehouse, bool) {
	return nil, false
}

func (c *Connection) AsModelExecutor(instanceID string, opts *drivers.ModelExecutorOptions) (drivers.ModelExecutor, error) {
	return nil, drivers.ErrNotImplemented
}

func (c *Connection) AsModelManager(instanceID string) (drivers.ModelManager, error) {
	return nil, drivers.ErrNotImplemented
}

func (c *Connection) AsNotifier(properties map[string]any) (drivers.Notifier, error) {
	return nil, drivers.ErrNotNotifier
}
