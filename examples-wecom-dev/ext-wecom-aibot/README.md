# ext-wecom-aibot

Enterprise WeCom **AI Bot long-connection** channel extension for AionUI.

Uses the official [`@wecom/aibot-node-sdk`](https://www.npmjs.com/package/@wecom/aibot-node-sdk) `WSClient` (Bot ID + Secret). No public HTTPS callback URL is required for inbound messages.

## Status

| Phase | Scope |
|-------|--------|
| **P1a (this scaffold)** | Extension manifest, SDK runtime, identity, unified inbound, stream reply, UI panel |
| **P1b (next)** | AionCore extension channel host + assistant session bridge |
| **P0 gate** | Prove extension `start()`/`stop()` lifecycle when enabling channel in desktop app |

## Credentials

| Field | Required | Notes |
|-------|----------|-------|
| `botId` | yes | AI Bot ID from WeCom admin |
| `secret` | yes | AI Bot Secret |
| `wsUrl` (config) | no | Default `wss://openws.work.weixin.qq.com`; override for private deployment |

## Identity namespacing

Conversation and user ids are namespaced to avoid collisions with builtin channels and other extensions:

```
{pluginId}:{botId}:{chatId}
ext-wecom-aibot:ww123abc:dm:userid
ext-wecom-aibot:ww123abc:groupChatId
```

## v1 scope

- Internal DM and internal group chats only
- Group messages: rely on WeCom platform `@bot` mention rules
- **Not in v1:** corp self-built app callback path (see `ext-wecom-bot` compat extension)

## Local dev

From `aionui-src` repo root:

```bash
just dev-ext
```

Ensure `AIONUI_EXTENSIONS_PATH` includes `examples/` (default in dev bootstrap).

## Related

- **HTTP callback compat:** `examples/ext-wecom-bot/`
- **Deprecated builtin:** `wecom` in AionCore — hidden in UI when this extension is loaded
