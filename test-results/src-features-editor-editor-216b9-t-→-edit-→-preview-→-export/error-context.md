# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: src\features\editor\editor-critical-journey.test.ts >> critical journey: dashboard → create project → edit → preview → export
- Location: src\features\editor\editor-critical-journey.test.ts:3:1

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: locator('h2')
Expected: visible
Error: strict mode violation: locator('h2') resolved to 7 elements:
    1) <h2 class="px-1 pb-1 text-[10px] font-semibold tracking-wider text-zinc-400 uppercase dark:text-zinc-500">My Portfolio</h2> aka getByRole('heading', { name: 'My Portfolio' })
    2) <h2 class="px-1 pb-1 text-[10px] font-semibold tracking-wider text-zinc-400 uppercase dark:text-zinc-500">Text</h2> aka getByRole('heading', { name: 'Text' })
    3) <h2 class="px-1 pb-1 text-[10px] font-semibold tracking-wider text-zinc-400 uppercase dark:text-zinc-500">Media</h2> aka getByRole('heading', { name: 'Media' })
    4) <h2 class="px-1 pb-1 text-[10px] font-semibold tracking-wider text-zinc-400 uppercase dark:text-zinc-500">Interactive</h2> aka getByRole('heading', { name: 'Interactive' })
    5) <h2 class="px-1 pb-1 text-[10px] font-semibold tracking-wider text-zinc-400 uppercase dark:text-zinc-500">Structure</h2> aka getByRole('heading', { name: 'Structure' })
    6) <h2 data-component="heading">Heading</h2> aka getByRole('heading', { name: 'Heading' })
    7) <h2 class="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Properties</h2> aka getByRole('heading', { name: 'Properties' })

Call log:
  - Expect "toBeVisible" locator('h2') with timeout 5000ms
  - waiting for locator('h2')

```

# Page snapshot

```yaml
- generic [ref=e2]:
  - generic [ref=e3]:
    - banner [ref=e4]:
      - generic [ref=e5]:
        - link "Back to projects" [ref=e6] [cursor=pointer]:
          - /url: /
        - button "Test Portfolio" [ref=e14]
        - status "Persistence status for this project" [ref=e15]: Saved
      - generic [ref=e18]:
        - button "Undo" [active] [ref=e19]
        - button "Redo" [ref=e24]
        - separator [ref=e29]
        - generic [ref=e30]:
          - generic [ref=e31]: Page
          - combobox "Current page" [ref=e32]:
            - option "Test Portfolio" [selected]
        - button "Page actions" [ref=e33]
        - separator [ref=e38]
        - group "Viewport and zoom" [ref=e39]:
          - generic [ref=e40]:
            - button "Desktop viewport" [pressed] [ref=e41]
            - button "Laptop viewport" [ref=e45]
            - button "Tablet viewport" [ref=e49]
            - button "Mobile viewport" [ref=e53]
          - generic [ref=e57]:
            - generic [ref=e58]: Custom viewport width in pixels
            - spinbutton "Custom viewport width in pixels" [ref=e59]: "1440"
            - generic [aria-hidden] [ref=e60]: px
          - separator [ref=e61]
          - generic [ref=e62]:
            - button "Zoom out" [ref=e63]
            - button "Reset zoom to 100%" [ref=e66]: 100%
            - button "Zoom in" [ref=e67]
            - button "Fit page to workspace" [ref=e70]
      - generic [ref=e77]:
        - button "Preview" [ref=e78]
        - button "Export" [ref=e79]
    - generic [ref=e80]:
      - complementary "Components and layers" [ref=e81]:
        - generic [ref=e82]:
          - generic [ref=e84]:
            - tablist "Sidebar sections" [ref=e85]:
              - tab "Components" [selected] [ref=e86]
              - tab "Layers" [ref=e92]
            - tabpanel "Components" [ref=e97]:
              - generic [ref=e98]:
                - searchbox "Search components" [ref=e100]
                - paragraph [ref=e101]: Click a component to insert it into “Root” (or beside the selection), or drag it onto the canvas or a layer.
              - generic [ref=e102]:
                - generic [ref=e103]:
                  - heading "My Portfolio" [level=2] [ref=e104]
                  - list [ref=e105]:
                    - listitem [ref=e106]:
                      - button "Insert Section" [ref=e107]:
                        - generic [ref=e111]:
                          - generic [ref=e112]: Section
                          - generic [ref=e114]: Semantic section container that groups page content.
                    - listitem [ref=e122]:
                      - button "Insert Container" [ref=e123]:
                        - generic [ref=e128]:
                          - generic [ref=e129]: Container
                          - generic [ref=e131]: Centers and bounds content with a maximum width.
                    - listitem [ref=e139]:
                      - button "Insert Stack" [ref=e140]:
                        - generic [ref=e143]:
                          - generic [ref=e144]: Stack
                          - generic [ref=e146]: Arranges children in a row or column with gap and alignment.
                    - listitem [ref=e154]:
                      - button "Insert Grid" [ref=e155]:
                        - generic [ref=e159]:
                          - generic [ref=e160]: Grid
                          - generic [ref=e162]: Arranges children in columns and rows.
                    - listitem [ref=e170]:
                      - button "Insert Spacer" [ref=e171]:
                        - generic [ref=e176]:
                          - generic [ref=e177]: Spacer
                          - generic [ref=e179]: Adds intentional empty space between siblings.
                - generic [ref=e187]:
                  - heading "Text" [level=2] [ref=e188]
                  - list [ref=e189]:
                    - listitem [ref=e190]:
                      - button "Insert Heading" [ref=e191]:
                        - generic [ref=e194]:
                          - generic [ref=e195]: Heading
                          - generic [ref=e197]: Section heading from H1 to H6 with editable text.
                    - listitem [ref=e205]:
                      - button "Insert Paragraph" [ref=e206]:
                        - generic [ref=e210]:
                          - generic [ref=e211]: Paragraph
                          - generic [ref=e213]: Editable paragraph of running text.
                    - listitem [ref=e221]:
                      - button "Insert Text" [ref=e222]:
                        - generic [ref=e226]:
                          - generic [ref=e227]: Text
                          - generic [ref=e229]: General-purpose inline text element.
                - generic [ref=e237]:
                  - heading "Media" [level=2] [ref=e238]
                  - list [ref=e239]:
                    - listitem [ref=e240]:
                      - button "Insert Image" [ref=e241]:
                        - generic [ref=e247]:
                          - generic [ref=e248]: Image
                          - generic [ref=e250]: Picture with alt text and configurable fit, size, and radius.
                - generic [ref=e258]:
                  - heading "Interactive" [level=2] [ref=e259]
                  - list [ref=e260]:
                    - listitem [ref=e261]:
                      - button "Insert Button" [ref=e262]:
                        - generic [ref=e270]:
                          - generic [ref=e271]: Button
                          - generic [ref=e273]: Call-to-action button with an editable label and destination.
                    - listitem [ref=e281]:
                      - button "Insert Link" [ref=e282]:
                        - generic [ref=e287]:
                          - generic [ref=e288]: Link
                          - generic [ref=e290]: Inline link with an editable label and destination.
                - generic [ref=e298]:
                  - heading "Structure" [level=2] [ref=e299]
                  - list [ref=e300]:
                    - listitem [ref=e301]:
                      - button "Insert Divider" [ref=e302]:
                        - generic [ref=e305]:
                          - generic [ref=e306]: Divider
                          - generic [ref=e308]: Horizontal separator line with configurable thickness and color.
                    - listitem [ref=e316]:
                      - button "Insert Navbar" [ref=e317]:
                        - generic [ref=e321]:
                          - generic [ref=e322]: Navbar
                          - generic [ref=e324]: Top navigation bar composed of an editable heading and links.
                    - listitem [ref=e332]:
                      - button "Insert Hero" [ref=e333]:
                        - generic [ref=e338]:
                          - generic [ref=e339]: Hero
                          - generic [ref=e341]: Introductory hero block composed of editable text and a button.
                    - listitem [ref=e349]:
                      - button "Insert Footer" [ref=e350]:
                        - generic [ref=e354]:
                          - generic [ref=e355]: Footer
                          - generic [ref=e357]: Page footer composed of editable text and links.
          - button "Collapse components and layers" [ref=e365]
      - separator "Resize left panel" [ref=e369]
      - heading "Heading" [level=2] [ref=e375]
      - separator "Resize right panel" [ref=e376]
      - complementary "Properties inspector" [ref=e377]:
        - generic [ref=e378]:
          - button "Collapse inspector" [ref=e379]
          - generic [ref=e384]:
            - generic [ref=e385]:
              - heading "Properties" [level=2] [ref=e386]
              - paragraph [ref=e387]: Nothing selected
              - paragraph [ref=e388]: Click a component on the canvas or in the Layers panel to edit its properties.
            - generic [ref=e389]:
              - heading "Page settings" [level=3] [ref=e390]
              - generic [ref=e391]:
                - text: Page name
                - textbox "Page name" [ref=e392]: Test Portfolio
              - generic [ref=e393]:
                - text: Slug
                - textbox "Slug" [ref=e394]: test-portfolio
              - generic [ref=e395]:
                - text: Page title
                - textbox "Page title" [ref=e396]: Test Portfolio
              - generic [ref=e397]:
                - text: Background
                - generic [ref=e398]:
                  - 'textbox "Background #ffffff" [ref=e399]': "#ffffff"
                  - textbox "Pick page background color" [ref=e400] [cursor=pointer]: "#ffffff"
    - status [ref=e401]
    - contentinfo [ref=e402]:
      - generic [ref=e403]: 1440px · 100%
      - navigation "Selection breadcrumb" [ref=e404]:
        - generic [ref=e405]: Test Portfolio
        - generic [ref=e407]: · nothing selected
      - generic [ref=e408]: /test-portfolio · 3 nodes
  - region "Notifications alt+T":
    - list:
      - listitem [ref=e409]:
        - button "Close toast" [ref=e410] [cursor=pointer]
        - generic [ref=e417]: Project "Test Portfolio" created
```

# Test source

```ts
  1  | import { test, expect } from '@playwright/test';
  2  | 
  3  | test('critical journey: dashboard → create project → edit → preview → export', async ({ page }) => {
  4  |   // 1. Open dashboard
  5  |   await page.goto('http://localhost:4321/');
  6  | 
  7  |   // Wait for page to load
  8  |   await expect(page).toHaveTitle(/Frame/);
  9  | 
  10 |   // 2. Create a project
  11 |   await page.click('button:has-text("Create your first project")');
  12 | 
  13 |   // Fill in project name
  14 |   const nameInput = page.locator('input[placeholder="Portfolio Website"]');
  15 |   await expect(nameInput).toBeVisible();
  16 |   await nameInput.fill('Test Portfolio');
  17 | 
  18 |   // Submit project creation
  19 |   await page.click('button:has-text("Create project")');
  20 | 
  21 |   // Wait for editor to load
  22 |   await expect(page.locator('text=Undo')).toBeVisible({ timeout: 10000 });
  23 | 
  24 |   // 3. Insert a section from component library
  25 |   await page.click('text=Components');
  26 | 
  27 |   // Find and click Section item by aria-label
  28 |   const libraryItems = page.locator('button[role="button"]');
  29 |   const itemCount = await libraryItems.count();
  30 | 
  31 |   for (let i = 0; i < itemCount; i++) {
  32 |     const label = await libraryItems.nth(i).getAttribute('aria-label');
  33 |     if (label && label.includes('Section')) {
  34 |       await libraryItems.nth(i).click();
  35 |       break;
  36 |     }
  37 |   }
  38 | 
  39 |   // 4. Insert a heading item
  40 |   for (let i = 0; i < itemCount; i++) {
  41 |     const label = await libraryItems.nth(i).getAttribute('aria-label');
  42 |     if (label && label.includes('Heading')) {
  43 |       await libraryItems.nth(i).click();
  44 |       break;
  45 |     }
  46 |   }
  47 | 
  48 |   // 5. Change heading text
  49 |   await page.evaluate(() => {
  50 |     const heading = document.querySelector('h2');
  51 |     if (heading) {
  52 |       heading.textContent = 'My Portfolio';
  53 |     }
  54 |   });
  55 | 
  56 |   // 6. Add a button - click the first button we find in the canvas toolbar
  57 |   await page.click('text=Button');
  58 | 
  59 |   // 7. Undo and redo
  60 |   await page.click('text=Undo');
> 61 |   await expect(page.locator('h2')).toBeVisible();
     |                                    ^ Error: expect(locator).toBeVisible() failed
  62 |   await page.click('text=Redo');
  63 | 
  64 |   // 8. Switch to Tablet preview
  65 |   await page.click('text=Tablet');
  66 | 
  67 |   // 9. Save and reload
  68 |   await page.click('text=Save');
  69 |   await expect(page.locator('text=Saved')).toBeVisible({ timeout: 10000 });
  70 | 
  71 |   await page.reload();
  72 |   await expect(page).toHaveURL(/http:\/\/localhost:4321\/editor\//);
  73 | 
  74 |   // 10. Verify design intact
  75 |   await expect(page.locator('h2')).toContainText('My Portfolio');
  76 | 
  77 |   // 11. Export project
  78 |   await page.click('text=Export');
  79 | 
  80 |   // 12. Verify download
  81 |   await expect(page.locator('text=Download')).toBeVisible();
  82 |   await page.click('text=Download');
  83 | 
  84 |   const [download] = await Promise.all([
  85 |     page.waitForEvent('download'),
  86 |     page.click('text=Download'),
  87 |   ]);
  88 |   await download.saveAs('/tmp/frame-export.zip');
  89 | 
  90 |   console.log('Critical journey test completed');
  91 | });
```