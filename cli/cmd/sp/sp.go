// Package sp provides the Statsparrot self-hosted CLI entry points.
//
// Statsparrot is an open-source port of Parrot. The `sp` command tree reuses
// Parrot's local application server and project initializer directly, so a
// self-hosted deployment runs the exact same code path as Parrot Developer.
package sp

import (
	"github.com/staticlabs/statsparrot/cli/cmd/initialize"
	"github.com/staticlabs/statsparrot/cli/cmd/start"
	"github.com/staticlabs/statsparrot/cli/pkg/cmdutil"
	"github.com/spf13/cobra"
)

// SpCmd is the root of the Statsparrot self-hosted command tree.
func SpCmd(ch *cmdutil.Helper) *cobra.Command {
	spCmd := &cobra.Command{
		Use:   "sp <command> [flags]",
		Short: "Self-hosted Statsparrot (open-source Parrot) server",
		Long:  "sp is the self-hosted entry point for Statsparrot, an open-source port of Parrot. `sp init` scaffolds a project and `sp start` builds and serves it with the embedded web UI.",
	}

	startCmd := start.StartCmd(ch)
	startCmd.Short = "Build project and start the self-hosted Statsparrot web app"

	initCmd := initialize.InitCmd(ch)
	initCmd.Short = "Initialize a new self-hosted Statsparrot project"

	spCmd.AddCommand(startCmd, initCmd)
	return spCmd
}
