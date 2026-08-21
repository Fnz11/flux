with open('e2e/fixtures.ts', 'r') as f:
    content = f.read()

content = content.replace("api: async ({ page }, use) => {", "api: [async ({ page }, use) => {")
content = content.replace("    await use({ set: (method, path, reply) => overrides.set(`${method.toUpperCase()} ${path}`, reply), reset: () => overrides.clear(), requests })\n  },", "    await use({ set: (method, path, reply) => overrides.set(`${method.toUpperCase()} ${path}`, reply), reset: () => overrides.clear(), requests })\n  }, { auto: true }],")

content = content.replace("wallet: async ({ page, api: _api }, use) => {", "wallet: [async ({ page, api: _api }, use) => {")
content = content.replace("      disconnect: async () => {\n        await page.getByText('1111...1111').first().click()\n        await page.getByRole('button', { name: 'Disconnect' }).click()\n      },\n    })\n  },", "      disconnect: async () => {\n        await page.getByText('1111...1111').first().click()\n        await page.getByRole('button', { name: 'Disconnect' }).click()\n      },\n    })\n  }, { auto: true }],")

content = content.replace("ws: async ({ page, api: _api }, use) => {", "ws: [async ({ page, api: _api }, use) => {")
content = content.replace("        return mockWin.__mockSockets.map((s: any) => s.sent).flat()\n      }),\n    })\n  },", "        return mockWin.__mockSockets.map((s: any) => s.sent).flat()\n      }),\n    })\n  }, { auto: true }],")

with open('e2e/fixtures.ts', 'w') as f:
    f.write(content)
