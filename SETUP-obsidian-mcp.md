# Setup: Obsidian community plugins + MCP server (Items 1 & 3)

Status after this phase:
- ✅ **mcp-obsidian** Python server installed (`uv sync` done; `.venv` present). Verified it loads —
  it correctly demands `OBSIDIAN_API_KEY`, which you supply below.
- ✅ Registered in `.mcp.json` at the repo root (runs the local synced copy via `uv run`).
- ✅ Vault-template/skill packs extracted under `…\Downloads\Obsidian Vault\`:
  `mcp-obsidian-main`, `obsidian-mind-main`, `obsidian-second-brain-main`, `obsidian-skills-main`.
- ⏳ **Manual GUI step remaining:** install + enable the Obsidian community plugin and copy its key.

## 1. Install the "Local REST API" community plugin (Obsidian GUI — required)

`mcp-obsidian` talks to your vault through the **Local REST API** community plugin. This is a GUI
step (the plugin is fetched from Obsidian's community store):

1. Open your vault in Obsidian (`C:\Users\o3sha\OneDrive\3. Documents\Obsidian Vault`).
2. Settings → **Community plugins** → (turn off Restricted mode if prompted) → **Browse**.
3. Search **"Local REST API"** (by *coddingtonbear*) → **Install** → **Enable**.
4. Open its settings → copy the **API Key**. Note the port (default **27124** HTTPS / 27123 HTTP).

> This is also the concrete answer to "confirm community plugins load": once enabled, Settings →
> Community plugins shows it active, and your `.md` notes render in Reading view as normal.

## 2. Wire the key into the MCP server

Edit `.mcp.json` at the repo root — replace `REPLACE_WITH_LOCAL_REST_API_KEY` with the key from step 1
(and adjust `OBSIDIAN_PORT` if you use 27123/HTTP). Restart Claude Code so it reloads `.mcp.json`.

**Verify:** in Claude Code, the `mcp-obsidian` tools (`list_files_in_vault`, `search`,
`get_file_contents`, …) should return your vault's contents. From a shell you can sanity-check the
server boots with the key set:

```powershell
$env:OBSIDIAN_API_KEY="<your key>"; $env:OBSIDIAN_HOST="127.0.0.1"; $env:OBSIDIAN_PORT="27124"
uv run --directory "C:\Users\o3sha\Downloads\Obsidian Vault\mcp-obsidian-main\mcp-obsidian-main" mcp-obsidian
```

## 3. The vault-template / skill packs (obsidian-mind / second-brain / skills)

These are **not** Obsidian plugins — they're AI-agent skill/command packs (`commands/`, `hooks/`,
`adapters/`, `vault-manifest.json`). "Install" = copy each pack's `.claude/` commands/skills (or run
its README init, e.g. `obsidian-mind`'s `shardmind install`) into the vault you want them active in.
They're now extracted and ready; layer in whichever you want — they don't need a build.

## Notes
- The stray copies previously sitting in `.obsidian\plugins\` (`mcp-obsidian-main`,
  `obsidian-mind-main`) are source repos, not loadable plugins — the real plugin is the Local REST
  API one above; mcp-obsidian runs as an external MCP server, not inside Obsidian.
