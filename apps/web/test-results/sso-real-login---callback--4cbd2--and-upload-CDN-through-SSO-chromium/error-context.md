# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: sso-real.spec.ts >> login -> callback -> refresh -> logout and upload/CDN through SSO
- Location: e2e/sso-real.spec.ts:103:5

# Error details

```
Error: access token should be stored locally after callback exchange

expect(received).toBeTruthy()

Received: undefined
```

# Page snapshot

```yaml
- generic [ref=e1]:
    - region "Notifications alt+T"
    - generic [ref=e3]:
        - generic [ref=e5]:
            - generic [ref=e7]:
                - img "DoFe.AI" [ref=e8]
                - heading "DoFe.AI" [level=1] [ref=e9]
            - generic [ref=e10]:
                - paragraph [ref=e12]: Do For Employee · Do For Enterprise · Do For Empowerment
                - generic [ref=e13]:
                    - generic [ref=e14]:
                        - generic [ref=e15]:
                            - generic [ref=e16]: Do For Employee
                            - generic [ref=e17]: For Employees
                        - paragraph [ref=e18]: Always for the people — empower every team member
                    - generic [ref=e19]:
                        - button "Do For Employee" [ref=e20]
                        - button "Do For Enterprise" [ref=e21]
                        - button "Do For Empowerment" [ref=e22]
                        - button "Do For Execution" [ref=e23]
                        - button "Do For Efficiency" [ref=e24]
                        - button "Do For Excellence" [ref=e25]
                        - button "Do For Ecosystem" [ref=e26]
                        - button "Do For Evolution" [ref=e27]
                        - button "Do For Escort" [ref=e28]
                - generic [ref=e30]:
                    - generic [ref=e31]:
                        - paragraph [ref=e32]: Philosophy
                        - paragraph [ref=e33]: "Do For E — an open manifesto. dofe is more than an AI system: it's an execution engine built for Employees, Enterprises, and Empowerment."
                    - generic [ref=e34]:
                        - paragraph [ref=e35]: Commitment
                        - paragraph [ref=e36]: Warm like a dolphin, reliable as iron. We connect silos, build intelligent ecosystems, and make every execution a step toward excellence.
                - generic [ref=e38]:
                    - generic [ref=e39]:
                        - paragraph [ref=e40]: 愿景
                        - paragraph [ref=e41]: 成为受世界尊敬的中国企业
                    - generic [ref=e42]:
                        - paragraph [ref=e43]: 使命
                        - paragraph [ref=e44]: 成就中国智造的全球竞争力
            - generic [ref=e45]: © 2026 DoFe.AI
        - generic [ref=e48]:
            - generic [ref=e49]:
                - heading "Sign in to DoFe.AI" [level=1] [ref=e50]
                - paragraph [ref=e51]: Choose how to sign in
            - tablist [ref=e53]:
                - tab "Mobile" [selected] [ref=e54]:
                    - img
                    - text: Mobile
                - tab "Email" [ref=e55]:
                    - img
                    - text: Email
            - generic [ref=e56]:
                - generic [ref=e57]:
                    - generic [ref=e58]: Mobile number
                    - generic [ref=e59]:
                        - img
                        - textbox "Mobile number" [active] [ref=e60]:
                            - /placeholder: Enter your mobile number
                - generic [ref=e61]:
                    - generic [ref=e62]:
                        - generic [ref=e63]: Password
                        - link "Forgot Password" [ref=e64] [cursor=pointer]:
                            - /url: /forgot-password
                    - generic [ref=e65]:
                        - img
                        - textbox "Password" [ref=e66]:
                            - /placeholder: Enter your password
                        - button "Show password" [ref=e67]:
                            - img [ref=e68]
                - button "Sign in" [ref=e71]:
                    - generic [ref=e72]:
                        - text: Sign in
                        - img [ref=e73]
            - generic [ref=e75]:
                - generic [ref=e78]: Or continue with
                - generic [ref=e79]:
                    - button "Google 登录" [ref=e80]
                    - button "Discord 登录" [ref=e81]
                    - button "GitHub 登录" [ref=e82]
                    - button "微信登录" [ref=e83]
                    - button "飞书登录" [ref=e84]
    - button "Open Next.js Dev Tools" [ref=e90] [cursor=pointer]:
        - img [ref=e91]
    - alert [ref=e94]
```

# Test source

```ts
  23  |       await locator.fill(value);
  24  |       return true;
  25  |     }
  26  |   }
  27  |   return false;
  28  | }
  29  |
  30  | async function clickFirstVisible(page: Page, selectors: string[]): Promise<boolean> {
  31  |   for (const selector of selectors) {
  32  |     const locator = page.locator(selector).first();
  33  |     if (await locator.isVisible().catch(() => false)) {
  34  |       await locator.click();
  35  |       return true;
  36  |     }
  37  |   }
  38  |   return false;
  39  | }
  40  |
  41  | async function completeSsoLogin(page: Page): Promise<void> {
  42  |   const credential = email ?? mobile;
  43  |   requireEnv('E2E_SSO_EMAIL or E2E_SSO_MOBILE', credential);
  44  |   requireEnv('E2E_SSO_PASSWORD', password);
  45  |
  46  |   await page.waitForLoadState('domcontentloaded');
  47  |
  48  |   if (email) {
  49  |     await fillIfVisible(
  50  |       page,
  51  |       [
  52  |         '#login-email',
  53  |         'input[name="email"]',
  54  |         'input[type="email"]',
  55  |         'input[autocomplete="email"]',
  56  |       ],
  57  |       email,
  58  |     );
  59  |   } else if (mobile) {
  60  |     await fillIfVisible(
  61  |       page,
  62  |       [
  63  |         '#login-mobile',
  64  |         'input[name="mobile"]',
  65  |         'input[type="tel"]',
  66  |         'input[autocomplete="tel"]',
  67  |       ],
  68  |       mobile,
  69  |     );
  70  |   }
  71  |
  72  |   await fillIfVisible(
  73  |     page,
  74  |     [
  75  |       '#login-password',
  76  |       'input[name="password"]',
  77  |       'input[type="password"]',
  78  |       'input[autocomplete="current-password"]',
  79  |     ],
  80  |     password!,
  81  |   );
  82  |
  83  |   const submitted = await clickFirstVisible(page, [
  84  |     'button[type="submit"]',
  85  |     'button:has-text("登录")',
  86  |     'button:has-text("Sign in")',
  87  |     'button:has-text("Log in")',
  88  |   ]);
  89  |
  90  |   if (!submitted) {
  91  |     await page.keyboard.press('Enter');
  92  |   }
  93  |
  94  |   await clickFirstVisible(page, [
  95  |     'button:has-text("允许")',
  96  |     'button:has-text("同意")',
  97  |     'button:has-text("Authorize")',
  98  |     'button:has-text("Allow")',
  99  |     'button:has-text("Continue")',
  100 |   ]);
  101 | }
  102 |
  103 | test('login -> callback -> refresh -> logout and upload/CDN through SSO', async ({ page, baseURL }) => {
  104 |   expect(baseURL, 'Playwright baseURL must be configured').toBeTruthy();
  105 |
  106 |   await page.goto(`/login?callbackUrl=${encodeURIComponent(callbackUrl)}`);
  107 |
  108 |   await expect
  109 |     .poll(() => page.url(), { timeout: 20_000 })
  110 |     .toMatch(new RegExp(`(${ssoOrigin.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}|${baseURL!.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`));
  111 |
  112 |   if (new URL(page.url()).origin === new URL(ssoOrigin).origin) {
  113 |     await completeSsoLogin(page);
  114 |   }
  115 |
  116 |   await expect.poll(() => page.url(), { timeout: 45_000 }).toContain(baseURL!);
  117 |   await page.waitForLoadState('networkidle');
  118 |
  119 |   const tokens = await page.evaluate(() => {
  120 |     const raw = window.localStorage.getItem('tokens');
  121 |     return raw ? JSON.parse(raw) as { access?: string; accessExpire?: number; expire?: number } : null;
  122 |   });
> 123 |   expect(tokens?.access, 'access token should be stored locally after callback exchange').toBeTruthy();
      |                                                                                           ^ Error: access token should be stored locally after callback exchange
  124 |
  125 |   const refreshResponse = await page.request.post('/auth/oidc/token', {
  126 |     data: {},
  127 |   });
  128 |   expect(refreshResponse.ok(), `refresh failed: ${refreshResponse.status()}`).toBeTruthy();
  129 |   const refreshBody = await refreshResponse.json();
  130 |   expect(refreshBody?.data?.access_token).toBeTruthy();
  131 |   expect(JSON.stringify(refreshBody)).not.toContain('refresh_token');
  132 |
  133 |   const uploadResult = await page.evaluate(async () => {
  134 |     const { FileUploader } = await import('@dofe/file-sdk-web');
  135 |     const uploader = new FileUploader({ apiBase: '/api/proxy/sso', timeout: 60_000 });
  136 |     const file = new File(['vibecoding-sso-e2e'], `vibecoding-sso-e2e-${Date.now()}.txt`, {
  137 |       type: 'text/plain',
  138 |     });
  139 |     return uploader.upload(file, {
  140 |       scope: 'avatar',
  141 |       metadata: { source: 'vibecoding-sso-e2e' },
  142 |     });
  143 |   });
  144 |
  145 |   expect(uploadResult.fileId).toBeTruthy();
  146 |   expect(uploadResult.cdnUrl, 'avatar scope should return a CDN URL').toBeTruthy();
  147 |
  148 |   const cdnResponse = await page.request.get(uploadResult.cdnUrl!);
  149 |   expect(cdnResponse.ok(), `CDN URL failed: ${cdnResponse.status()}`).toBeTruthy();
  150 |
  151 |   const logoutResponse = await page.request.post('/auth/oidc/logout', {
  152 |     data: {
  153 |       access_token: refreshBody.data.access_token,
  154 |     },
  155 |   });
  156 |   expect(logoutResponse.ok(), `logout failed: ${logoutResponse.status()}`).toBeTruthy();
  157 |   const logoutBody = await logoutResponse.json();
  158 |   expect(logoutBody?.data?.logoutUrl).toBeTruthy();
  159 |
  160 |   const clearResponse = await page.request.post('/auth/oidc/clear-session', {
  161 |     data: {},
  162 |   });
  163 |   expect(clearResponse.ok(), `clear-session failed: ${clearResponse.status()}`).toBeTruthy();
  164 |
  165 |   const refreshAfterLogout = await page.request.post('/auth/oidc/token', {
  166 |     data: {},
  167 |   });
  168 |   expect(refreshAfterLogout.ok()).toBeFalsy();
  169 | });
  170 |
```
