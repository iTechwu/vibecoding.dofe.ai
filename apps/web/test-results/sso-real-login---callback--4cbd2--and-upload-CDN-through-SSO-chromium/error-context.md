# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: sso-real.spec.ts >> login -> callback -> refresh -> logout and upload/CDN through SSO
- Location: e2e/sso-real.spec.ts:109:5

# Error details

```
Error: page.evaluate: Error: upload token missing: {"code":"900502","msg":"Database Creation Failed","error":{"type":"UNKNOWN_ERROR","prismaCode":"P2007","description":"未知数据库错误","originalMessage":"\nInvalid `this.getWriteClient().fileSource.create()` invocation in\n/Users/techwu/Documents/codes/dofe.ai/sso.dofe.ai/apps/api/dist/main.js:24539:49\n\n  24536     });\n  24537 }\n  24538 async create(data, additional) {\n→ 24539     return this.getWriteClient().fileSource.create(\nInvalid input value: invalid input syntax for type uuid: \"dofe-public/dev/avatar/1781933867238-tqnb3mve9y9.txt\"","model":"FileSource"}}
    at eval (eval at evaluate (:303:30), <anonymous>:30:13)
    at async <anonymous>:329:30
```

# Page snapshot

```yaml
- generic [active] [ref=e1]:
  - region "Notifications alt+T"
  - generic [ref=e3]:
    - banner [ref=e4]:
      - generic [ref=e5]:
        - button "Search" [ref=e6] [cursor=pointer]:
          - img
          - generic [ref=e7]: Search
        - button "Switch language" [ref=e8] [cursor=pointer]:
          - img
          - generic [ref=e9]: Switch language
        - button "超" [ref=e10] [cursor=pointer]:
          - generic [ref=e12]: 超
    - generic [ref=e13]:
      - generic [ref=e16]:
        - generic [ref=e17]:
          - generic [ref=e18]:
            - generic [ref=e19]: navigation.menu.groupMain
            - list [ref=e21]:
              - listitem [ref=e22]:
                - link "Dashboard" [ref=e23] [cursor=pointer]:
                  - /url: /en
                  - img [ref=e24]
                  - generic [ref=e29]: Dashboard
          - generic [ref=e31]:
            - generic [ref=e32]: navigation.menu.groupSettings
            - list [ref=e34]:
              - listitem [ref=e35]:
                - link "Settings" [ref=e36] [cursor=pointer]:
                  - /url: /en/settings
                  - img [ref=e37]
                  - generic [ref=e40]: Settings
        - generic [ref=e41]:
          - generic [ref=e45]: Dofe.AI
          - button "Toggle Sidebar" [ref=e47] [cursor=pointer]:
            - img
            - generic [ref=e48]: Toggle Sidebar
      - main [ref=e49]:
        - main [ref=e50]:
          - generic [ref=e52]:
            - heading "Welcome to DoFe.AI" [level=1] [ref=e53]
            - paragraph [ref=e54]: Do For Employee · Do For Enterprise · Do For Empowerment
            - generic [ref=e55]:
              - generic [ref=e56]:
                - heading "📚 Documentation" [level=2] [ref=e57]
                - paragraph [ref=e58]: Read the docs to learn about the architecture and best practices.
              - generic [ref=e59]:
                - heading "🚀 Quick Start" [level=2] [ref=e60]
                - paragraph [ref=e61]:
                  - text: Run
                  - code [ref=e62]: pnpm dev
                  - text: to start developing locally.
              - generic [ref=e63]:
                - heading "🏗️ Architecture" [level=2] [ref=e64]
                - paragraph [ref=e65]: 4-layer architecture with type-safe API contracts using ts-rest.
              - generic [ref=e66]:
                - heading "🤖 Agents" [level=2] [ref=e67]
                - paragraph [ref=e68]: Agent UI is planned; gateway and routing APIs are ready for model traffic today.
              - generic [ref=e69]:
                - heading "📦 Shared Packages" [level=2] [ref=e70]
                - paragraph [ref=e71]: UI, utils, types, validators, and contracts shared across apps.
              - generic [ref=e72]:
                - heading "🔒 Type Safety" [level=2] [ref=e73]
                - paragraph [ref=e74]: Zod 4 validation + ts-rest for end-to-end type safety.
  - button "Open Next.js Dev Tools" [ref=e80] [cursor=pointer]:
    - img [ref=e81]
  - alert [ref=e84]
```